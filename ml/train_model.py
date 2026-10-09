import pandas as pd
import joblib
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay
)


#1 load the cleaned dataset

dataset_path = "ml/data/grievances_cleaned.csv"

df = pd.read_csv(dataset_path)

print("dataset loaded")
print("Shape:", df.shape)

# Separation of feature and Target
X = df["text"]
y = df["category"]

# Spliting of dataset into training and testing.
X_train,X_test,y_train,y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\n Data Split")
print("Training examples:", len(X_train))
print("Testing examples:", len(X_test))

# Machine learning Pipeline

model = Pipeline([
    (
        "tfidf",
        TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2)
        )
    ),
    (
        "classifier",
        LogisticRegression(
            C=10,
            max_iter=1000,
            random_state=42,
            
            
        )
    )
])

# Train the model

model.fit(X_train, y_train)
print("Training completed successfully!")

# make predictions
y_pred = model.predict(X_test)


# evaluate the model

accuracy = accuracy_score(y_test, y_pred)
print("Accuracy:", accuracy)

print(classification_report(y_test, y_pred, zero_division=0))


# create confusion matrix
print("\n-- CONFUSION MATRIX --")
cm = confusion_matrix(
    y_test,
    y_pred,
    labels = model.classes_
)

print(cm)

# Display confusion matrix graph

disp = ConfusionMatrixDisplay(
    confusion_matrix=cm,
    display_labels=model.classes_
)

disp.plot(
    xticks_rotation="vertical"
)

plt.title("SmartResolve AI - Confusion Matrix")
plt.tight_layout()
plt.show()

# Save the trained model

model_path = "ml/smartresolve_baseline_model.joblib"
joblib.dump(model, model_path)

print("model saved")
print("model_path:", model_path)