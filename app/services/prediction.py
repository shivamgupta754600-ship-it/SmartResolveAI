
from pathlib import Path

import joblib

from app.repositories.prediction import save_prediction


# ==========================================
# 1. MODEL CONFIGURATION
# ==========================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

MODEL_PATH = (
    PROJECT_ROOT
    / "ml"
    / "smartresolve_tuned_model.joblib"
)

MIN_TEXT_LENGTH = 5
MAX_TEXT_LENGTH = 1000

CONFIDENCE_THRESHOLD = 0.60


# ==========================================
# 2. LOAD MODEL
# ==========================================

try:

    model = joblib.load(MODEL_PATH)

    print("SmartResolve tuned model loaded successfully.")

except Exception as error:

    model = None

    print("Error loading model:", error)


# ==========================================
# 3. PREDICTION FUNCTION
# ==========================================

def predict_grievance(text: str) -> dict:

    # --------------------------------------
    # GUARDRAIL 1: INPUT TYPE
    # --------------------------------------

    if not isinstance(text, str):

        raise ValueError(
            "Grievance text must be a string."
        )

    # --------------------------------------
    # GUARDRAIL 2: REMOVE EXTRA SPACES
    # --------------------------------------

    text = text.strip()

    # --------------------------------------
    # GUARDRAIL 3: EMPTY INPUT
    # --------------------------------------

    if not text:

        raise ValueError(
            "Grievance text cannot be empty."
        )

    # --------------------------------------
    # GUARDRAIL 4: MINIMUM LENGTH
    # --------------------------------------

    if len(text) < MIN_TEXT_LENGTH:

        raise ValueError(
            f"Grievance text must contain at least "
            f"{MIN_TEXT_LENGTH} characters."
        )

    # --------------------------------------
    # GUARDRAIL 5: MAXIMUM LENGTH
    # --------------------------------------

    if len(text) > MAX_TEXT_LENGTH:

        raise ValueError(
            f"Grievance text cannot exceed "
            f"{MAX_TEXT_LENGTH} characters."
        )

    # --------------------------------------
    # GUARDRAIL 6: MODEL AVAILABILITY
    # --------------------------------------

    if model is None:

        raise RuntimeError(
            "Prediction model is unavailable."
        )

    # --------------------------------------
    # 7. PREDICT CATEGORY
    # --------------------------------------

    predicted_category = model.predict([text])[0]

    # --------------------------------------
    # 8. GET PROBABILITIES
    # --------------------------------------

    probabilities = model.predict_proba([text])[0]

    classes = model.classes_

    probability_map = {
        category: round(float(probability), 4)
        for category, probability in zip(
            classes,
            probabilities
        )
    }

    # --------------------------------------
    # 9. CALCULATE CONFIDENCE
    # --------------------------------------

    confidence = float(max(probabilities))

    confidence = round(confidence, 4)

    # --------------------------------------
    # 10. HUMAN REVIEW GUARDRAIL
    # --------------------------------------

    needs_human_review = (
        confidence < CONFIDENCE_THRESHOLD
    )

    if needs_human_review:

        review_message = (
            "Low model confidence. "
            "Human review is required before routing."
        )

    else:

        review_message = (
            "Prediction confidence is above "
            "the review threshold. "
            "Human review may still be required."
        )

    # --------------------------------------
    # 11. SAFETY NOTICE
    # --------------------------------------

    safety_note = (
        "Educational classification model. "
        "Predictions are not official government "
        "decisions or clinical diagnoses. "
        "Human review is required before final routing."
    )

    # --------------------------------------
    # 12. SAVE PREDICTION TO DATABASE
    # --------------------------------------

    try:

        prediction_id = save_prediction(
            grievance_text=text,
            predicted_category=predicted_category,
            confidence=confidence,
            needs_human_review=needs_human_review
        )

    except Exception as error:

        raise RuntimeError(
            f"Prediction generated, but saving failed: {error}"
        )

    # --------------------------------------
    # 13. RETURN RESULT
    # --------------------------------------

    return {

        "prediction_id": prediction_id,

        "text": text,

        "predicted_category": predicted_category,

        "confidence": confidence,

        "needs_human_review": needs_human_review,

        "probabilities": probability_map,

        "review_message": review_message,

        "safety_note": safety_note

    }