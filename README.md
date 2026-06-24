# SEAPEDIA - Modern Fullstack Maritime Marketplace

SEAPEDIA is a robust, modern fullstack maritime marketplace built using **HTML5/Vanilla CSS/JavaScript** on the frontend, and **Node.js/Express/Prisma ORM/SQLite** on the backend. The platform serves as a complete digital ecosystem connecting seafood buyers, store vendors, logistics couriers, and platform administrators.

---

## 📁 Directory Structure

```text
seapedia/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma         # Prisma Schema (SQLite database models)
│   │   └── dev.db                # Live SQLite Database file
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── adminController.js  # KPI dashboard metrics & SLA time-progress simulation
│   │   │   ├── authController.js   # JWT Multi-Role Session management & switches
│   │   │   ├── buyerController.js  # Wallet, shipping, cart CRUD, and checkout transactions
│   │   │   ├── driverController.js # Shipment pickups, deliveries, and courier earnings
│   │   │   ├── productController.js# Public catalog listings and product details
│   │   │   ├── reviewController.js # Guest feedback creation with XSS escapers
│   │   │   └── sellerController.js # Store profile settings & owner-validated Product CRUD
│   │   ├── middleware/
│   │   │   └── authMiddleware.js   # Middleware for JWT Token verification & active role locks
│   │   └── utils/
│   │       └── security.js         # Custom string escaper shielding text inputs from XSS
│   ├── .env                      # Ports & secrets configuration
│   ├── package.json              # Backend dependencies
│   ├── server.js                 # Express routes mounting
│   ├── test_api.js               # Level 1 Core Auth Integration test
│   ├── test_seller_api.js        # Level 2 Seller Store & Product CRUD integration test
│   ├── test_checkout_api.js      # Level 3 Cart & Checkout integration test
│   ├── test_level4_discounts.js  # Level 4 Coupon & Seller Processing integration test
│   ├── test_level5_driver.js      # Level 5 Driver & courier workflow integration test
│   ├── test_level6_overdue.js     # Level 6 Admin simulation & SLA overdue integration test
│   └── test_level7_xss.js         # Level 7 Input XSS sanitization & boundary validation test
└── frontend/
    ├── index.html                # Single Page Application UI templates
    ├── style.css                 # Dark-oceanic custom stylesheet (responsive & glassmorphism)
    └── app.js                    # Frontend router, state manager, and API client handlers
```

---

## 🛠️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- npm (Node Package Manager)

### 1. Backend API Server Setup
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install the backend dependencies:
   ```bash
   npm install
   ```
3. Run the Prisma database migrations to initialize the SQLite database schema:
   ```bash
   npx prisma migrate dev --name init
   ```
4. Start the Express development server:
   ```bash
   npm start
   ```
   The backend server will listen on **Port 5000** (`http://localhost:5000`).

### 2. Frontend Client Setup
To load the client-side SPA, open the [index.html](frontend/index.html) file directly in any modern web browser. It connects automatically to the running local API backend on port 5000.

---

## 🔒 Environment Variables

The backend relies on the following configurations in the `backend/.env` file:
* `PORT`: The port number the Express server runs on (defaults to `5000`).
* `JWT_SECRET`: Secret key used for signing JSON Web Tokens (defaults to `seapedia_secure_jwt_secret_token_key_2026`).
* `DATABASE_URL`: Connection string for the database (defaults to SQLite: `file:./dev.db`).

---

## 🛡️ Creating an Admin Account

To access the platform's Admin Workspace (to monitor KPIs, simulate time progression, and generate discount codes):
1. Open the application frontend (`index.html`) in your browser.
2. Click **Login / Register** in the top navigation bar.
3. Switch to the **Register** tab.
4. Fill in a username (e.g. `admin_master`), email (e.g. `admin@seapedia.com`), and password.
5. In the checkbox selection, **uncheck Buyer/Seller/Driver** and check **Admin (Single Role)**.
6. Click **Register Account**, then log in with your credentials.
7. Upon successful login, you will be redirected directly to the protected Admin Workspace.

*(Note: Under server-side role validation constraint rules, the `ADMIN` role is a single-role account and cannot be combined with Buyer, Seller, or Driver roles).*

---

## 💎 Key Architecture & Documentation

For comprehensive details on other parts of the system:
- **API Endpoint Details**: Refer to [API.md](API.md) for Swagger-equivalent endpoint specifications.
- **Security Engineering**: Refer to [SECURITY.md](SECURITY.md) for implementation details on SQL Injection, XSS sanitization, and RBAC.

### 1. Multi-Role Session & Switcher
- Users can register with multiple roles (`BUYER`, `SELLER`, `DRIVER`).
- **Temporary Login Token**: Upon login, if a user has multiple roles, the backend issues a temporary 10-minute token and redirects them to a role selection portal.
- **Active Role Workspace**: Selecting a role completes the login, issuing a final JWT carrying the `activeRole` session claim.
- **Dynamic Switcher**: Inside the dashboard, multi-role users can toggle their active role instantly without logging out. Access is locked dynamically using server-side role validators (`verifyBuyer`, `verifySeller`, `verifyDriver`, `verifyAdmin`).

### 2. Single-Store Cart Rule
- To keep shipping logic clean, buyers are restricted to checking out products from **one seller store at a time**.
- If a buyer attempts to add a product from a different vendor, the backend blocks the request and triggers a prompt offering to empty the cart so they can proceed with the new store.

### 3. SLA Overdue Simulation Engine & Atomic Reversals
- Administrators can virtually move time forward in increments of 1 day to simulate delays.
- **SLA Thresholds**:
  - *Instant & Next Day Delivery*: 1 Day SLA.
  - *Regular Delivery*: 3 Days SLA.
- **Atomic Reversals**: If an in-progress order breaches its SLA threshold, the engine executes a strict transaction database rollback:
  1. Reverts order status to `'Dikembalikan'`.
  2. Refunds 100% of the total order value back to the Buyer's `walletBalance`.
  3. Restores product inventory stock in full.
  4. Appends a transition log in `OrderStatusHistory`.
  5. Automatically excludes the refunded order from the Seller's dynamic income report.

### 4. Input Sanitization & Boundary Validations
- **XSS Escapers**: Text fields (review comments, shipping addresses, store names, product descriptions) pass through a strict character sanitization layer, escaping HTML entities (`&`, `<`, `>`, `"`, `'`, `/`) to render text completely safe from script injections.
- **Strict Boundary Checks**: Input integers (top-ups, product prices, stock levels, cart quantities) enforce `>= 1` boundary validations, returning a `400 Bad Request` if zero or negative numbers are submitted.

---

## 🧪 Running Integration Tests

Programmatic E2E integration test scripts are available in the `backend` folder. They can be executed sequentially to verify all application subsystems.

Ensure the backend server is running in the background (`npm start`), then execute the following tests in your terminal:

```bash
# Level 1: Core Auth & Role Selectors
node test_api.js

# Level 2: Seller Dashboard & Product Catalog
node test_seller_api.js

# Level 3: Buyer Wallet, Carts & Checkout
node test_checkout_api.js

# Level 4: Discount Codes (Vouchers & Promos) & Seller Order Processing
node test_level4_discounts.js

# Level 5: Driver Logistics, Shipment Pickups & Deliveries
node test_level5_driver.js

# Level 6: Admin Dashboard Monitoring & SLA Time Simulations
node test_level6_overdue.js

# Level 7: Input XSS Sanitization & Upgraded Boundary Numeric Checks
node test_level7_xss.js
```
