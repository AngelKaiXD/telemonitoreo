# -*- coding: utf-8 -*-
"""
Vercel Function (Python): predicción de riesgo de preeclampsia.

Sirve UNICAMENTE el modelo Random Forest ya entrenado (fase 19, aislada),
exportado a ONNX (model/preeclampsia_rf_model.onnx) para mantener el bundle
de la función dentro del límite de Vercel — scikit-learn + scipy (~250 MB
instalados) excedían el tamaño máximo de función:
  1. Carga una sola vez (a nivel de módulo) el modelo ONNX y model_config.json
     ubicados en /model — nada se reentrena aquí.
  2. Recibe por POST: age, gestation_weeks, height_m, weight_kg, imc,
     has_hypertension_history, has_preeclampsia_history,
     has_multiple_pregnancy, is_nulliparous, has_pregestational_diabetes,
     pas, pad y sustained_htn (opcional, default 0).
  3. Devuelve { "risk": "ALTO"|"MEDIO"|"BAJO", "hypotension": true|false }.

El orden de features, el mapeo risk->índice del label encoder y los umbrales
de hipotensión se toman SIEMPRE de model_config.json (fuente de verdad, escrito
por train_model.py); no se hardcodea ningún número aquí.
"""

import json
from http.server import BaseHTTPRequestHandler
from pathlib import Path

import numpy as np
import onnxruntime as ort

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "model"

_load_error = None
_session = None
_input_name = None
_label_output = None
_config = None
try:
    _config = json.loads((MODEL_DIR / "model_config.json").read_text(encoding="utf-8"))
    _session = ort.InferenceSession(
        str(MODEL_DIR / "preeclampsia_rf_model.onnx"),
        providers=["CPUExecutionProvider"],
    )
    _input_name = _session.get_inputs()[0].name
    _label_output = next(
        o.name for o in _session.get_outputs() if o.type == "tensor(int64)"
    )
except Exception as exc:  # noqa: BLE001 - el detalle solo queda en logs
    _load_error = exc


class BadRequest(Exception):
    """Petición inválida del cliente: responde 400 sin internos del servidor."""


def _to_number(value, field):
    if isinstance(value, bool):
        raise BadRequest(f"El campo {field} debe ser numérico")
    try:
        return float(value)
    except (TypeError, ValueError):
        raise BadRequest(f"El campo {field} debe ser numérico")


def _predict_risk(body):
    if _load_error is not None:
        raise RuntimeError("el modelo de predicción no está disponible")

    lowered = {str(key).lower(): value for key, value in (body or {}).items()}

    values = {}
    for column in _config["feature_order"]:
        name = column.lower()
        if name in lowered:
            values[column] = lowered[name]
        elif column == "sustained_htn":
            values[column] = 0
        else:
            raise BadRequest(f"Falta el campo {name}")

    features = []
    for column in _config["feature_order"]:
        value = values[column]
        if column == "sustained_htn":
            if value in (0, 1, "0", "1", False, True):
                features.append(1 if value in (1, "1", True) else 0)
            else:
                raise BadRequest("El campo sustained_htn debe ser 0 o 1")
        else:
            features.append(_to_number(value, column.lower()))

    matrix = np.array([features], dtype=np.float32)
    label = int(_session.run([_label_output], {_input_name: matrix})[0].flatten()[0])
    try:
        risk = str(_config["label_classes"][label])
    except (IndexError, TypeError):
        raise RuntimeError("la salida del modelo no corresponde a las clases conocidas")

    pas = float(features[_config["feature_order"].index("PAS")])
    pad = float(features[_config["feature_order"].index("PAD")])
    hypotension = (
        pas <= _config["hypotension_systolic"]
        or pad <= _config["hypotension_diastolic"]
    )

    return {"risk": risk, "hypotension": bool(hypotension)}


class handler(BaseHTTPRequestHandler):
    """Entrypoint de Vercel para funciones Python (BaseHTTPRequestHandler)."""

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b""
            if not raw:
                raise BadRequest("El cuerpo de la petición está vacío")
            try:
                body = json.loads(raw.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                raise BadRequest("El cuerpo debe ser un JSON válido")
            if not isinstance(body, dict):
                raise BadRequest("El cuerpo debe ser un objeto JSON")
            self._respond(200, _predict_risk(body))
        except BadRequest as exc:
            self._respond(400, {"error": str(exc)})
        except Exception:  # noqa: BLE001 - no se exponen detalles internos
            self._respond(500, {"error": "No se pudo procesar la predicción"})

    def _respond(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)