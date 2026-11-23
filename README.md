# SmartResolve AI

**AI-powered citizen grievance classification and routing system**  
Multilingual · FastAPI · React · JWT · MySQL · scikit-learn

> **Project status:** Student prototype. Not an official government platform. Predictions are AI-generated and require human review before any administrative action.

---

## Overview

SmartResolve AI lets citizens submit public grievances in **Hindi, English, or Hinglish** and instantly classifies them into one of eight municipal service categories. A calibrated ML model outputs a confidence score alongside each prediction; low-confidence cases are automatically flagged for human review. Administrators can inspect the review queue, approve or reject predictions, and add notes — all through a purpose-built React dashboard.

The project is intentionally designed as a full-stack engineering exercise:  
backend security (JWT, rate limiting, input guardrails), ML pipeline (TF-IDF + calibrated SVM), and a production-grade React frontend built with Vite + Tailwind CSS.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS 3, React Router v6, Lucide icons |
| Backend | FastAPI, Python 3.10+ |
| Auth | JWT (python-jose HS256), bcrypt (passlib) |
| Rate limiting | slowapi (20 req/min global, 10 on /predict) |
| ML | scikit-learn — TF-IDF FeatureUnion + CalibratedLinearSVC |
| Database | MySQL (raw connector, parameterized queries) |
| Config | pydantic-settings v2, python-dotenv |

---

## Architecture

The backend enforces a strict four-layer separation. No layer skips the one below it.

```
React (Vite)  ──HTTP──►  Route  ──►  Controller  ──►  Service  ──►  Repository  ──►  MySQL
                                                            └──────►  ML Model (.pkl)
```

```
app/
├── routes/          # HTTP surface — FastAPI routers, rate-limit decorators, JWT guards
├── controllers/     # Request/response shaping, error-to-HTTP-status mapping
├── services/        # Business logic — guardrails, predictions, auth flows
├── repositories/    # All SQL — parameterized queries, no ORM
├── schemas/         # Pydantic v2 request/response models
├── core/
│   ├── config.py    # Pydantic-settings; CORS origins, JWT TTL, confidence threshold
│   ├── security.py  # hash_password, verify_password, create/decode JWT
│   └── dependencies.py  # get_current_user, get_current_admin FastAPI deps
└── middleware/
    └── rate_limiter.py

frontend-react/
├── src/
│   ├── api/client.js          # Axios-style fetch wrapper; 401 → refresh → retry
│   ├── context/AuthContext.jsx
│   ├── components/            # Navbar, Toast, ProtectedRoute, CircleGauge (SVG)
│   └── pages/                 # LoginPage, DashboardPage, AdminPage
├── vite.config.js
└── tailwind.config.js

ml/
└── train_improved_model.py    # FeatureUnion pipeline, 5-fold CV, auto-promote logic

db/
└── setup.sql                  # Idempotent DDL — users + prediction_history tables
```

---

## Features

### Citizen portal
- Submit grievances in **Hindi, English, or Hinglish**
- Real-time character counter with per-character progress bar
- Animated result card — SVG circular confidence gauge, predicted category, all-category probability breakdown
- Submission history table with status badges (pending / approved / rejected)

### Admin panel
- Stats grid — total, pending, approved, rejected, needs-review count, average confidence
- Review queue tab (badge shows unread count)
- Inline row expansion: full text, CircleGauge, top-5 probability bars, quick approve/reject
- Review modal — decision toggle, notes field, submit

### Security & reliability
- **JWT authentication** — access token (30 min) + refresh token (7 days), HS256
- **bcrypt** password hashing; generic "Invalid credentials" error prevents user enumeration
- **9 input guardrails** on every prediction request:
  - Unicode NFKC normalization + control-character stripping
  - HTML/JS injection regex (`<tag>`, `javascript:`, `on*=`)
  - SQL command-sequence detection (`; DROP TABLE`, `UNION SELECT`, `' OR '1'='1`)
  - Repetition spam detection (same word 5+ times in a row)
  - Purely-numeric rejection, min/max length enforcement
- **Rate limiting** via slowapi: 20/min global, 10/min on `/predict`, 5/min on `/register`
- **CORS** origins driven by `CORS_ORIGINS_STR` env var (comma-separated list)
- All SQL uses parameterized queries — no string interpolation anywhere

### ML pipeline
- **FeatureUnion** of two TF-IDF vectorizers:
  - Word-level (1–2 grams): captures phrase-level meaning
  - `char_wb` (2–5 grams): handles Hindi transliteration, spelling variation, Hinglish
- **CalibratedClassifierCV(LinearSVC)**: wraps LinearSVC to produce calibrated `predict_proba` outputs for reliable confidence scores
- Auto-promotion: `train_improved_model.py` only replaces the production `.pkl` if 5-fold CV accuracy improves
- 8 categories: Water Supply, Electricity, Roads, Waste Management, Streetlights, Healthcare, Education, Other

---

## Model Performance

| Metric | Result |
|---|---|
| Test accuracy (current build) | **96.18 %** |
| Training set size | 1,440 records |
| Categories | 8 |
| Languages | Hindi · English · Hinglish |
| Algorithm | CalibratedClassifierCV(LinearSVC) |
| Features | TF-IDF word (1–2 gram) + char_wb (2–5 gram) |

Accuracy is measured on a held-out split of the current dataset. It does not guarantee the same performance on real-world grievances with broader language variation or spelling errors.

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL 8.0+

### 1. Clone

```bash
git clone https://github.com/shivamgupta754600-ship-it/SmartResolveAI.git
cd SmartResolveAI
```

### 2. Database setup

```bash
mysql -u root -p < db/setup.sql
```

This creates the `smartresolve_db` database plus the `users` and `prediction_history` tables idempotently — safe to re-run.

### 3. Backend

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

```dotenv
# .env — never commit this file
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=smartresolve_db

SECRET_KEY=your-256-bit-secret   # generate with: openssl rand -hex 32
CORS_ORIGINS_STR=http://localhost:5173,http://localhost:3000
CONFIDENCE_THRESHOLD=0.75
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

Start the API:

```bash
uvicorn app.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/health
```

### 4. Frontend

```bash
cd frontend-react
npm install
npm run dev
# → http://localhost:5173
```

The API client proxies requests to `http://localhost:8000` — make sure the backend is running first.

### 5. Train / retrain the ML model (optional)

```bash
python ml/train_improved_model.py
```

The script evaluates the new model against the current production `.pkl` via 5-fold cross-validation and replaces it only if accuracy improves.

---

## API Reference

All grievance routes require a valid Bearer token. Admin routes additionally require `is_admin = true`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register a new citizen account |
| POST | `/auth/login` | — | Login; returns access + refresh tokens |
| POST | `/auth/refresh` | — | Exchange refresh token for new access token |
| GET | `/auth/me` | User | Current user profile |
| POST | `/predict` | User | Classify a grievance text |
| GET | `/history` | User | Current user's submission history |
| GET | `/admin/all` | Admin | All predictions across all users |
| GET | `/admin/review` | Admin | Predictions flagged for human review |
| PUT | `/admin/{id}` | Admin | Approve or reject a prediction |
| GET | `/health` | — | Service health check |

---

## Security Notes

- Passwords are never stored or logged in plaintext
- Login errors return a generic message regardless of which field is wrong (prevents user enumeration)
- The `SECRET_KEY` must be set via environment variable — the application will not start with the default placeholder in production
- `.env` is in `.gitignore`; only `.env.example` (no real values) is committed
- All database queries use parameterized statements — no raw string interpolation

---

## Limitations

- Training data is limited and curated — real-world grievances will have more noise, regional dialects, and domain shift
- The admin review workflow is manual; no routing or escalation rules are implemented
- No email notifications, file attachments, or status tracking for citizens beyond the history table
- Not production-hardened: no TLS termination config, no structured logging, no observability instrumentation

---

## Project Structure (full)

```
SmartResolveAI/
├── app/
│   ├── controllers/
│   │   ├── auth_controller.py
│   │   └── grievance_controller.py
│   ├── core/
│   │   ├── config.py
│   │   ├── dependencies.py
│   │   └── security.py
│   ├── middleware/
│   │   └── rate_limiter.py
│   ├── repositories/
│   │   ├── prediction.py
│   │   └── user.py
│   ├── routes/
│   │   ├── auth_routes.py
│   │   └── grievance_routes.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── grievance.py
│   │   └── grievance_response.py
│   ├── services/
│   │   ├── auth.py
│   │   └── prediction.py
│   ├── database.py
│   └── main.py
├── db/
│   └── setup.sql
├── frontend-react/
│   ├── src/
│   │   ├── api/client.js
│   │   ├── components/
│   │   ├── context/
│   │   └── pages/
│   ├── package.json
│   └── vite.config.js
├── ml/
│   └── train_improved_model.py
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

---

*Student project · Not an official government platform · Predictions require human review*
