const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { verifyToken, verifyTempToken, verifySeller, verifyBuyer, verifyDriver, verifyAdmin } = require('./src/middleware/authMiddleware');
const authController = require('./src/controllers/authController');
const reviewController = require('./src/controllers/reviewController');
const sellerController = require('./src/controllers/sellerController');
const productController = require('./src/controllers/productController');
const buyerController = require('./src/controllers/buyerController');
const adminController = require('./src/controllers/adminController');
const driverController = require('./src/controllers/driverController');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Log incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Base Route
app.get('/', (req, res) => {
  res.json({ message: 'SEAPEDIA Backend API is running.' });
});

// Authentication Endpoints
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/select-role', verifyTempToken, authController.selectRole);
app.post('/api/auth/switch-role', verifyToken, authController.switchRole);
app.get('/api/auth/me', verifyToken, authController.getProfile);

// Application Review Endpoints (Public Guest Access)
app.post('/api/reviews', reviewController.createReview);
app.get('/api/reviews', reviewController.getReviews);

// Seller Management Endpoints (Requires Active Role = SELLER)
app.post('/api/seller/store', verifyToken, verifySeller, sellerController.manageStore);
app.get('/api/seller/dashboard', verifyToken, verifySeller, sellerController.getDashboard);
app.post('/api/seller/products', verifyToken, verifySeller, sellerController.createProduct);
app.put('/api/seller/products/:id', verifyToken, verifySeller, sellerController.updateProduct);
app.delete('/api/seller/products/:id', verifyToken, verifySeller, sellerController.deleteProduct);
app.get('/api/seller/orders', verifyToken, verifySeller, sellerController.getSellerOrders);
app.post('/api/seller/orders/:id/process', verifyToken, verifySeller, sellerController.processOrder);
app.get('/api/seller/reports/income', verifyToken, verifySeller, sellerController.getIncomeReport);

// Buyer Management Endpoints (Requires Active Role = BUYER)
app.post('/api/buyer/topup', verifyToken, verifyBuyer, buyerController.topupWallet);
app.put('/api/buyer/address', verifyToken, verifyBuyer, buyerController.updateAddress);
app.post('/api/buyer/cart', verifyToken, verifyBuyer, buyerController.addToCart);
app.put('/api/buyer/cart/:id', verifyToken, verifyBuyer, buyerController.updateCart);
app.delete('/api/buyer/cart/:id', verifyToken, verifyBuyer, buyerController.deleteCart);
app.delete('/api/buyer/cart/clear', verifyToken, verifyBuyer, buyerController.clearCart);
app.get('/api/buyer/cart', verifyToken, verifyBuyer, buyerController.getCart);
app.post('/api/buyer/checkout', verifyToken, verifyBuyer, buyerController.checkout);
app.get('/api/buyer/orders', verifyToken, verifyBuyer, buyerController.getOrders);
app.get('/api/buyer/discount/validate', verifyToken, verifyBuyer, buyerController.validateDiscount);
app.get('/api/buyer/reports/spending', verifyToken, verifyBuyer, buyerController.getSpendingReport);

// Driver Management Endpoints (Requires Active Role = DRIVER)
app.get('/api/driver/jobs', verifyToken, verifyDriver, driverController.getAvailableJobs);
app.post('/api/driver/jobs/:id/take', verifyToken, verifyDriver, driverController.takeJob);
app.post('/api/driver/jobs/:id/complete', verifyToken, verifyDriver, driverController.completeJob);
app.get('/api/driver/dashboard', verifyToken, verifyDriver, driverController.getDriverDashboard);

// Admin / Internal Simulated Endpoints
app.get('/api/admin/dashboard', verifyToken, verifyAdmin, adminController.getDashboard);
app.post('/api/admin/simulate-next-day', verifyToken, verifyAdmin, adminController.simulateNextDay);
app.post('/api/admin/reset-simulation', verifyToken, verifyAdmin, adminController.resetSimulation);
app.post('/api/admin/discounts', verifyToken, verifyAdmin, adminController.generateDiscounts);

// Public Product Catalog Endpoints (Public Guest Access)
app.get('/api/products', productController.listProducts);
app.get('/api/products/:id', productController.getProductDetail);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
