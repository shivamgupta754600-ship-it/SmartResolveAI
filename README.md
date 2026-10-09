# SmartResolve AI 🇮🇳

### AI-Powered Grievance Classification and Routing System

SmartResolve AI is a student-built AI/ML project designed to classify public grievances into relevant service categories and support more efficient grievance handling.

The system uses machine learning to predict a grievance category, estimate prediction confidence, and flag uncertain predictions for human review. It also stores prediction history in a MySQL database.

> **Project status:** Student prototype under development. It is not an official government grievance platform.

## ✨ Features

* **Multilingual grievance classification:** Supports English, Hindi, and Hinglish examples in the training dataset.
* **Eight grievance categories:** Classifies complaints related to water supply, waste management, streetlights, roads, electricity, education, healthcare, and other issues.
* **Machine learning:** Uses TF-IDF text features and Logistic Regression.
* **Confidence-based review:** Flags predictions below a configured confidence threshold for human review.
* **REST API:** Built using FastAPI.
* **Prediction history:** Stores grievance text, predicted category, confidence, review status, and timestamp in MySQL.
* **Modular architecture:** Separates request handling, prediction logic, and database operations.

## 🛠️ Tech Stack

* **Language:** Python
* **Machine Learning:** scikit-learn
* **Text Processing:** TF-IDF
* **Backend API:** FastAPI
* **Database:** MySQL
* **Environment Configuration:** python-dotenv
* **Model Persistence:** Joblib

## 🏗️ Architecture

The backend follows a four-layer architecture:

```text
Client
  |
  v
Route
  |
  v
Controller
  |
  v
Service
  |              |
  v              v
ML Model     Repository
                 |
                 v
               MySQL
```

* **Route:** Exposes the API endpoint.
* **Controller:** Handles request processing and response formatting.
* **Service:** Validates input, performs prediction, calculates confidence, and determines whether human review is needed.
* **Repository:** Saves prediction records to MySQL.
* **ML Model:** Predicts the grievance category using the trained text-classification pipeline.

## 📊 Model Evaluation

The current tuned model achieved **96.18% test accuracy** in the reported evaluation.

| Metric                       |        Result |
| ---------------------------- | ------------: |
| Test accuracy                |        96.18% |
| Cleaned dataset size         | 1,440 records |
| Number of categories         |             8 |
| Supported training languages |             3 |

The model was tuned using GridSearchCV. The best reported parameters were `C=10` for Logistic Regression and a unigram TF-IDF range of `(1, 1)`.

These results are from the current dataset and evaluation setup; they do not guarantee the same performance on real-world public grievances.

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd SmartResolveAI
```

Replace the placeholder with your actual GitHub repository URL.

### 2. Create and activate a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the project root with your local MySQL configuration:

```dotenv
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=smartresolve_db
```

Replace the password placeholder with your own local MySQL password. Never commit `.env` or real credentials to GitHub.

Create the `smartresolve_db` database in MySQL and ensure the required prediction-history table exists. The application must also be configured to load the environment variables.

### 5. Start the API

Run the application using the module path configured in your project. For example, if your FastAPI instance is named `app` in `app/main.py`:

```bash
uvicorn app.main:app --reload
```

### 6. Explore the API

Once the server is running, open:

```text
http://127.0.0.1:8000/docs
```

Use the interactive Swagger UI to inspect the available endpoints and test predictions.

## 📁 Project Structure

```text
SmartResolveAI/
├── app/
│   ├── controllers/
│   ├── models/
│   ├── repositories/
│   ├── routes/
│   ├── schemas/
│   ├── services/
│   ├── database.py
│   └── main.py
├── ml/
│   ├── data/
│   ├── train_model.py
│   ├── tune_model.py
│   ├── evaluate_model.py
│   └── smartresolve_tuned_model.joblib
├── tests/
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

This is the intended high-level structure. Some folders may currently be empty, and additional scripts may exist in the project root.

## 🔒 Human Review and Limitations

* Predictions are model-generated suggestions, not final administrative decisions.
* Low-confidence predictions are flagged for human review.
* The training dataset is limited and may not represent the diversity of real-world complaints, regional language variations, or spelling errors.
* Accuracy on a held-out dataset does not establish production readiness.
* A production deployment would require broader real-world evaluation, stronger security, privacy safeguards, monitoring, and a validated grievance-routing workflow.

## 🎯 Future Improvements

* Improve Hindi and Hinglish classification using more representative data.
* Expand evaluation across languages and grievance categories.
* Build a frontend for citizens and administrators.
* Add department-routing rules and human-review workflows.
* Improve monitoring, error analysis, and deployment readiness.

## 👨‍💻 About

SmartResolve AI is a learning project focused on applying machine learning, natural-language processing, backend engineering, and database integration to a practical public-service problem.

**Key learning areas:** Text classification, model evaluation, FastAPI, modular backend architecture, MySQL integration, and confidence-based human review.
