import pandas as pd 

from sklearn.model_selection import train_test_split

#1. LOAD CLEANED DATASET
dataset_path = "ml/data/grievances_cleaned.csv"

df = pd.read_csv(dataset_path)

print("-- DATASET LOADED --")
print("shape:", df.shape)

X= df["text"]
y= df["category"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)


print("\n-- DATA SPLIT --")
print("Training examples:",len(X_train))
print("Testing examples:", len(X_test))

print("\n-- TRAINING CATEGORY DISTRIBUTION --")
print(y_train.value_counts())

print("\n-- TESTING CATEGORY DISTRIBUTION --")
print(y_test.value_counts())