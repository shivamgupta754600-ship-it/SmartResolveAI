from pathlib import Path

import joblib
import pandas as pd

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)
from sklearn.model_selection import train_test_split


# ==========================================
# 1. PATHS
# ==========================================

PROJECT_ROOT = Path(__file__).resolve().parent

DATA_PATH = (
    PROJECT_ROOT
    / "ml"
    / "data"
    / "grievances_cleaned.csv"
)

MODEL_PATH = (
    PROJECT_ROOT
    / "ml"
    / "smartresolve_tuned_model.joblib"
)


# ==========================================
# 2. LOAD DATA
# ==========================================

print("\nLoading dataset...")

df = pd.read_csv(DATA_PATH)

print("Dataset shape:", df.shape)
print("Columns:", list(df.columns))


# ==========================================
# 3. PREPARE DATA
# ==========================================

X = df["text"]
y = df["category"]


# ==========================================
# 4. SAME TYPE OF STRATIFIED SPLIT
# ==========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)


# ==========================================
# 5. LOAD TRAINED MODEL
# ==========================================

print("\nLoading trained model...")

model = joblib.load(MODEL_PATH)

print("Model loaded successfully.")


# ==========================================
# 6. PREDICT TEST DATA
# ==========================================

print("\nRunning predictions...")

predictions = model.predict(X_test)


# ==========================================
# 7. OVERALL ACCURACY
# ==========================================

accuracy = accuracy_score(
    y_test,
    predictions
)

print("\n==========================================")
print("OVERALL ACCURACY")
print("==========================================")

print(f"Accuracy: {accuracy:.4f}")
print(f"Accuracy: {accuracy * 100:.2f}%")


# ==========================================
# 8. CLASSIFICATION REPORT
# ==========================================

print("\n==========================================")
print("CLASSIFICATION REPORT")
print("==========================================")

print(
    classification_report(
        y_test,
        predictions,
        zero_division=0
    )
)


# ==========================================
# 9. CONFUSION MATRIX
# ==========================================

labels = sorted(y.unique())

cm = confusion_matrix(
    y_test,
    predictions,
    labels=labels
)

cm_df = pd.DataFrame(
    cm,
    index=labels,
    columns=labels
)

print("\n==========================================")
print("CONFUSION MATRIX")
print("==========================================")

print(cm_df)


# ==========================================
# 10. FIND WRONG PREDICTIONS
# ==========================================

error_df = pd.DataFrame({
    "text": X_test.values,
    "actual_category": y_test.values,
    "predicted_category": predictions
})

error_df = error_df[
    error_df["actual_category"]
    != error_df["predicted_category"]
]


print("\n==========================================")
print("WRONG PREDICTIONS")
print("==========================================")

print(
    f"Total wrong predictions: {len(error_df)}"
)

print(
    f"Total test examples: {len(X_test)}"
)


# ==========================================
# 11. SHOW FIRST 30 ERRORS
# ==========================================

print("\n==========================================")
print("FIRST 30 ERRORS")
print("==========================================")

for index, row in error_df.head(30).iterrows():

    print("\n------------------------------------------")

    print("Text:")
    print(row["text"])

    print(
        "Actual:",
        row["actual_category"]
    )

    print(
        "Predicted:",
        row["predicted_category"]
    )


# ==========================================
# 12. MOST COMMON CONFUSIONS
# ==========================================

print("\n==========================================")
print("MOST COMMON CATEGORY CONFUSIONS")
print("==========================================")

confusions = (
    error_df
    .groupby(
        [
            "actual_category",
            "predicted_category"
        ]
    )
    .size()
    .reset_index(name="count")
    .sort_values(
        "count",
        ascending=False
    )
)

print(confusions.to_string(index=False))


# ==========================================
# 13. SAVE ERROR ANALYSIS
# ==========================================

OUTPUT_PATH = (
    PROJECT_ROOT
    / "ml"
    / "error_analysis.csv"
)

error_df.to_csv(
    OUTPUT_PATH,
    index=False
)

print("\n==========================================")
print("DONE")
print("==========================================")

print(
    f"Error file saved to: {OUTPUT_PATH}"
)