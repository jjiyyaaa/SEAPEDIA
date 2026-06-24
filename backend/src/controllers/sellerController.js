const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sanitizeInput } = require('../utils/security');

// Create or Update Store Profile
const manageStore = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Store name is required.' });
    }

    const cleanStoreName = sanitizeInput(name.trim());

    // Check if user already has a store
    const existingStore = await prisma.store.findUnique({
      where: { userId }
    });

    if (existingStore) {
      // If store exists, check if name is taken by another store
      const nameTaken = await prisma.store.findFirst({
        where: {
          name: cleanStoreName,
          NOT: { id: existingStore.id }
        }
      });

      if (nameTaken) {
        return res.status(400).json({ message: `Store name '${cleanStoreName}' is already taken.` });
      }

      // Update store name
      const updatedStore = await prisma.store.update({
        where: { id: existingStore.id },
        data: { name: cleanStoreName }
      });

      return res.status(200).json({
        message: 'Store profile updated successfully.',
        store: updatedStore
      });
    } else {
      // Check if store name is taken globally
      const nameTaken = await prisma.store.findUnique({
        where: { name: cleanStoreName }
      });

      if (nameTaken) {
        return res.status(400).json({ message: `Store name '${cleanStoreName}' is already taken.` });
      }

      // Create new store
      const newStore = await prisma.store.create({
        data: {
          name: cleanStoreName,
          userId
        }
      });

      return res.status(201).json({
        message: 'Store profile created successfully.',
        store: newStore
      });
    }

  } catch (error) {
    return res.status(500).json({ message: 'Server error managing store profile.', error: error.message });
  }
};

// Get Seller Dashboard Details (Store & Products)
const getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    const store = await prisma.store.findUnique({
      where: { userId },
      include: {
        products: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!store) {
      return res.status(200).json({ hasStore: false, store: null });
    }

    return res.status(200).json({
      hasStore: true,
      store
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    return res.status(500).json({ message: 'Server error loading seller dashboard.', error: error.message });
  }
};

// Create Product (Store required)
const createProduct = async (req, res) => {
  try {
    const { name, description, price, stock } = req.body;
    const userId = req.user.id;

    if (!name || !description || price === undefined || stock === undefined) {
      return res.status(400).json({ message: 'All fields (name, description, price, stock) are required.' });
    }

    const parsedPrice = parseInt(price, 10);
    const parsedStock = parseInt(stock, 10);

    if (isNaN(parsedPrice) || parsedPrice < 1) {
      return res.status(400).json({ message: 'Price must be a valid positive integer.' });
    }
    if (isNaN(parsedStock) || parsedStock < 1) {
      return res.status(400).json({ message: 'Stock must be a valid positive integer.' });
    }

    const cleanProductName = sanitizeInput(name.trim());
    const cleanDescription = sanitizeInput(description.trim());

    // Verify user owns a store
    const store = await prisma.store.findUnique({
      where: { userId }
    });

    if (!store) {
      return res.status(400).json({ message: 'Store profile required before creating products.' });
    }

    const product = await prisma.product.create({
      data: {
        name: cleanProductName,
        description: cleanDescription,
        price: parsedPrice,
        stock: parsedStock,
        storeId: store.id
      }
    });

    return res.status(201).json({
      message: 'Product added successfully.',
      product
    });

  } catch (error) {
    return res.status(500).json({ message: 'Server error adding product.', error: error.message });
  }
};

// Update Product (Enforce ownership checks)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock } = req.body;
    const userId = req.user.id;

    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid product ID.' });
    }

    if (!name || !description || price === undefined || stock === undefined) {
      return res.status(400).json({ message: 'All fields (name, description, price, stock) are required.' });
    }

    const parsedPrice = parseInt(price, 10);
    const parsedStock = parseInt(stock, 10);

    if (isNaN(parsedPrice) || parsedPrice < 1) {
      return res.status(400).json({ message: 'Price must be a valid positive integer.' });
    }
    if (isNaN(parsedStock) || parsedStock < 1) {
      return res.status(400).json({ message: 'Stock must be a valid positive integer.' });
    }

    const cleanProductName = sanitizeInput(name.trim());
    const cleanDescription = sanitizeInput(description.trim());

    // Fetch user store
    const store = await prisma.store.findUnique({
      where: { userId }
    });

    if (!store) {
      return res.status(400).json({ message: 'Store profile required to update products.' });
    }

    // Check product existence
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Verify ownership
    if (product.storeId !== store.id) {
      return res.status(403).json({ message: 'Access denied. You do not own this product.' });
    }

    // Update
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        name: cleanProductName,
        description: cleanDescription,
        price: parsedPrice,
        stock: parsedStock
      }
    });

    return res.status(200).json({
      message: 'Product updated successfully.',
      product: updatedProduct
    });

  } catch (error) {
    return res.status(500).json({ message: 'Server error updating product.', error: error.message });
  }
};

// Delete Product (Enforce ownership checks)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid product ID.' });
    }

    // Fetch user store
    const store = await prisma.store.findUnique({
      where: { userId }
    });

    if (!store) {
      return res.status(400).json({ message: 'Store profile required to delete products.' });
    }

    // Check product existence
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Verify ownership
    if (product.storeId !== store.id) {
      return res.status(403).json({ message: 'Access denied. You do not own this product.' });
    }

    // Delete
    await prisma.product.delete({
      where: { id: productId }
    });

    return res.status(200).json({
      message: 'Product deleted successfully.'
    });

  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({ message: 'Server error deleting product.', error: error.message });
  }
};

// Get Inbound Orders for Seller
const getSellerOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user store
    const store = await prisma.store.findUnique({
      where: { userId }
    });

    if (!store) {
      return res.status(400).json({ message: 'Store profile required to view orders.' });
    }

    const orders = await prisma.order.findMany({
      where: { storeId: store.id },
      include: {
        buyer: {
          select: {
            username: true,
            email: true,
            address: true
          }
        },
        items: {
          include: {
            product: {
              select: { name: true }
            }
          }
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(orders);

  } catch (error) {
    console.error('Get seller orders error:', error);
    return res.status(500).json({ message: 'Server error retrieving store orders.', error: error.message });
  }
};

// Process order status transition
const processOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID.' });
    }

    // Fetch user store
    const store = await prisma.store.findUnique({
      where: { userId }
    });

    if (!store) {
      return res.status(400).json({ message: 'Store profile required to process orders.' });
    }

    // Check order existence
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    // Verify ownership
    if (order.storeId !== store.id) {
      return res.status(403).json({ message: 'Access denied. You do not own this order.' });
    }

    // Validate status transition
    if (order.status !== 'Sedang Dikemas') {
      return res.status(400).json({ message: `Cannot process order. Current status is '${order.status}', but must be 'Sedang Dikemas'.` });
    }

    // Update order status and add history transition
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'Menunggu Pengirim',
        statusHistory: {
          create: {
            status: 'Menunggu Pengirim',
            comment: 'Order is packed and waiting for delivery courier.'
          }
        }
      },
      include: {
        statusHistory: true
      }
    });

    return res.status(200).json({
      message: 'Order processed successfully.',
      order: updatedOrder
    });

  } catch (error) {
    console.error('Process order error:', error);
    return res.status(500).json({ message: 'Server error processing order.', error: error.message });
  }
};

// Retrieve Seller Financial Income Report
const getIncomeReport = async (req, res) => {
  try {
    const userId = req.user.id;

    const store = await prisma.store.findUnique({
      where: { userId }
    });

    if (!store) {
      return res.status(200).json({ totalIncome: 0 });
    }

    const orders = await prisma.order.findMany({
      where: {
        storeId: store.id,
        NOT: { status: 'Dikembalikan' }
      }
    });

    let totalIncome = 0;
    orders.forEach(order => {
      totalIncome += order.subtotal;
    });

    return res.status(200).json({
      totalIncome
    });

  } catch (error) {
    console.error('Get income report error:', error);
    return res.status(500).json({ message: 'Server error retrieving income report.', error: error.message });
  }
};

module.exports = {
  manageStore,
  getDashboard,
  createProduct,
  updateProduct,
  deleteProduct,
  getSellerOrders,
  processOrder,
  getIncomeReport
};
