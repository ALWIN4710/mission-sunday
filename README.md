# 🍦 Mission Sunday Sales Management System

**A production-grade MERN stack web application for church fundraising event management**

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7%2B-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

---

## ✨ Features

- **🛒 POS Checkout** — Fast, touch-friendly point-of-sale interface supporting cash and UPI payments
- **📦 Live Inventory Tracking** — Real-time stock ledger with low-stock alerts; all movements are immutably logged
- **💸 Expense Tracking** — Record event expenses by category with vendor and receipt details
- **📊 Financial Analytics** — Gross profit, revenue by category, payment method breakdown, hourly sales curves
- **🔐 JWT Authentication** — Secure cookie-based authentication with 8-hour session expiry
- **🛡️ Role-Based Access Control** — Admin and Volunteer roles with fine-grained route-level enforcement
- **₹ INR Currency** — All monetary values stored in paise (integer arithmetic) to eliminate floating-point errors
- **📄 Reports & CSV Export** — End-of-day summary reports, sales ledger, and inventory movement exports
- **🧾 Printable Receipts** — Browser-print-ready receipt view for each transaction
- **🐳 Docker Support** — One-command local development environment with MongoDB replica set

---

## 🏗️ Tech Stack

| Layer        | Technology                                                  |
|:-------------|:------------------------------------------------------------|
| **Frontend** | React 18, Vite, React Router v6, Tailwind CSS, Recharts    |
| **Backend**  | Node.js 18, Express 4, Mongoose 8, JWT, Winston            |
| **Database** | MongoDB 7 (single-node replica set for multi-doc transactions) |
| **DevOps**   | Docker, Docker Compose, npm Workspaces, ESLint, Jest, Supertest |

---

## 📁 Project Structure

```
mission-sunday/
├── client/                     # React frontend (Vite)
│   ├── public/
│   └── src/
│       ├── components/         # Reusable UI components
│       ├── pages/              # Route-level page components
│       ├── hooks/              # Custom React hooks
│       ├── services/           # Axios API client
│       └── main.jsx
├── server/                     # Express backend API
│   ├── src/
│   │   ├── config/             # Environment validation
│   │   ├── controllers/        # Route handler logic
│   │   ├── middleware/         # Auth, RBAC, error handling, rate limiting
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/             # Express routers
│   │   ├── scripts/            # Seed & admin bootstrap scripts
│   │   ├── services/           # Business logic (reports, analytics)
│   │   ├── utils/              # AppError, catchAsync, logger
│   │   ├── validators/         # express-validator rule sets
│   │   ├── app.js              # Express app factory (no listen())
│   │   └── server.js           # Entry point (DB connect + listen)
│   ├── tests/                  # Jest + Supertest integration tests
│   │   ├── setup.js
│   │   ├── auth.test.js
│   │   ├── products.test.js
│   │   ├── sales.test.js
│   │   └── inventory.test.js
│   └── package.json
├── docker/
│   └── mongo-init.js           # Replica set initialisation script
├── docker-compose.yml          # Local dev: MongoDB + Mongo Express
├── .env.example                # Environment variable template
├── package.json                # Workspace root (npm workspaces)
└── README.md
```

---

## 📋 Prerequisites

| Requirement    | Version |
|:---------------|:--------|
| **Node.js**    | 18+     |
| **npm**        | 9+      |
| **MongoDB**    | 7+ (or Docker — recommended for local dev) |
| **Docker**     | 24+ (optional, for the managed MongoDB replica set) |

---

## 🚀 Quick Start (Local Development)

### 1 — Clone the repository

```bash
git clone https://github.com/your-org/mission-sunday.git
cd mission-sunday
```

### 2 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```dotenv
JWT_SECRET=<output of: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
MONGODB_URI=mongodb://localhost:27017/mission-sunday?replicaSet=rs0
```

> [!IMPORTANT]
> `JWT_SECRET` must be at least 32 characters long. The server will refuse to start with a weak secret.

### 3 — Start MongoDB (Docker — recommended)

```bash
docker-compose up -d mongo
```

This spins up a MongoDB 7 single-node replica set (`rs0`) required for multi-document transactions used during sale checkout.

> [!NOTE]
> If you prefer a local MongoDB installation, ensure it is started with `--replSet rs0` and the replica set is initiated. See `docker-compose.yml` for reference.

### 4 — Install dependencies

```bash
npm install
```

This installs dependencies for the workspace root, `server/`, and `client/` in one command.

### 5 — Seed the product catalogue

```bash
npm run seed --workspace=server
```

Populates the database with the default ice cream, cone, milkshake, and mojito products.

### 6 — Create the initial admin account

```bash
npm run bootstrap --workspace=server
```

> [!IMPORTANT]
> Set `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD` in your `.env` before running this. Clear them afterwards.

### 7 — Start the development servers

```bash
npm run dev
```

This starts both the backend API (port `5000`) and the React dev server (port `5173`) concurrently.

### 8 — Open in your browser

Navigate to **http://localhost:5173** and log in with the admin credentials you bootstrapped.

---

## 🔑 Environment Variables

| Variable                | Required | Default              | Description                                                   |
|:------------------------|:---------|:---------------------|:--------------------------------------------------------------|
| `NODE_ENV`              | No       | `development`        | Application environment (`development`, `production`, `test`) |
| `PORT`                  | No       | `5000`               | Port the Express server listens on                            |
| `CLIENT_URL`            | No       | `http://localhost:5173` | Allowed CORS origin(s), comma-separated                    |
| `MONGODB_URI`           | **Yes**  | —                    | Full MongoDB connection string (supports Atlas and local)     |
| `JWT_SECRET`            | **Yes**  | —                    | Secret key for signing JWTs (min. 32 characters)             |
| `JWT_EXPIRES_IN`        | No       | `8h`                 | JWT expiry duration (e.g. `8h`, `1d`)                        |
| `COOKIE_SECURE`         | No       | `false`              | Set to `true` in production (requires HTTPS)                 |
| `COOKIE_SAME_SITE`      | No       | `lax`                | Cookie `SameSite` policy (`lax`, `strict`, `none`)           |
| `INITIAL_ADMIN_NAME`    | No       | —                    | Full name for the bootstrapped admin user                     |
| `INITIAL_ADMIN_EMAIL`   | No       | —                    | Email for the bootstrapped admin user                         |
| `INITIAL_ADMIN_PASSWORD`| No       | —                    | Password for the bootstrapped admin user (clear after use)   |
| `LOG_LEVEL`             | No       | `info`               | Winston log level (`debug`, `info`, `warn`, `error`)         |
| `RATE_LIMIT_WINDOW_MS`  | No       | `900000`             | Rate-limit window in ms (default: 15 minutes)                |
| `RATE_LIMIT_MAX`        | No       | `100`                | Max API requests per window                                   |
| `AUTH_RATE_LIMIT_MAX`   | No       | `10`                 | Max login attempts per window                                 |
| `EVENT_NAME`            | No       | `Mission Sunday`     | Display name shown across the UI                             |
| `TIMEZONE`              | No       | `Asia/Kolkata`       | Timezone for date formatting and daily reports               |

---

## 📜 Scripts

### Workspace root (`package.json`)

| Script           | Description                                                    |
|:-----------------|:---------------------------------------------------------------|
| `npm run dev`    | Start both backend and frontend dev servers concurrently       |
| `npm run dev:server` | Start only the Express backend in watch mode              |
| `npm run dev:client` | Start only the Vite frontend dev server                   |
| `npm run seed`   | Seed the product catalogue (`server/src/scripts/seed.js`)      |
| `npm run bootstrap` | Create the initial admin account                           |
| `npm run test`   | Run tests for server and client workspaces                    |
| `npm run test:server` | Run server integration tests only                        |
| `npm run test:client` | Run client unit tests only                               |

### Server workspace (`server/package.json`)

| Script           | Description                                                    |
|:-----------------|:---------------------------------------------------------------|
| `npm run dev`    | Start server with `nodemon` for auto-reload                    |
| `npm start`      | Start server with `node` (production)                          |
| `npm test`       | Run Jest integration tests with `--runInBand --forceExit`      |
| `npm run test:watch` | Run Jest in interactive watch mode                        |
| `npm run seed`   | Seed products directly                                         |
| `npm run bootstrap` | Bootstrap the first admin user                             |

---

## 🛒 Product Catalogue

All prices are in Indian Rupees (₹). Values stored internally in paise.

### Ice Cream

| Flavour       | Selling Price |
|:--------------|:-------------|
| Vanilla       | ₹50          |
| Chocolate     | ₹50          |
| Strawberry    | ₹50          |
| Butterscotch  | ₹60          |
| Mango         | ₹60          |

### Cone

| Flavour       | Selling Price |
|:--------------|:-------------|
| Vanilla Cone  | ₹40          |
| Choco Cone    | ₹40          |
| Mixed Cone    | ₹50          |

### Milkshake

| Flavour       | Selling Price |
|:--------------|:-------------|
| Vanilla       | ₹80          |
| Chocolate     | ₹80          |
| Mango         | ₹80          |
| Strawberry    | ₹90          |

### Mojito

| Flavour       | Selling Price |
|:--------------|:-------------|
| Mint Lime     | ₹60          |
| Watermelon    | ₹70          |
| Blueberry     | ₹70          |
| Virgin        | ₹65          |

---

## 🌐 API Overview

All endpoints are prefixed with `/api/v1`.

### Auth

| Method | Endpoint        | Description                        | Auth Required |
|:-------|:----------------|:-----------------------------------|:-------------|
| POST   | `/auth/login`   | Log in, receive httpOnly JWT cookie | No           |
| POST   | `/auth/logout`  | Clear session cookie               | Yes          |
| GET    | `/auth/me`      | Get the authenticated user's profile | Yes        |

### Products

| Method | Endpoint                  | Description                         | Auth Required | Admin Only |
|:-------|:--------------------------|:------------------------------------|:-------------|:----------|
| GET    | `/products`               | List all products (filterable)      | Yes           | No        |
| POST   | `/products`               | Create a new product                | Yes           | **Yes**   |
| PATCH  | `/products/:id`           | Update product fields               | Yes           | **Yes**   |
| PATCH  | `/products/:id/status`    | Toggle product availability         | Yes           | **Yes**   |

### Sales

| Method | Endpoint               | Description                             | Auth Required | Admin Only |
|:-------|:-----------------------|:----------------------------------------|:-------------|:----------|
| POST   | `/sales`               | Create a sale (atomic checkout)         | Yes           | No        |
| GET    | `/sales`               | List sales (paginated, filterable)      | Yes           | No        |
| GET    | `/sales/:id`           | Get a single sale by ID                 | Yes           | No        |
| POST   | `/sales/:id/refunds`   | Issue a refund against a sale           | Yes           | **Yes**   |

### Inventory

| Method | Endpoint                     | Description                              | Auth Required | Admin Only |
|:-------|:-----------------------------|:-----------------------------------------|:-------------|:----------|
| GET    | `/inventory`                 | Current stock levels for all products    | Yes           | No        |
| GET    | `/inventory/movements`       | Paginated movement history               | Yes           | No        |
| POST   | `/inventory/movements`       | Manual stock adjustment / wastage        | Yes           | **Yes**   |
| POST   | `/inventory/purchases`       | Record a bulk stock purchase             | Yes           | **Yes**   |

### Expenses

| Method | Endpoint          | Description                           | Auth Required | Admin Only |
|:-------|:------------------|:--------------------------------------|:-------------|:----------|
| GET    | `/expenses`       | List recorded expenses                | Yes           | No        |
| POST   | `/expenses`       | Record a new expense                  | Yes           | **Yes**   |
| PATCH  | `/expenses/:id`   | Update an expense entry               | Yes           | **Yes**   |
| DELETE | `/expenses/:id`   | Delete an expense entry               | Yes           | **Yes**   |

### Dashboard & Analytics

| Method | Endpoint            | Description                              | Auth Required |
|:-------|:--------------------|:-----------------------------------------|:-------------|
| GET    | `/dashboard`        | Today's summary KPIs                     | Yes          |
| GET    | `/analytics`        | Revenue, profit, and sales analytics     | Yes          |

### Reports

| Method | Endpoint                     | Description                              | Auth Required | Admin Only |
|:-------|:-----------------------------|:-----------------------------------------|:-------------|:----------|
| GET    | `/reports/daily`             | End-of-day report (JSON / CSV)           | Yes           | **Yes**   |
| GET    | `/reports/sales-export`      | Full sales ledger CSV export             | Yes           | **Yes**   |
| GET    | `/reports/inventory-export`  | Inventory movements CSV export           | Yes           | **Yes**   |

### Users & Settings

| Method | Endpoint         | Description                           | Auth Required | Admin Only |
|:-------|:-----------------|:--------------------------------------|:-------------|:----------|
| GET    | `/users`         | List all user accounts                | Yes           | **Yes**   |
| POST   | `/users`         | Create a new user account             | Yes           | **Yes**   |
| PATCH  | `/users/:id`     | Update user details or role           | Yes           | **Yes**   |
| GET    | `/settings`      | Get application settings              | Yes           | No        |
| PATCH  | `/settings`      | Update application settings           | Yes           | **Yes**   |

---

## 🔐 Authentication & Roles

Authentication uses **JSON Web Tokens** delivered as `HttpOnly` cookies (`jwt_token`). The token is signed with `JWT_SECRET` and expires after `JWT_EXPIRES_IN` (default 8 hours).

### Roles

| Permission                           | Admin | Volunteer |
|:-------------------------------------|:-----:|:---------:|
| View products, sales, inventory      | ✅    | ✅        |
| Process a sale (POS checkout)        | ✅    | ✅        |
| Create / edit products               | ✅    | ❌        |
| Toggle product availability          | ✅    | ❌        |
| Issue refunds                        | ✅    | ❌        |
| Manual inventory adjustments         | ✅    | ❌        |
| Record stock purchases               | ✅    | ❌        |
| Record / manage expenses             | ✅    | ❌        |
| View analytics & reports             | ✅    | ❌        |
| Export CSV reports                   | ✅    | ❌        |
| Manage user accounts                 | ✅    | ❌        |
| Change application settings          | ✅    | ❌        |

---

## 🚢 Deployment

### MongoDB Atlas

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Whitelist your server's IP address.
3. Create a database user with `readWrite` access.
4. Set the connection string in your production environment:

```dotenv
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/mission-sunday?retryWrites=true&w=majority
```

> [!NOTE]
> Atlas clusters include a built-in replica set, so multi-document transactions work automatically in production.

### Production Build

```bash
# Build the React frontend
npm run build --workspace=client

# Start the production API server (serves static files from client/dist)
NODE_ENV=production npm start --workspace=server
```

Set these additional environment variables in production:

```dotenv
NODE_ENV=production
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
```

> [!CAUTION]
> Never set `COOKIE_SECURE=false` in production. Doing so allows the JWT cookie to be sent over plain HTTP.

### Docker (Full Stack)

```bash
# Build images and start all services
docker-compose up --build

# Run in detached mode
docker-compose up --build -d
```

Services started:

| Service         | Port   | Description                    |
|:----------------|:-------|:-------------------------------|
| `mongo`         | 27017  | MongoDB 7 replica set          |
| `mongo-express` | 8081   | Web-based MongoDB admin UI     |

---

## 🧪 Running Tests

The test suite uses **Jest** + **Supertest** with an in-memory MongoDB instance (`mongodb-memory-server`). No external database is required.

```bash
# Run all server integration tests
npm run test:server

# Run in watch mode during development
cd server && npm run test:watch
```

Tests are organised by feature:

| File                       | Coverage                                 |
|:---------------------------|:-----------------------------------------|
| `tests/auth.test.js`       | Login, logout, session, `/me` endpoint   |
| `tests/products.test.js`   | CRUD, RBAC, availability toggle          |
| `tests/sales.test.js`      | Checkout, stock deduction, idempotency, refunds |
| `tests/inventory.test.js`  | Stock levels, movements, adjustments     |

---

## 🤝 Contributing

1. Fork the repository and create a feature branch: `git checkout -b feat/my-feature`
2. Follow the existing code style (ESLint config is in the root).
3. Write or update tests for any changed behaviour.
4. Open a pull request with a clear description of the change and the motivation behind it.
5. Ensure `npm test` passes before requesting a review.

All monetary values **must** be stored in paise (integers). Never use floating-point arithmetic for currency calculations.

---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026 Mission Sunday

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
