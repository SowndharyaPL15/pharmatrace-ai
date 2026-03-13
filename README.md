# 💊 PharmaTrace AI
### Intelligent Medicine Quality Testing, Authentication & Supply Chain Monitoring System

---

## 🚀 Quick Start (5 Steps)

### Prerequisites
- Node.js v18+
- PostgreSQL 14+
- Python 3.9+

---

### Step 1 — Install Node Dependencies
```bash
cd pharmatrace-ai
npm install
```

### Step 2 — Create PostgreSQL Database
```bash
psql -U postgres -c "CREATE DATABASE pharmatrace;"
psql -U postgres -d pharmatrace -f sql/schema.sql
```

### Step 3 — Configure Environment
Edit `.env` with your database password:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pharmatrace
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD_HERE
SESSION_SECRET=pharmatrace_super_secret_2024
PORT=3000
AI_SERVICE_URL=http://localhost:5001
```

### Step 4 — Start AI Microservice (Terminal 1)
```bash
cd ai_service
pip install -r requirements.txt
python fraud_detection.py
# Running on http://localhost:5001
```

### Step 5 — Start Main Server (Terminal 2)
```bash
cd ..
node server.js
# Running on http://localhost:3000
```

### Open Browser
```
http://localhost:3000
```

---

## 👤 Test Accounts

Register accounts via the UI at `/register`, then set admin role manually:

```sql
-- In psql:
UPDATE users SET role='admin' WHERE email='admin@yourdomain.com';
```

| Role | Purpose |
|------|---------|
| admin | Full system access, analytics, alert management |
| manufacturer | Register medicine batches, view own inventory |
| inspector | Submit quality test results |
| distributor | Transfer medicines in supply chain |
| pharmacy | Receive and confirm medicines |
| hospital | Receive medicines from pharmacy |
| consumer | Verify medicines via QR/Batch ID |

---

## 🗂️ Project Structure

```
pharmatrace-ai/
├── server.js               # Main Express server
├── package.json
├── .env                    # Environment config
├── config/
│   └── database.js         # PostgreSQL pool
├── routes/
│   ├── authRoutes.js
│   ├── medicineRoutes.js
│   ├── testingRoutes.js
│   ├── supplyRoutes.js
│   └── adminRoutes.js
├── controllers/
│   ├── authController.js
│   ├── medicineController.js
│   ├── testingController.js
│   ├── supplyController.js
│   └── alertController.js
├── models/
│   ├── userModel.js
│   ├── medicineModel.js
│   └── testModel.js
├── views/
│   ├── partials/navbar.ejs
│   ├── login.ejs
│   ├── register.ejs
│   ├── dashboard.ejs
│   ├── medicines.ejs
│   ├── addMedicine.ejs
│   ├── testMedicine.ejs
│   ├── verifyMedicine.ejs
│   ├── supplyChain.ejs
│   ├── supplyHistory.ejs
│   ├── alerts.ejs
│   ├── adminAnalytics.ejs
│   ├── adminUsers.ejs
│   ├── adminInventory.ejs
│   └── 404.ejs
├── public/
│   ├── css/style.css
│   ├── js/charts.js
│   └── qrcodes/            # Auto-generated QR code images
├── ai_service/
│   ├── fraud_detection.py  # Flask + IsolationForest
│   └── requirements.txt
└── sql/
    └── schema.sql          # PostgreSQL schema
```

---

## 🌐 Application Routes

| URL | Description |
|-----|-------------|
| `/` | Redirects to login or dashboard |
| `/login` | Login page |
| `/register` | Registration page |
| `/dashboard` | Main dashboard |
| `/medicines` | List all batches |
| `/medicines/add` | Register new batch |
| `/testing` | Quality testing form |
| `/supply` | Initiate transfer |
| `/supply/history` | Transfer history |
| `/verify` | Public verification page |
| `/verify/:batchId` | Direct batch verification |
| `/admin/analytics` | Analytics dashboard (admin) |
| `/admin/alerts` | Alert management (admin) |
| `/admin/users` | User management (admin) |
| `/admin/inventory` | Inventory overview (admin) |
| `/admin/api/who-verify/:id` | WHO mock API |

---

## ✅ Features Implemented

| Feature | Status |
|---------|--------|
| User Registration & Login (bcrypt) | ✅ |
| 7 Roles with Session-based RBAC | ✅ |
| Medicine Batch Registration | ✅ |
| QR Code Auto-Generation | ✅ |
| Quality Testing Algorithm | ✅ |
| Auto Approve/Reject on Test | ✅ |
| Counterfeit Detection (Duplicate Batch ID) | ✅ |
| 4 Severity Alert System | ✅ |
| Supply Chain Transfer | ✅ |
| Delivery Confirmation | ✅ |
| Inventory Management | ✅ |
| Public Verification Page | ✅ |
| Supply Chain Timeline | ✅ |
| Admin Analytics + Charts | ✅ |
| AI Anomaly Detection (IsolationForest) | ✅ |
| Automation Engine (Hourly Checks) | ✅ |
| WHO Mock API Integration | ✅ |
| Packaging Information | ✅ |

---

## 🔬 Quality Algorithm

```
IF purity_percentage >= 80
   AND sterility_status = PASS
   AND contamination_flag = false
→  Result = SAFE → Medicine APPROVED

ELSE
→  Result = DEFECTIVE → Medicine REJECTED
   + Alerts generated for each violation
```

---

## 🤖 AI Microservice API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/analyze` | POST | Analyze single batch |
| `/analyze/batch` | POST | Analyze multiple batches |
| `/results` | GET | Get all analysis results |
| `/results/clear` | POST | Clear results |

---

## 🏗️ Architecture

```
[Browser] → [Express.js :3000]
                 ↕
          [PostgreSQL DB]
                 ↕
         [Flask AI :5001]
                 ↕
      [/public/qrcodes/ (QR images)]
```
