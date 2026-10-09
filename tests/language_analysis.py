from pathlib import Path

import joblib
import pandas as pd

from sklearn.metrics import accuracy_score
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


# ==========================================
# 3. SPLIT DATA
# ==========================================

X = df["text"]
y = df["category"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)


# ==========================================
# 4. KEEP LANGUAGE INFORMATION
# ==========================================

test_indices = X_test.index

language_test = df.loc[
    test_indices,
    "language"
]


# ==========================================
# 5. LOAD MODEL
# ==========================================

print("\nLoading model...")

model = joblib.load(MODEL_PATH)

print("Model loaded successfully.")


# ==========================================
# 6. PREDICT
# ==========================================

predictions = model.predict(X_test)


# ==========================================
# 7. CREATE RESULT DATAFRAME
# ==========================================

results = pd.DataFrame({
    "text": X_test.values,
    "actual_category": y_test.values,
    "predicted_category": predictions,
    "language": language_test.values
})


# ==========================================
# 8. OVERALL ACCURACY
# ==========================================

overall_accuracy = accuracy_score(
    results["actual_category"],
    results["predicted_category"]
)

print("\n==========================================")
print("OVERALL ACCURACY")
print("==========================================")

print(
    f"{overall_accuracy:.4f}"
)

print(
    f"{overall_accuracy * 100:.2f}%"
)


# ==========================================
# 9. LANGUAGE-WISE ACCURACY
# ==========================================

print("\n==========================================")
print("LANGUAGE-WISE ACCURACY")
print("==========================================")

languages = sorted(
    results["language"].unique()
)

for language in languages:

    language_data = results[
        results["language"] == language
    ]

    accuracy = accuracy_score(
        language_data["actual_category"],
        language_data["predicted_category"]
    )

    print(
        f"{language:10} : "
        f"{accuracy:.4f} "
        f"({accuracy * 100:.2f}%) "
        f"[{len(language_data)} samples]"
    )


# ==========================================
# 10. LANGUAGE-WISE WRONG PREDICTIONS
# ==========================================

print("\n==========================================")
print("WRONG PREDICTIONS BY LANGUAGE")
print("==========================================")

results["correct"] = (
    results["actual_category"]
    == results["predicted_category"]
)

wrong_by_language = (
    results[~results["correct"]]
    .groupby("language")
    .size()
)

for language in languages:

    wrong_count = wrong_by_language.get(
        language,
        0
    )

    print(
        f"{language:10} : "
        f"{wrong_count} wrong predictions"
    )


# ==========================================
# 11. SHOW HINGLISH ERRORS
# ==========================================

print("\n==========================================")
print("HINGLISH ERRORS")
print("==========================================")

hinglish_errors = results[
    (results["language"] == "hinglish")
    & (~results["correct"])
]

if len(hinglish_errors) == 0:

    print("No Hinglish errors found.")

else:

    for _, row in hinglish_errors.iterrows():

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
# 12. SAVE RESULTS
# ==========================================

OUTPUT_PATH = (
    PROJECT_ROOT
    / "ml"
    / "language_analysis.csv"
)

results.to_csv(
    OUTPUT_PATH,
    index=False
)

print("\n==========================================")
print("DONE")
print("==========================================")

print(
    f"Results saved to: {OUTPUT_PATH}"
)