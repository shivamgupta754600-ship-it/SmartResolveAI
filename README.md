# SmartResolve AI

**AI-powered citizen grievance classification and routing system**  
Multilingual · FastAPI · React · JWT · MySQL · scikit-learn

> **Project status:** Student prototype. Not an official government platform. Predictions are AI-generated and require human review before any administrative action.

---

## Overview

The React home page provides resident intake and case tracking. See the [municipal case pilot](#municipal-case-pilot) for staff setup and deployment. The original prediction demo is described below.

SmartResolve AI lets citizens submit public grievances in **Hindi, English, or Hinglish** and instantly classifies them into one of eight municipal service categories. A calibrated ML model outputs a confidence score alongside each prediction; low-confidence cases are automatically flagged for human review. Administrators can inspect the review queue, approve or reject predictions, and add notes — all through a purpose-built React dashboard.

The project is intentionally designed as a full-stack engineering exercise:  
backend security (JWT, rate limiting, input guardrails), ML pipeline (TF-IDF + calibrated SVM), and a production-grade React frontend built with Vite + Tailwind CSS.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS 3, React Router v6, Lucide icons |
| Backend | FastAPI, Python 3.10+ |
| Auth | JWT (PyJWT HS256), bcrypt (passlib) |
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
- Node.js 22.12+
- MySQL 8.0+

### 1. Clone

```bash
git clone https://github.com/shivamgupta754600-ship-it/SmartResolveAI.git
cd SmartResolveAI
```

### 2. Database setup

```bash
mysql -u root -p < db/setup.sql
mysql -u root -p smartresolve_db < db/cases.sql
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
- The `SECRET_KEY` must be set via environment variable — the application will not start with a missing, short, or placeholder signing key
- `.env` is in `.gitignore`; only `.env.example` (no real values) is committed
- All database queries use parameterized statements — no raw string interpolation

---

## Prediction demo limitations

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

## Municipal case pilot

The React home page opens the municipal case portal. Residents can report an issue
after signing in and completing their resident profile. Tracking uses a ticket number and private receipt.
The previous classifier dashboard is available at `/login`. The municipal workspace
at `/staff` uses a separate password and authenticator login, with roles per ward
and department. The prototype admin flag does not grant access to municipal cases.

### Set up the pilot

1. Apply `db/setup.sql` for a fresh database. Apply `db/cases.sql` to that database.
   Apply `db/cases-pilot.sql` to create a sample ward and Water Supply and Waste
   Management departments. Configure official names, jurisdictions and response times
   with the agency before using real reports.
2. Create staff accounts through the existing registration API or provision accounts
   through the agency's onboarding process. The following statement grants the water
   supervisor scope to an existing account named `pilot_supervisor`.

   ```sql
   INSERT INTO case_staff (user_id, ward, department, role)
   SELECT id, 'pilot', 'water', 'supervisor' FROM users WHERE username = 'pilot_supervisor';
   ```

   Use `intake` for desk and phone operators, `officer` for departmental case work,
   and `supervisor` for transfers, assigning other officers and deciding reopening
   requests. Staff the receiving department before transferring a case.
3. Generate a unique authenticator secret per staff account using
   `python -c 'import base64,secrets; print(base64.b32encode(secrets.token_bytes(20)).decode())'`.
   Enroll it using the authenticator's manual entry mode with time-based, six-digit,
   30-second codes. Provision secrets privately in `CASE_STAFF_TOTP_SECRETS` as a
   JSON object keyed by username. Remove the staff scope and rotate or remove the
   secret when offboarding. Restart API processes after updating environment secrets.
4. Start FastAPI and the React frontend as described above. In development Vite proxies
   `/api` to port 8000. For deployment, serve the React build over HTTPS with SPA
   fallback, and proxy `/api/*` to FastAPI while stripping the `/api` prefix.
   Set `CASE_PUBLIC_DEPLOYMENT=true` with a generated signing key. Keep proxy and
   application logs free of case text, request bodies, receipt codes, and auth headers.
5. Schedule `python -m app.services.case_worker` every minute with overlapping runs
   disabled. It marks late cases for supervisor review, calculates advisory suggestions,
   and drains optional SMS notifications. A worker or model outage does not block
   submissions. After restoring the model, use the worker's `--retry-unavailable`
   flag to retry unavailable suggestions. Supervisors can view overdue cases in the workspace.

### SMS, accessibility and handling

The SMS worker posts `{"to":"<E.164 mobile>","message":"<generic update>"}` to
`CASE_SMS_WEBHOOK` using `CASE_SMS_TOKEN` and a stable `Idempotency-Key` header.
The agency's gateway must deduplicate that key, enforce verified opt-in and sending
limits, and return a successful HTTP response only on acceptance. Delivery is off
until both variables are set. The generic update omits the case description, ticket
and private receipt. Inspect `case_sms` for rows that exhaust retries.

The resident screens and standard status text are available in English and Hindi.
Staff should write messages in the resident's chosen language. Assisted intake
records calls and help desk reports in the same queue. Staff must privately give
residents both receipt values. Treat a receipt as a password. A lost receipt cannot
be reconstructed. Establish an agency-approved recovery process before handling
real grievances.

Before public launch, validate the journey with residents using screen readers,
keyboards, low-end devices and slow connections. Confirm which offices own each
queue, who reviews overdue cases and reopening requests, and how existing
government grievance channels receive referrals. Review applicable accessibility,
privacy, and security requirements with the agency, and protect the database and
its backups with encryption, restricted access, and monitoring.

### Retention and restore

After the agency approves retention, schedule
`python -m app.services.case_worker --purge-resolved-days DAYS` with its chosen
period. It deletes up to 500 eligible resolved cases and their event/SMS records
per invocation. Open cases and pending reopen requests remain in the queue.

Use a restricted MySQL backup account and encrypted storage. On a clean restore
database, import a recent `mysqldump --single-transaction` and compare case, event,
and outbox row counts. For an isolated restore drill on the same MySQL instance,
add `--set-gtid-purged=OFF` to the dump. Repeat a receipt lookup and staff queue check in the restored
environment with SMS disabled. Record the recovery time and confirm the agency can
meet its recovery requirements before launch.

### Daily work, incident reports and field visits

For existing pilot databases, reapply `db/cases.sql` to add incident membership
and optional message drafting times. My work today orders tickets by update deadline.
Due today uses India time. The supervisor filter includes open cases with no owner,
a missed deadline, two or more transfers, or a reopening request.

Officers can open a ticket's field view to record a visit or blocker with a public
message and a future update time. They can edit a Hindi or English template before
posting. Supervisor metrics include time to first public staff action and an estimate
of drafting time measured from message focus or template selection through submission.

Related reports suggests open cases in the same ward and service with a matching
landmark within 72 hours. Staff confirm a ticket before linking. Shared updates
appear on each open linked ticket in the resident's chosen language. Existing
ownership permissions apply to every affected ticket. Transferring a case removes
its incident membership.

### Municipal office records

Reapply `db/cases.sql` before enabling office records. In the supervisor workspace,
open **Ward review and service register** to verify the office, designation,
escalation contact and elapsed-hour resolution target for a ward/service. Add a
named landmark for an asset-specific rule. Filing matches the exact locality or
the ward default. Rules are versioned and each matching new case keeps its original
target through transfers. Earlier and unmatched cases show no configured target.

Configure a formal first appeal only for services whose verified local rule fits
the supported calendar: elapsed hours for resolution and calendar days to file from
closure or expiry of the original target, whichever occurs first. Reviewers must be
active supervisors in the configured unit. Working-day calendars, higher appeal
levels and external filing systems require agency-specific implementation.

Staff can record external referrals and manual acknowledgements, revise a resolution
estimate with a public reason, and review and publish a printable Action Taken Report.
These records appear in resident receipt tracking. The weekly sheet is a printable
live list, oldest first, for the signed-in supervisor's jurisdictions.

### Complaint photo evidence

Resident and assisted intake accept one optional still JPEG, PNG or WebP photo
(up to 5 MiB and 24 megapixels). The API validates and decodes it, applies
orientation, removes metadata and stores a JPEG display copy up to 1600 pixels on
its longest edge. The case and photo are saved in the same transaction. Residents
can view the copy using their private receipt, and authorized officers can open it
from the case. Deleting a case also removes the photo.

Install the updated Python requirements and reapply `db/cases.sql` on existing
databases. Allow at least 7 MiB for case intake requests at the reverse proxy to
accommodate JSON encoding.


### Resident accounts and identity references

Apply the updated `db/cases.sql` for the resident profile and case ownership tables.
Existing citizen accounts can sign in at the municipal portal. Before a new filing,
residents supply their name, Indian mobile number, document type and the last four
characters of Aadhaar, voter ID, passport, driving licence or another government ID.
This is self-declared information. Government identity
verification is not integrated. Complaint staff see the resident's name and contact
number on the scoped case detail. SMS updates remain opt-in.

For assisted filing, a resident generates a single-use code from their profile.
A successful desk or phone filing consumes it and links the ticket to their account.
The code expires after 30 minutes. Earlier tickets continue to work with the original
private receipt and are not automatically attributed to an account.

### Mobile verification and CAPTCHA

Apply `db/cases.sql` before enabling registrations. The default
`PHONE_VERIFICATION_REQUIRED=false` allows registration and filing with a
self-declared mobile number. The portal skips CAPTCHA and OTP, and the API disables
the verification endpoints. Changing a verified number in this mode clears its
verified status.

To enable verification later, configure a Cloudflare Turnstile
widget for the portal hostname. Put the public `VITE_TURNSTILE_SITE_KEY` in the
frontend build environment (or `frontend-react/.env.local`). Set the server-only
`TURNSTILE_SECRET_KEY` and comma-separated `TURNSTILE_HOSTNAMES` on FastAPI.
The API checks the challenge token, hostname and action before sending an SMS.

Configure `OTP_SMS_WEBHOOK` with an HTTPS endpoint for the agency's transactional
SMS provider and `OTP_SMS_TOKEN` with its bearer credential. The gateway receives
JSON containing `to` in +91 format and `message`, with an Idempotency-Key header.
Keep codes, proofs, SMS payloads and provider credentials out of logs.
A randomly generated application SECRET_KEY is required for production.

After configuring both providers, set `PHONE_VERIFICATION_REQUIRED=true`,
restart the API and deploy the frontend built with the site key. In this mode,
registration requires an SMS code valid for five minutes. Each code allows five
guesses. Resends require another CAPTCHA, have a 60-second cooldown and are limited
to five per number per 24-hour window. Verification grants a single-use proof valid
for ten minutes. Existing accounts retain login access and verify their contact
number in the resident profile before filing. Changing the contact number requires
a fresh code. This verifies control of a phone number and leaves ID references
self-declared.


### Session and request protections

Apply `db/cases.sql` when upgrading to create the session registry. Resident and
staff tokens are checked against an active database session. Signing out online
revokes the session; offline sign-out clears the browser session locally. Earlier
tokens without a session ID require a fresh sign-in. Each deployment must supply
its own randomly generated `SECRET_KEY`, including local development.

The API accepts up to 7 MiB for intake with photos and 128 KiB for other writes.
Account, case and prediction API responses use no-store caching. Optional SMS
updates require a verified contact number. Deferred verification still supports
registration, complaint filing and private receipt tracking.

### Pilot operations

Apply `db/cases.sql` to the pilot database. A signed-in resident can open a linked ticket under **My complaints** to read its public timeline, view evidence, reply, reopen a resolved case or appeal an eligible decision. Older cases without an owner link remain accessible with their private receipt.

In **Staff → Supervisor metrics**, select **Check worker, SMS and staffing**. The worker records completion after processing escalations, classification and the delivery queue. Investigate a missing or stale run, a growing oldest-message age, or exhausted retries. The staffing count includes active accounts assigned an officer or supervisor role. At onboarding, have each office verify its ward, departments, primary handler, backup and escalation contact. Rehearse one transfer and confirm the receiving officer can open the original ticket and see its history.

For multiple API processes, install `requirements-redis.txt`, configure `RATE_LIMIT_STORAGE_URI` to the same private Redis database on every process, and restrict Redis access to the service. Use an authenticated TLS connection for remote Redis. Set trusted proxy addresses on the API server to match the actual reverse proxy so client-IP limits apply correctly.

#### Assisted recovery

The office must approve the identity check and record a help-desk reference. Use an individually attributed operations database login. A receipt, a self-declared ID suffix, or an unverified phone alone is insufficient to authorize a reset.

* For an active resident, run `python -m app.services.account_recovery resident_password USERNAME REFERENCE` on a trusted terminal. Have the resident privately enter their new password twice. Verify login, help update their phone in the resident profile, and check that their linked complaints are present.
* For a lost staff authenticator, disable the affected login during recovery. Replace its individual TOTP secret in the deployment secret store and reload all API processes. Use the approved staff identity check and a private channel to enrol the replacement authenticator. Before restoring service to the account, revoke its sessions with `python -m app.services.account_recovery revoke_sessions USERNAME REFERENCE`. Check a new MFA login and the officer's ward permissions. The revocation command also supports disabled accounts.

#### Encrypted backups and pilot evaluation

Run `bash ops/backup.sh /secure/mysql.cnf smartresolve_db /secure/office-public-cert.pem /backups/pilot.cms` using MySQL client tools and OpenSSL 3. Use a new output path for each run. Transfer the encrypted output to the agency's off-host backup destination and keep the matching RSA private key separately. On an isolated host with SMS disabled, decrypt using `openssl cms -decrypt -binary -inform DER -in pilot.cms -recip office-public-cert.pem -inkey office-private-key.pem` and pipe the output to a fresh MySQL database. Enable shell `pipefail`, verify both commands succeeded, compare row counts, and check a resident timeline and staff queue before accepting the restore. Invalidate restored sessions before serving users.

For the routing pilot, have office staff label a later batch of de-identified complaints without seeing model suggestions. Keep this batch out of training and model selection. Run `python -m ml.evaluate_pilot /secure/pilot.csv` with UTF-8 columns `text,language,category`. Use `en`, `hi`, or `hinglish` and the department category labels from training. The JSON report includes input and model hashes and predicted counts per language and true category. The evaluator rejects exact normalized duplicates and overlap with the cleaned training corpus. Office staff must check time separation and near-duplicates when preparing the batch.

### India-wide complaint intake

Reapply `db/cases.sql` before deploying. In the complaint form, choose **Choose by state or union territory**. The form covers all 28 states and eight union territories. Residents enter their district, village, town or city, and can provide their tehsil, taluka or subdivision and gram panchayat or ward. Names are entered manually, including in local scripts.

For each state and service, create or select a dedicated intake queue in `service_wards`, assign its verified officers through `case_staff`, and add a row to `india_intake_routes` with `state_name`, `department`, and `ward`. Use the exact state name returned by `GET /cases/catalog`. Each mapped queue must have an active officer or supervisor. Staff receive the submitted administrative area in the case detail and coordinate with the local body. Existing ward-based intake remains available. This mapping is per state and service. District and village names are collected for follow-up and do not automatically select a local office.
