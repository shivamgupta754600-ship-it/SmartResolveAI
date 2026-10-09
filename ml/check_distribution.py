import pandas as pd

# Load dataset
dataset_path = "ml/data/grievances.csv"
df = pd.read_csv(dataset_path)

# Category distribution
print("\n --CATEGORY DISTRIBUTION --")
print(df["category"].value_counts())

#Language Distribution
print("\n-- LANGUAGE DISTRIBUTION --")
print(df["language"].value_counts())

# CATEGORY AND LANGUAGE COMBINATION
print("\n-- CATEGORY BY LANGUAGE --")
print(
    pd.crosstab(
        df["category"],
        df["language"]
    )
)