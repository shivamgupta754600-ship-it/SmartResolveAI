
import pandas as pd

# File paths
input_path = "ml/data/grievances.csv"
output_path = "ml/data/grievances_cleaned.csv"

# Load the dataset
df = pd.read_csv(input_path)

print("--- ORIGINAL DATASET ---")
print("Shape:", df.shape)

# 1. Remove accidental header rows
df = df[
    (df["text"] != "text") &
    (df["language"] != "language") &
    (df["category"] != "category")
].copy()

# 2. Standardize language labels
df["language"] = df["language"].str.strip().str.lower()

df["language"] = df["language"].replace({
    "hi-en": "hinglish"
})

# 3. Remove leading/trailing spaces from text and category
df["text"] = df["text"].str.strip()
df["category"] = df["category"].str.strip().str.lower()

# 4. Remove exact duplicate rows
df = df.drop_duplicates().reset_index(drop=True)

# 5. Display the cleaned dataset information
print("\n--- CLEANED DATASET ---")
print("Shape:", df.shape)

print("\n--- LANGUAGE DISTRIBUTION ---")
print(df["language"].value_counts())

print("\n--- CATEGORY DISTRIBUTION ---")
print(df["category"].value_counts())

print("\n--- MISSING VALUES ---")
print(df.isnull().sum())

print("\n--- DUPLICATE ROWS ---")
print(df.duplicated().sum())

# 6. Save cleaned dataset
df.to_csv(output_path, index=False)

print("\nCleaned dataset saved successfully!")
print("File:", output_path)