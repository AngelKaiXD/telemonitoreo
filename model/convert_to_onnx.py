# -*- coding: utf-8 -*-
"""
Convierte el modelo entrenado (preeclampsia_rf_model.joblib) a ONNX para
que la Vercel Function api/predict-risk.py pueda servirlo con dependencias
ligeras (onnxruntime + numpy ~122 MB) en lugar de scikit-learn + scipy
(~250 MB, que exceden el tamaño máximo de función de Vercel).

No reentrena ni cambia el modelo: escarbe el mismo Random Forest entrenado.
Uso: python model/convert_to_onnx.py
"""
import json
import os
from pathlib import Path

import joblib
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

MODEL_DIR = Path(__file__).resolve().parent


def main():
    config = json.loads((MODEL_DIR / "model_config.json").read_text(encoding="utf-8"))
    rf = joblib.load(str(MODEL_DIR / "preeclampsia_rf_model.joblib"))

    initial_types = [("input", FloatTensorType([None, len(config["feature_order"])]))]
    onx = convert_sklearn(rf, initial_types=initial_types, target_opset=17)

    out_path = MODEL_DIR / "preeclampsia_rf_model.onnx"
    with open(out_path, "wb") as f:
        f.write(onx.SerializeToString())
    print(f"OK: {out_path} ({out_path.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()