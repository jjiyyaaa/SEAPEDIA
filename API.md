# SEAPEDIA API Documentation

SEAPEDIA provides a RESTful API backend running on port 5000 by default. All requests and responses use JSON.

## Base URL
`http://localhost:5000/api`

---

## 1. Authentication Endpoints

### Register User
* **URL**: `/auth/register`
* **Method**: `POST`
* **Body**:
  ```json
  {
    "username": "username_here",
    "email": "user@example.com",
    "password": "password123",
    "roles": ["BUYER", "SELLER", "DRIVER"]
  }
  ```
  *(Note: To register an admin account, pass `["ADMIN"]` as the roles array. It cannot be combined with other roles).*
* **Success Response**: `201 Created`

### Login User
* **URL**: `/auth/login`
* **Method**: `POST`
* **Body**:
  ```json
  {
    "username": "username_or_email",
    "password": "password123"
  }
  ```
* **Success Response (Single Role)**: `200 OK` (returns JWT `token` and `requireRoleSelection: false`)
* **Success Response (Multi-Role)**: `200 OK` (returns temporary JWT `token` and `requireRoleSelection: true` with allowed roles)

### Select Active Role
* **URL**: `/auth/select-role`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <temp_token>`
* **Body**:
  ```json
  {
    "role": "SELLER"
  }
  ```
* **Success Response**: `200 OK` (returns final session JWT `token` and `activeRole`)

### Switch Active Role
* **URL**: `/auth/switch-role`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <session_token>`
* **Body**:
  ```json
  {
    "role": "BUYER"
  }
  ```
* **Success Response**: `200 OK` (returns new session JWT `token` with updated role claim)

---

## 2. Public Experience (Guest Access)

### Submit Review
* **URL**: `/reviews`
* **Method**: `POST`
* **Body**:
  ```json
  {
    "reviewerName": "Name",
    "rating": 5,
    "comment": "Feedback..."
  }
  ```

### Get All Reviews
* **URL**: `/reviews`
* **Method**: `GET`

### List Catalog Products
* **URL**: `/products`
* **Method**: `GET`

---

## 3. Buyer Endpoints (Requires Active Role: BUYER)

### Wallet Top-Up
* **URL**: `/buyer/topup`
* **Method**: `POST`
* **Body**: `{ "amount": 100000 }`

### Save Address
* **URL**: `/buyer/address`
* **Method**: `PUT`
* **Body**: `{ "address": "Destination address" }`

### Get Cart Items
* **URL**: `/buyer/cart`
* **Method**: `GET`

### Add Item to Cart
* **URL**: `/buyer/cart`
* **Method**: `POST`
* **Body**: `{ "productId": 1, "quantity": 1 }`

### Update Cart Item Qty
* **URL**: `/buyer/cart/:id`
* **Method**: `PUT`
* **Body**: `{ "quantity": 3 }`

### Clear Cart
* **URL**: `/buyer/cart/clear`
* **Method**: `DELETE`

### Validate Discount Code
* **URL**: `/buyer/discount/validate?code=PROMO_CODE`
* **Method**: `GET`

### Checkout Cart
* **URL**: `/buyer/checkout`
* **Method**: `POST`
* **Body**: `{ "deliveryMethod": "Instant", "discountCode": "PROMO20" }`

---

## 4. Seller Endpoints (Requires Active Role: SELLER)

### Create/Update Store
* **URL**: `/seller/store`
* **Method**: `POST`
* **Body**: `{ "name": "Unique Store Name" }`

### Create Product
* **URL**: `/seller/products`
* **Method**: `POST`
* **Body**: `{ "name": "Lobster", "description": "Fresh", "price": 120000, "stock": 5 }`

### Update Product
* **URL**: `/seller/products/:id`
* **Method**: `PUT`

### Delete Product
* **URL**: `/seller/products/:id`
* **Method**: `DELETE`

### Process Inbound Order
* **URL**: `/seller/orders/:id/process`
* **Method**: `POST`

---

## 5. Driver Endpoints (Requires Active Role: DRIVER)

### Find Available Jobs
* **URL**: `/driver/jobs`
* **Method**: `GET`

### Accept Shipment Job
* **URL**: `/driver/jobs/:id/take`
* **Method**: `POST`

### Complete Shipment Job
* **URL**: `/driver/jobs/:id/complete`
* **Method**: `POST`

---

## 6. Admin Endpoints (Requires Active Role: ADMIN)

### Get Admin Dashboard KPI Metrics
* **URL**: `/admin/dashboard`
* **Method**: `GET`

### Simulate Next Day Clock Progression
* **URL**: `/admin/simulate-next-day`
* **Method**: `POST`

### Reset Simulation Clock Offset
* **URL**: `/admin/reset-simulation`
* **Method**: `POST`

### Generate Voucher/Promo
* **URL**: `/admin/discounts`
* **Method**: `POST`
* **Body**:
  ```json
  {
    "type": "voucher",
    "code": "PROMO15",
    "discountValue": 15000,
    "expiryDate": "2027-12-31T23:59:00.000Z",
    "usageLimit": 10
  }
  ```
