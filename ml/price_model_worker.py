import argparse
import json
import sys
from typing import Any, Dict


def _patch_sklearn_backcompat() -> None:
    """
    The provided model was pickled with scikit-learn 1.6.1 and fails to load on
    newer versions due to an internal class rename. This lightweight patch makes
    the pickle loadable without requiring a full sklearn downgrade.
    """

    try:
        import sklearn.compose._column_transformer as ct

        if not hasattr(ct, "_RemainderColsList"):
            ct._RemainderColsList = type("_RemainderColsList", (list,), {})
    except Exception:
        # If sklearn isn't available, the load will fail later with a clearer error.
        return


def _safe_float(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    try:
        return float(value)
    except Exception:
        return 0.0


def _load_model(model_path: str):
    _patch_sklearn_backcompat()

    import warnings

    try:
        from sklearn.exceptions import InconsistentVersionWarning

        warnings.filterwarnings("ignore", category=InconsistentVersionWarning)
    except Exception:
        pass

    import joblib

    model = joblib.load(model_path)

    # In constrained/sandboxed Windows environments, joblib's thread pool can fail
    # due to named pipe restrictions. Force single-threaded prediction.
    try:
        regressor = getattr(model, "named_steps", {}).get("regressor")
        if regressor is not None and hasattr(regressor, "n_jobs"):
            regressor.n_jobs = 1
    except Exception:
        pass

    return model


def _predict(model, features: Dict[str, Any]) -> float:
    import pandas as pd

    row = {
        "text": (features.get("text") or "").strip(),
        "category": (features.get("category") or "").strip(),
        "brand": (features.get("brand") or "").strip(),
        "condition": (features.get("condition") or "").strip(),
        "original_price": _safe_float(features.get("original_price")),
    }

    df = pd.DataFrame([row])
    prediction = model.predict(df)[0]
    return float(prediction)


def _write_line(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    try:
        sys.stdout.flush()
    except Exception:
        pass


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", required=True)
    args = parser.parse_args()

    try:
        model = _load_model(args.model_path)
    except Exception as exc:
        _write_line({"ok": False, "error": f"Failed to load model: {exc.__class__.__name__}: {exc}"})
        return 1

    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        msg_id = None
        try:
            msg = json.loads(line)
            msg_id = msg.get("id")
            features = msg.get("features") or {}
            predicted_price = _predict(model, features)
            _write_line({"id": msg_id, "ok": True, "predicted_price": predicted_price})
        except Exception as exc:
            _write_line(
                {
                    "id": msg_id,
                    "ok": False,
                    "error": f"{exc.__class__.__name__}: {exc}",
                }
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
