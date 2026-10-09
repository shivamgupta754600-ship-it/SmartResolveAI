import pandas as pd

dataset_path = "ml/data/grievances.csv"
df = pd.read_csv(dataset_path)

duplicates = df[df.duplicated(keep=False)]

print("\n-- DUPLICATE ROWS --")
print(duplicates.sort_values(by=["text", "language", "category"]).head(20))

print("\n-- TOTAL DUPLICATE ROWS --")
print(len(duplicates))

print("\n-- UNIQUE DUPLICATE RECORDS --")
print(duplicates.drop_duplicates().shape[0])

print("\n-- DUPLICATES BY CATEGORY --")
print(
    duplicates["category"].value_counts()
)

print("\n-- DUPLICATES BY LANGUAGE --")
print(
    duplicates["language"].value_counts()
)