"""
SmartResolve AI — Improved Model Training  (v2)
================================================
Key improvements over the baseline:

1. FeatureUnion of word n-grams (1–2) + character n-grams (2–5)
   → character n-grams capture sub-word morphology in Hindi/Hinglish,
     greatly reducing errors on out-of-vocabulary tokens.

2. sublinear_tf=True → dampens the effect of very frequent words.

3. Calibrated LinearSVC as the classifier
   → LinearSVC usually outperforms Logistic Regression on text tasks
     while CalibratedClassifierCV wraps it to provide predict_proba()
     (required for confidence scores).

4. 5-fold stratified cross-validation on the full dataset, so the
   accuracy estimate is not tied to one particular 80/20 split.

5. Automatic comparison with the existing production model — the new
   model replaces it only when it is strictly better.

Usage:
    cd <project root>
    python -m ml.train_improved_model
"""

from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.preprocessing import Normalizer
from sklearn.svm import LinearSVC
from sklearn.feature_extraction.text import TfidfVectorizer

ROOT = Path(__file__).resolve().parent.parent


# ======================================================================
# 1. LOAD CLEANED DATASET
# ======================================================================

data_path = ROOT / "ml" / "data" / "grievances_cleaned.csv"
df = pd.read_csv(data_path)

print("=" * 60)
print("SMARTRESOLVE AI — Improved Model Training")
print("=" * 60)
print(f"\nDataset shape : {df.shape}")
print("\nCategory distribution:")
print(df["category"].value_counts().to_string())
print("\nLanguage distribution:")
print(df["language"].value_counts().to_string())


# ======================================================================
# 2. FEATURES & LABELS
# ======================================================================

X = df["text"]
y = df["category"]


# ======================================================================
# 3. TRAIN / TEST SPLIT  (same seed as original for fair comparison)
# ======================================================================

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"\nTrain : {len(X_train)}   Test : {len(X_test)}")


# ======================================================================
# 4. FEATURE PIPELINE
#
#   Word TF-IDF (1-gram + 2-gram):
#     Captures whole words and two-word phrases in English.
#
#   Char TF-IDF (2-gram … 5-gram, within-word boundaries via char_wb):
#     Captures sub-word patterns.  Hindi and Hinglish words share
#     common character sequences even when romanised differently
#     (e.g. "paani" / "pani" / "pāni" all share "ani").
#
#   Normalizer: L2-normalises the concatenated sparse vectors so that
#     the word and char feature magnitudes are on the same scale.
# ======================================================================

word_tfidf = TfidfVectorizer(
    analyzer="word",
    ngram_range=(1, 2),
    min_df=2,
    max_df=0.95,
    sublinear_tf=True,
    lowercase=True,
)

char_tfidf = TfidfVectorizer(
    analyzer="char_wb",        # char n-grams within word boundaries
    ngram_range=(2, 5),
    min_df=3,
    max_df=0.95,
    sublinear_tf=True,
    lowercase=True,
)

features = FeatureUnion([
    ("word", word_tfidf),
    ("char", char_tfidf),
])

# LinearSVC is fast and accurate for text; we wrap it with
# CalibratedClassifierCV so we get predict_proba() for confidence scores.
base_svc = LinearSVC(C=1.0, max_iter=2000, random_state=42, dual=True)
calibrated_clf = CalibratedClassifierCV(base_svc, cv=5, method="sigmoid")

pipeline = Pipeline([
    ("features",    features),
    ("normalizer",  Normalizer()),
    ("classifier",  calibrated_clf),
])


# ======================================================================
# 5. TRAIN
# ======================================================================

print("\nTraining improved model (word + char TF-IDF + Calibrated SVC)…")
pipeline.fit(X_train, y_train)
print("Training complete.")


# ======================================================================
# 6. HOLD-OUT TEST EVALUATION
# ======================================================================

y_pred = pipeline.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"\nHold-out test accuracy : {accuracy:.4f}  ({accuracy * 100:.2f} %)")
print("\nClassification report:")
print(classification_report(y_test, y_pred, zero_division=0))


# ======================================================================
# 7. STRATIFIED 5-FOLD CROSS-VALIDATION (full dataset, faster SVC)
#
#  We use a plain (uncalibrated) LinearSVC for CV speed; calibration
#  does not change accuracy, only probability estimates.
# ======================================================================

cv_pipeline = Pipeline([
    ("features",   FeatureUnion([
        ("word", TfidfVectorizer(
            analyzer="word", ngram_range=(1, 2), min_df=2,
            max_df=0.95, sublinear_tf=True, lowercase=True,
        )),
        ("char", TfidfVectorizer(
            analyzer="char_wb", ngram_range=(2, 5), min_df=3,
            max_df=0.95, sublinear_tf=True, lowercase=True,
        )),
    ])),
    ("normalizer", Normalizer()),
    ("classifier", LinearSVC(C=1.0, max_iter=2000, random_state=42, dual=True)),
])

print("\nRunning 5-fold stratified cross-validation…")
cv_scores = cross_val_score(
    cv_pipeline,
    X, y,
    cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
    scoring="accuracy",
    n_jobs=-1,
)
print(f"CV scores  : {np.round(cv_scores, 4)}")
print(f"CV mean    : {cv_scores.mean():.4f}  ±  {cv_scores.std():.4f}")


# ======================================================================
# 8. LANGUAGE-WISE ACCURACY
# ======================================================================

test_indices = X_test.index
lang_test = df.loc[test_indices, "language"]

result_df = pd.DataFrame({
    "text":               X_test.values,
    "actual_category":    y_test.values,
    "predicted_category": y_pred,
    "language":           lang_test.values,
})

print("\nLanguage-wise accuracy:")
for lang in sorted(result_df["language"].unique()):
    subset = result_df[result_df["language"] == lang]
    lang_acc = accuracy_score(subset["actual_category"], subset["predicted_category"])
    print(f"  {lang:12s}: {lang_acc:.4f}  ({lang_acc * 100:.2f} %)  [{len(subset)} samples]")


# ======================================================================
# 9. SAVE IMPROVED MODEL
# ======================================================================

v2_path = ROOT / "ml" / "smartresolve_v2_model.joblib"
joblib.dump(pipeline, v2_path)
print(f"\nImproved model saved → {v2_path}")


# ======================================================================
# 10. COMPARE WITH CURRENT PRODUCTION MODEL
# ======================================================================

prod_path = ROOT / "ml" / "smartresolve_tuned_model.joblib"

try:
    old_model = joblib.load(prod_path)
    old_pred  = old_model.predict(X_test)
    old_acc   = accuracy_score(y_test, old_pred)
    print(f"\nPrevious production accuracy : {old_acc:.4f}")
    print(f"New model accuracy           : {accuracy:.4f}")

    if accuracy > old_acc:
        joblib.dump(pipeline, prod_path)
        print("✅  New model is better — production model updated.")
    else:
        print("ℹ️   Previous model retained as production model.")
        print(f"    (Run `cp {v2_path} {prod_path}` to force a swap.)")
except FileNotFoundError:
    # No existing production model — promote this one automatically
    joblib.dump(pipeline, prod_path)
    print("✅  No previous model found — new model set as production.")

print("\nDone.")
