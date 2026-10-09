
import pandas as pd
import joblib
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay
)


# ==========================================
# 1. LOAD DATASET
# ==========================================

dataset_path = "ml/data/grievances_cleaned.csv"

df = pd.read_csv(dataset_path)

print("--- DATASET LOADED ---")
print("Shape:", df.shape)


# ==========================================
# 2. SEPARATE FEATURES AND TARGET
# ==========================================

X = df["text"]
y = df["category"]


# ==========================================
# 3. CREATE THE SAME TEST SPLIT
# ==========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\n--- DATA SPLIT ---")
print("Training examples:", len(X_train))
print("Testing examples:", len(X_test))


# ==========================================
# 4. LOAD SAVED TUNED MODEL
# ==========================================

model_path = "ml/smartresolve_tuned_model.joblib"

model = joblib.load(model_path)

print("\n--- MODEL LOADED ---")
print("Model path:", model_path)


# ==========================================
# 5. MAKE PREDICTIONS
# ==========================================

y_pred = model.predict(X_test)


# ==========================================
# 6. EVALUATE MODEL
# ==========================================

accuracy = accuracy_score(y_test, y_pred)

print("\n--- MODEL EVALUATION ---")
print("Accuracy:", accuracy)

print("\n--- CLASSIFICATION REPORT ---")

print(
    classification_report(
        y_test,
        y_pred,
        zero_division=0
    )
)


# ==========================================
# 7. CREATE CONFUSION MATRIX
# ==========================================

print("\n--- CONFUSION MATRIX ---")

labels = model.classes_

cm = confusion_matrix(
    y_test,
    y_pred,
    labels=labels
)

print(cm)


# ==========================================
# 8. DISPLAY CONFUSION MATRIX
# ==========================================

disp = ConfusionMatrixDisplay(
    confusion_matrix=cm,
    display_labels=labels
)

fig, ax = plt.subplots(figsize=(10, 8))

disp.plot(
    ax=ax,
    xticks_rotation="vertical",
    cmap="Blues",
    values_format="d"
)

plt.title("SmartResolve AI - Tuned Model Confusion Matrix")

plt.tight_layout()

plt.show()


# ==========================================
# 9. ERROR ANALYSIS
# ==========================================

print("\n--- ERROR ANALYSIS ---")

error_analysis = pd.DataFrame({
    "text": X_test.values,
    "actual_category": y_test.values,
    "predicted_category": y_pred
})

errors = error_analysis[
    error_analysis["actual_category"]
    != error_analysis["predicted_category"]
].copy()

print("Total incorrect predictions:", len(errors))

print("\nIncorrect predictions:")

if len(errors) > 0:
    print(errors.to_string(index=False))
else:
    print("No incorrect predictions found.")


# ==========================================
# 10. SAVE ERROR ANALYSIS
# ==========================================

error_path = "ml/data/error_analysis.csv"

errors.to_csv(
    error_path,
    index=False
)

print("\n--- ERROR ANALYSIS SAVED ---")
print("Error file:", error_path)


# ==========================================
# 11. SAVE EVALUATION SUMMARY
# ==========================================

summary = pd.DataFrame({
    "metric": [
        "accuracy",
        "total_test_examples",
        "incorrect_predictions"
    ],
    "value": [
        accuracy,
        len(y_test),
        len(errors)
    ]
})

summary_path = "ml/data/evaluation_summary.csv"

summary.to_csv(
    summary_path,
    index=False
)

print("\n--- EVALUATION SUMMARY SAVED ---")
print("Summary file:", summary_path)