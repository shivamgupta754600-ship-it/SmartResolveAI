"""
SmartResolve AI - Prediction Service (Layer 3)
Business logic: input guardrails → ML prediction → DB save → response dict.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from pathlib import Path
from typing import Optional

import joblib

from app.core.config import settings
from app.repositories.prediction import save_prediction


# ======================================================================
# 1. MODEL CONFIGURATION
# ======================================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

MODEL_PATH = PROJECT_ROOT / "ml" / "smartresolve_tuned_model.joblib"


# ======================================================================
# 2. LOAD MODEL  (once at startup)
# ======================================================================

try:
    model = joblib.load(MODEL_PATH)
    logging.getLogger(__name__).info("SmartResolve model loaded successfully.")
except Exception:
    model = None
    logging.getLogger(__name__).exception("Could not load routing model")


# ======================================================================
# 3. COMPILED GUARDRAIL PATTERNS
# ======================================================================

# XSS / HTML injection
_HTML_INJECTION_RE = re.compile(
    r"<[a-zA-Z][^>]*>|</[a-zA-Z]+>|javascript\s*:|on[a-z]+\s*=",
    re.IGNORECASE,
)

# SQL injection attempts (command-style sequences only — avoids false positives)
_SQL_INJECTION_RE = re.compile(
    r"(--|;\s*(DROP|DELETE|INSERT|UPDATE|TRUNCATE|CREATE|ALTER|EXEC)\s"
    r"|UNION\s+SELECT|'\s*OR\s*'[^']*'=')",
    re.IGNORECASE,
)

# Excessive single-word repetition (same word 5+ times in a row)
_REPETITION_RE = re.compile(r"(\b\w+\b)(\s+\1){4,}", re.IGNORECASE)

# Non-printable / control characters (keep standard Unicode letters/numbers)
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _normalise_text(text: str) -> str:
    """NFKC-normalise and strip control characters."""
    text = unicodedata.normalize("NFKC", text)
    text = _CONTROL_CHAR_RE.sub("", text)
    return text.strip()


def _has_excessive_special_chars(text: str) -> bool:
    """True when >50 % of characters are non-word, non-space characters."""
    if not text:
        return False
    special = sum(1 for c in text if not c.isalnum() and not c.isspace())
    return (special / len(text)) > 0.50


# ======================================================================
# 4. PREDICTION FUNCTION
# ======================================================================

def suggest_category(text: str) -> tuple[str, dict[str, float]]:
    if model is None:
        raise RuntimeError("The prediction model is currently unavailable.")
    text = _normalise_text(text)
    category = str(model.predict([text])[0])
    scores = model.predict_proba([text])[0]
    return category, {
        str(label): round(float(score), 4)
        for label, score in zip(model.classes_, scores)
    }


def predict_grievance(text: str, user_id: Optional[int] = None) -> dict:
    """
    Validate, classify, and persist a citizen grievance.
    Returns the full prediction result dict.
    Raises ValueError for invalid input, RuntimeError for infra errors.
    """

    # ------------------------------------------------------------------
    # GUARDRAIL 1 — Type check
    # ------------------------------------------------------------------
    if not isinstance(text, str):
        raise ValueError("Grievance text must be a string.")

    # ------------------------------------------------------------------
    # GUARDRAIL 2 — Normalise & strip
    # ------------------------------------------------------------------
    text = _normalise_text(text)

    # ------------------------------------------------------------------
    # GUARDRAIL 3 — Empty after normalisation
    # ------------------------------------------------------------------
    if not text:
        raise ValueError("Grievance text cannot be empty.")

    # ------------------------------------------------------------------
    # GUARDRAIL 4 — Minimum length
    # ------------------------------------------------------------------
    if len(text) < settings.MIN_TEXT_LENGTH:
        raise ValueError(
            f"Grievance text must contain at least {settings.MIN_TEXT_LENGTH} characters."
        )

    # ------------------------------------------------------------------
    # GUARDRAIL 5 — Maximum length
    # ------------------------------------------------------------------
    if len(text) > settings.MAX_TEXT_LENGTH:
        raise ValueError(
            f"Grievance text cannot exceed {settings.MAX_TEXT_LENGTH} characters."
        )

    # ------------------------------------------------------------------
    # GUARDRAIL 6 — XSS / HTML injection detection
    # ------------------------------------------------------------------
    if _HTML_INJECTION_RE.search(text):
        raise ValueError(
            "Input contains disallowed HTML or script patterns. "
            "Please submit a plain-text description of your grievance."
        )

    # ------------------------------------------------------------------
    # GUARDRAIL 7 — SQL injection detection
    # ------------------------------------------------------------------
    if _SQL_INJECTION_RE.search(text):
        raise ValueError(
            "Input contains disallowed SQL patterns. "
            "Please describe your grievance in plain language."
        )

    # ------------------------------------------------------------------
    # GUARDRAIL 8 — Excessive special characters (spam / noise)
    # ------------------------------------------------------------------
    if _has_excessive_special_chars(text):
        raise ValueError(
            "Input appears to contain excessive special characters. "
            "Please describe your grievance in plain language."
        )

    # ------------------------------------------------------------------
    # GUARDRAIL 9 — Excessive word repetition (bot / spam)
    # ------------------------------------------------------------------
    if _REPETITION_RE.search(text):
        raise ValueError(
            "Input appears to contain repeated content. "
            "Please describe your grievance clearly."
        )

    predicted_category, probability_map = suggest_category(text)
    confidence = max(probability_map.values())

    # ------------------------------------------------------------------
    # 13. HUMAN-REVIEW FLAG
    # ------------------------------------------------------------------
    needs_human_review = confidence < settings.CONFIDENCE_THRESHOLD

    if needs_human_review:
        review_message = (
            "Low model confidence. Human review is required before routing."
        )
    else:
        review_message = (
            "Confidence is above the review threshold. "
            "Human review is still recommended before final routing."
        )

    # ------------------------------------------------------------------
    # 14. SAFETY NOTICE
    # ------------------------------------------------------------------
    safety_note = (
        "Educational classification model. "
        "Predictions are not official government decisions. "
        "Human review is required before final routing."
    )

    # ------------------------------------------------------------------
    # 15. SAVE TO DATABASE
    # ------------------------------------------------------------------
    try:
        saved = save_prediction(
            grievance_text=text,
            predicted_category=predicted_category,
            confidence=confidence,
            needs_human_review=needs_human_review,
            user_id=user_id,
        )
    except Exception as error:
        raise RuntimeError(
            f"Prediction generated but could not be saved: {error}"
        )

    # ------------------------------------------------------------------
    # 16. RETURN RESULT
    # ------------------------------------------------------------------
    return {
        "prediction_id": saved["id"],
        "ticket_number": saved["ticket_number"],
        "text": text,
        "predicted_category": predicted_category,
        "confidence": confidence,
        "needs_human_review": needs_human_review,
        "probabilities": probability_map,
        "review_message": review_message,
        "safety_note": safety_note,
    }
