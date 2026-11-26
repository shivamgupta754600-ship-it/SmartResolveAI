"""Evaluate the deployed classifier on a separately labelled pilot CSV."""
import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

from app.services.prediction import MODEL_PATH, model, suggest_category


def normalized(text):
    return " ".join(text.casefold().split())


def evaluate(path):
    if model is None:
        raise ValueError("Deployed routing model is unavailable.")
    with (MODEL_PATH.parent / "data/grievances_cleaned.csv").open(encoding="utf-8-sig") as source:
        seen = {normalized(row["text"]) for row in csv.DictReader(source)}
    groups = {}
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not {"text", "language", "category"}.issubset(reader.fieldnames or []):
            raise ValueError("Expected text, language and category columns.")
        for line, row in enumerate(reader, 2):
            text = normalized(row["text"] or "")
            category, language = row["category"], row["language"]
            if not text or text in seen:
                raise ValueError(f"Row {line} has missing, duplicate or training text.")
            if category not in model.classes_ or language not in {"hi", "en", "hinglish"}:
                raise ValueError(f"Row {line} has an unknown language or category.")
            seen.add(text)
            prediction, _ = suggest_category(row["text"])
            groups.setdefault((language, category), Counter())[prediction] += 1
    if not groups:
        raise ValueError("Pilot file has no labelled cases.")
    return {
        "model_sha256": hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest(),
        "dataset_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "groups": [{"language": language, "category": category, "total": counts.total(),
                    "correct": counts[category], "predictions": dict(sorted(counts.items()))}
                   for (language, category), counts in sorted(groups.items())],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    args = parser.parse_args()
    try:
        report = evaluate(args.csv)
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(report, ensure_ascii=False, indent=2))
