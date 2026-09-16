# -*- coding: utf-8 -*-
"""
Entrenamiento del modelo de riesgo de preeclampsia (Random Forest)
usando datos reales exportados de Supabase (vital_readings + patients).

Metodologia base: la misma que proporciono la tutora (Leave-One-Out,
RandomForestClassifier con las mismas hiperparametros), extendida con:
  - Feature de "presion arterial sostenida" (comparacion con la lectura
    anterior de la misma paciente, umbral de 3 horas).
  - Deteccion separada de hipotension (no se mezcla con el riesgo de
    preeclampsia, se reporta aparte).
Columnas glucosa/sal/estres/act. fisica/ctrl prenatal: NO se usan (ya
fueron eliminadas de la captura de datos en fases anteriores del proyecto).
"""
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import LeaveOneOut
from sklearn.metrics import (
    classification_report, accuracy_score, confusion_matrix,
    precision_recall_fscore_support
)
from sklearn.preprocessing import LabelEncoder

RNG = 42
SUSTAINED_HOURS_THRESHOLD = 3.0
HTN_SYSTOLIC = 140
HTN_DIASTOLIC = 90
HYPOTENSION_SYSTOLIC = 90
HYPOTENSION_DIASTOLIC = 60

# ---------------------------------------------------------------------
# 1) CARGA DE DATOS REALES (exportados de Supabase)
# ---------------------------------------------------------------------
df = pd.read_csv('/home/claude/readings_raw.csv')
df['recorded_at'] = pd.to_datetime(df['recorded_at'], utc=True)

bool_cols = [
    'has_hypertension_history', 'has_preeclampsia_history',
    'has_multiple_pregnancy', 'is_nulliparous', 'has_pregestational_diabetes'
]
for c in bool_cols:
    df[c] = df[c].astype(str).str.lower().map({'true': 1, 'false': 0}).fillna(0).astype(int)

df['PAS'] = pd.to_numeric(df['systolic'], errors='coerce')
df['PAD'] = pd.to_numeric(df['diastolic'], errors='coerce')
df = df.dropna(subset=['PAS', 'PAD']).copy()

df['height_m'] = pd.to_numeric(df['height_cm'], errors='coerce') / 100.0
df['weight_kg'] = pd.to_numeric(df['weight_kg'], errors='coerce')
df['IMC'] = df['weight_kg'] / (df['height_m'] ** 2)

# ---------------------------------------------------------------------
# 2) FEATURE NUEVA: presion arterial sostenida
#    Compara cada lectura con la lectura INMEDIATA ANTERIOR de la MISMA
#    paciente. Si ambas estan en rango de hipertension (PAS>=140 o
#    PAD>=90) y el tiempo transcurrido entre ellas es >= 3 horas y la
#    presion "no bajo" (la lectura actual sigue en rango de HTN), se
#    marca sustained_htn = 1.
# ---------------------------------------------------------------------
df = df.sort_values(['patient_id', 'recorded_at']).reset_index(drop=True)


def flag_htn(sys_v, dia_v):
    return (sys_v >= HTN_SYSTOLIC) or (dia_v >= HTN_DIASTOLIC)


def flag_hypotension(sys_v, dia_v):
    return (sys_v <= HYPOTENSION_SYSTOLIC) or (dia_v <= HYPOTENSION_DIASTOLIC)


sustained_flags = []
hours_since_prev_list = []
for patient_id, g in df.groupby('patient_id', sort=False):
    g = g.sort_values('recorded_at')
    prev_row = None
    for idx, row in g.iterrows():
        sustained = 0
        hours_gap = np.nan
        if prev_row is not None:
            hours_gap = (row['recorded_at'] - prev_row['recorded_at']).total_seconds() / 3600.0
            both_htn = flag_htn(row['PAS'], row['PAD']) and flag_htn(prev_row['PAS'], prev_row['PAD'])
            if both_htn and hours_gap >= SUSTAINED_HOURS_THRESHOLD:
                sustained = 1
        sustained_flags.append((idx, sustained))
        hours_since_prev_list.append((idx, hours_gap))
        prev_row = row

sustained_map = dict(sustained_flags)
hours_map = dict(hours_since_prev_list)
df['sustained_htn'] = df.index.map(sustained_map).fillna(0).astype(int)
df['hours_since_prev_reading'] = df.index.map(hours_map)

df['hipotension'] = df.apply(lambda r: 1 if flag_hypotension(r['PAS'], r['PAD']) else 0, axis=1)

print(f"Filas totales: {len(df)} | Pacientes distintas: {df['patient_id'].nunique()}")
print(f"Lecturas con presion sostenida (>= {SUSTAINED_HOURS_THRESHOLD}h, ambas HTN): {df['sustained_htn'].sum()}")
print(f"Lecturas con hipotension (<= {HYPOTENSION_SYSTOLIC}/{HYPOTENSION_DIASTOLIC}): {df['hipotension'].sum()}")


# ---------------------------------------------------------------------
# 3) REGLA DE ETIQUETADO CLINICO (ALTO/MEDIO/BAJO) - EXTENDIDA
#    Misma logica base que el script de la tutora + el nuevo factor de
#    presion sostenida como "punto mayor" (mismo peso que antecedentes).
# ---------------------------------------------------------------------
def asignar_riesgo_clinico(row):
    puntos_mayores = 0
    puntos_moderados = 0

    if row['has_preeclampsia_history'] == 1: puntos_mayores += 1
    if row['has_hypertension_history'] == 1: puntos_mayores += 1
    if row['has_pregestational_diabetes'] == 1: puntos_mayores += 1
    if row['has_multiple_pregnancy'] == 1: puntos_mayores += 1
    if row['PAS'] >= HTN_SYSTOLIC or row['PAD'] >= HTN_DIASTOLIC: puntos_mayores += 1
    if row['sustained_htn'] == 1: puntos_mayores += 1  # NUEVO

    if row['age'] >= 35 or row['age'] < 18: puntos_moderados += 1
    if row['IMC'] >= 30: puntos_moderados += 1
    if row['is_nulliparous'] == 1: puntos_moderados += 1

    if puntos_mayores >= 1 or puntos_moderados >= 2:
        return 'ALTO'
    elif puntos_moderados == 1 or row['PAS'] >= 130 or row['PAD'] >= 85:
        return 'MEDIO'
    else:
        return 'BAJO'


df['Riesgo de preeclampsia'] = df.apply(asignar_riesgo_clinico, axis=1)
print("\nDistribucion de etiquetas (regla clinica extendida):")
print(df['Riesgo de preeclampsia'].value_counts())

# ---------------------------------------------------------------------
# 4) FEATURES Y TARGET PARA EL MODELO
# ---------------------------------------------------------------------
FEATURE_COLS = [
    'age', 'gestation_weeks', 'height_m', 'weight_kg', 'IMC',
    'has_hypertension_history', 'has_preeclampsia_history',
    'has_multiple_pregnancy', 'is_nulliparous', 'has_pregestational_diabetes',
    'PAS', 'PAD', 'sustained_htn'
]

X = df[FEATURE_COLS].copy()
y = df['Riesgo de preeclampsia']

le = LabelEncoder()
y_encoded = le.fit_transform(y)
print("\nClases codificadas:", dict(zip(le.classes_, le.transform(le.classes_))))

# ---------------------------------------------------------------------
# 5) EVALUACION CON LEAVE-ONE-OUT (misma metodologia que la tutora)
# ---------------------------------------------------------------------
loo = LeaveOneOut()
y_true, y_pred = [], []

for train_idx, test_idx in loo.split(X):
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y_encoded[train_idx], y_encoded[test_idx]

    if len(np.unique(y_train)) < 2:
        # No se puede entrenar un clasificador con una sola clase presente
        y_true.append(y_test[0])
        y_pred.append(y_train[0])
        continue

    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=4,
        random_state=RNG,
        class_weight='balanced'
    )
    rf.fit(X_train, y_train)
    pred = rf.predict(X_test)
    y_true.append(y_test[0])
    y_pred.append(pred[0])

acc = accuracy_score(y_true, y_pred)
precision, recall, f1, _ = precision_recall_fscore_support(
    y_true, y_pred, average='weighted', zero_division=0
)
cm = confusion_matrix(y_true, y_pred, labels=list(range(len(le.classes_))))

print("\n==================================================")
print("       METRICAS DE EVALUACION DEL MODELO (LOO)    ")
print("==================================================")
print(f"Exactitud (Accuracy) : {acc * 100:.2f}%")
print(f"Precision            : {precision * 100:.2f}%")
print(f"Sensibilidad (Recall): {recall * 100:.2f}%")
print(f"F1-Score              : {f1 * 100:.2f}%")
print("\nMatriz de Confusion:")
print(pd.DataFrame(cm, index=le.classes_, columns=le.classes_))
print("\nReporte por clase:")
print(classification_report(
    y_true, y_pred, labels=list(range(len(le.classes_))),
    target_names=le.classes_, zero_division=0
))

# ---------------------------------------------------------------------
# 6) MODELO FINAL (entrenado con TODOS los datos disponibles, para
#    desplegar) - el LOO de arriba es solo para reportar metricas
# ---------------------------------------------------------------------
final_model = RandomForestClassifier(
    n_estimators=100, max_depth=4, random_state=RNG, class_weight='balanced'
)
final_model.fit(X, y_encoded)

joblib.dump(final_model, '/home/claude/preeclampsia_rf_model.joblib')
joblib.dump(le, '/home/claude/preeclampsia_label_encoder.joblib')

with open('/home/claude/model_config.json', 'w', encoding='utf-8') as f:
    json.dump({
        'feature_order': FEATURE_COLS,
        'label_classes': le.classes_.tolist(),
        'sustained_hours_threshold': SUSTAINED_HOURS_THRESHOLD,
        'htn_systolic': HTN_SYSTOLIC,
        'htn_diastolic': HTN_DIASTOLIC,
        'hypotension_systolic': HYPOTENSION_SYSTOLIC,
        'hypotension_diastolic': HYPOTENSION_DIASTOLIC,
        'n_training_rows': int(len(df)),
        'n_patients': int(df['patient_id'].nunique()),
        'loo_accuracy': float(acc),
        'loo_precision_weighted': float(precision),
        'loo_recall_weighted': float(recall),
        'loo_f1_weighted': float(f1),
    }, f, ensure_ascii=False, indent=2)

df_out = df.copy()
df_out['riesgo_predicho_loo'] = le.inverse_transform(y_pred)
df_out['recorded_at'] = df_out['recorded_at'].dt.tz_localize(None)
df_out.to_excel('/home/claude/dataset_con_predicciones_preeclampsia.xlsx', index=False)

print("\nArchivos generados:")
print(" - preeclampsia_rf_model.joblib (modelo entrenado)")
print(" - preeclampsia_label_encoder.joblib")
print(" - model_config.json (orden de features, umbrales, metricas)")
print(" - dataset_con_predicciones_preeclampsia.xlsx")
