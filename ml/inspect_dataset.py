import pandas as pd

dataset_path = "ml/data/grievances.csv"

df = pd.read_csv(dataset_path)

print("\n--First Five Rows--")
print(df.head())

print("\n-- DATASET SHAPE --")
print(df.shape)

print("\n-- COLUMN NAMES --")
print(df.columns.tolist())

print("\n-- DATA TYPES --")
print(df.dtypes)

print("\n-- MISSING VALUES --")
print(df.isnull().sum())

print("\n-- DUPLICATE ROWS --")
print(df.duplicated().sum())

print("\n-- DATASET INFORMATION --")
df.info()