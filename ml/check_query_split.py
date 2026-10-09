
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split


# ==========================================
# 1. LOAD DATASET
# ==========================================

dataset_path = "ml/data/grievances_cleaned.csv"

df = pd.read_csv(dataset_path)

print("--- DATASET LOADED ---")
print("Shape:", df.shape)


# ==========================================
# 2. CREATE FEATURES AND TARGET
# ==========================================

X = df["text"]
y = df["category"]


# ==========================================
# 3. CREATE SAME TRAIN/TEST SPLIT
# ==========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)


# ==========================================
# 4. LOAD TUNED MODEL
# ==========================================

model_path = "ml/smartresolve_tuned_model.joblib"

model = joblib.load(model_path)

print("\n--- MODEL LOADED ---")
print("Model path:", model_path)


# ==========================================
# 5. QUERIES TO CHECK
# ==========================================

queries = [
    "हमारे इलाके में पानी नहीं आ रहा है",
    "There is no lighting near the public park"
]


# ==========================================
# 6. CHECK EACH QUERY
# ==========================================

for query in queries:

    print("\n" + "=" * 70)
    print("QUERY:", query)

    # --------------------------------------
    # FIND QUERY IN ORIGINAL DATASET
    # --------------------------------------

    matching_rows = df[df["text"] == query]

    if matching_rows.empty:

        print("\nQuery not found in dataset.")
        continue

    actual_categories = matching_rows["category"].unique()

    print("\nActual category/categories:")
    print(actual_categories)

    # --------------------------------------
    # CHECK TRAINING SET
    # --------------------------------------

    train_occurrences = (X_train == query).sum()

    print("\nTraining occurrences:", train_occurrences)

    # --------------------------------------
    # CHECK TEST SET
    # --------------------------------------

    test_occurrences = (X_test == query).sum()

    print("Testing occurrences:", test_occurrences)

    # --------------------------------------
    # PREDICT CATEGORY
    # --------------------------------------

    prediction = model.predict([query])[0]

    probabilities = model.predict_proba([query])[0]

    confidence = max(probabilities)

    print("\n--- MODEL PREDICTION ---")
    print("Predicted category:", prediction)
    print("Confidence:", round(float(confidence), 4))

    # --------------------------------------
    # COMPARE PREDICTION WITH TRUE LABEL
    # --------------------------------------

    if prediction in actual_categories:

        print("Result: CORRECT")

    else:

        print("Result: INCORRECT")

    # --------------------------------------
    # SHOW ALL PROBABILITIES
    # --------------------------------------

    print("\n--- ALL PROBABILITIES ---")

    for category, probability in zip(
        model.classes_,
        probabilities
    ):

        print(
            f"{category}: {round(float(probability), 4)}"
        )