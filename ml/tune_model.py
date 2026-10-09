
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

from sklearn.metrics import (
    accuracy_score,
    classification_report
)


# 1. LOAD DATASET

dataset_path = "ml/data/grievances_cleaned.csv"

df = pd.read_csv(dataset_path)

print("--- DATASET LOADED ---")
print("Shape:", df.shape)


# 2. SEPARATE FEATURES AND TARGET

X = df["text"]
y = df["category"]


# 3. SPLIT DATASET

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


# 4. CREATE PIPELINE

pipeline = Pipeline([
    (
        "tfidf",
        TfidfVectorizer(
            lowercase=True
        )
    ),

    (
        "classifier",
        LogisticRegression(
            max_iter=1000,
            random_state=42
        )
    )
])


# 5. DEFINE PARAMETERS FOR SEARCH

param_grid = {
    "tfidf__ngram_range": [
        (1, 1),
        (1, 2),
        (1, 3)
    ],

    "classifier__C": [
        0.1,
        1,
        10
    ]
}


# 6. CREATE GRID SEARCH

grid_search = GridSearchCV(
    estimator=pipeline,
    param_grid=param_grid,
    cv=5,
    scoring="f1_macro",
    n_jobs=-1,
    verbose=1
)


# 7. TRAIN GRID SEARCH


print("\n--- STARTING GRID SEARCH ---")

grid_search.fit(X_train, y_train)

print("\n--- GRID SEARCH COMPLETED ---")


# 8. DISPLAY BEST PARAMETERS

print("\n--- BEST PARAMETERS ---")

print(grid_search.best_params_)

print("\nBest cross-validation score:")
print(grid_search.best_score_)


# 9. EVALUATE BEST MODEL ON TEST DATA

best_model = grid_search.best_estimator_

y_pred = best_model.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)

print("\n--- FINAL MODEL EVALUATION ---")

print("Test Accuracy:", accuracy)

print("\n--- CLASSIFICATION REPORT ---")

print(
    classification_report(
        y_test,
        y_pred,
        zero_division=0
    )
)


# 10. SAVE TUNED MODEL

model_path = "ml/smartresolve_tuned_model.joblib"

joblib.dump(best_model, model_path)

print("\n--- TUNED MODEL SAVED ---")

print("Model path:", model_path)