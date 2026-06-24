const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sanitizeInput } = require('../utils/security');

// Helper to calculate delivery fee
const getDeliveryFee = (method) => {
  switch (method) {
    case 'Instant':
      return 50000;
    case 'Next Day':
      return 25000;
    case 'Regular':
    default:
      return 10000;
  }
};

// Topup Wallet balance
const topupWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive integer.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        walletBalance: {
          increment: parsedAmount
        }
      }
    });

    return res.status(200).json({
      message: 'Top-up successful.',
      walletBalance: updatedUser.walletBalance
    });

  } catch (error) {
    return res.status(500).json({ message: 'Server error during top-up.', error: error.message });
  }
};

// Update Shipping Address
const updateAddress = async (req, res) => {
  try {
    const { address } = req.body;
    const userId = req.user.id;

    if (!address || address.trim() === '') {
      return res.status(400).json({ message: 'Shipping address is required.' });
    }

    const cleanAddress = sanitizeInput(address.trim());

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { address: cleanAddress }
    });

    return res.status(200).json({
      message: 'Shipping address updated successfully.',
      address: updatedUser.address
    });

  } catch (error) {
    return res.status(500).json({ message: 'Server error updating shipping address.', error: error.message });
  }
};

// Add to Cart
const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user.id;

    if (productId === undefined || quantity === undefined) {
      return res.status(400).json({ message: 'productId and quantity are required.' });
    }

    const pId = parseInt(productId, 10);
    const qty = parseInt(quantity, 10);

    if (isNaN(pId) || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ message: 'productId and quantity must be valid positive integers.' });
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: pId }
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Check stock
    if (product.stock < qty) {
      return res.status(400).json({ message: `Not enough stock. Available stock is ${product.stock} units.` });
    }

    // Fetch existing cart items to enforce Single-Store Cart Rule
    const existingCartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: true
      }
    });

    if (existingCartItems.length > 0) {
      const activeStoreId = existingCartItems[0].product.storeId;
      if (product.storeId !== activeStoreId) {
        return res.status(400).json({
          message: 'Single-Store Cart Violation: Your cart already contains products from a different store. Please empty your cart or complete checkout first.',
          requiresClearCart: true
        });
      }
    }

    // Add or Update quantity
    const existingCartItem = existingCartItems.find(item => item.productId === pId);

    if (existingCartItem) {
      const newQty = existingCartItem.quantity + qty;
      if (product.stock < newQty) {
        return res.status(400).json({ message: `Cannot add more. Combined cart quantity exceeds stock. Available: ${product.stock} units.` });
      }

      const updatedItem = await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: { quantity: newQty }
      });

      return res.status(200).json({
        message: 'Product quantity updated in cart.',
        cartItem: updatedItem
      });
    } else {
      const newItem = await prisma.cartItem.create({
        data: {
          userId,
          productId: pId,
          quantity: qty
        }
      });

      return res.status(201).json({
        message: 'Product added to cart.',
        cartItem: newItem
      });
    }

  } catch (error) {
    console.error('Add to cart error:', error);
    return res.status(500).json({ message: 'Server error adding to cart.', error: error.message });
  }
};

// Update Cart Item quantity
const updateCart = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;

    const cartItemId = parseInt(id, 10);
    const qty = parseInt(quantity, 10);

    if (isNaN(cartItemId) || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ message: 'Invalid ID or quantity values.' });
    }

    // Find cart item
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { product: true }
    });

    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found.' });
    }

    if (cartItem.userId !== userId) {
      return res.status(403).json({ message: 'Access denied. You do not own this cart item.' });
    }

    // Validate stock
    if (cartItem.product.stock < qty) {
      return res.status(400).json({ message: `Insufficient stock. Only ${cartItem.product.stock} items available.` });
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity: qty }
    });

    return res.status(200).json({
      message: 'Cart quantity updated.',
      cartItem: updatedItem
    });

  } catch (error) {
    console.error('Update cart error:', error);
    return res.status(500).json({ message: 'Server error updating cart.', error: error.message });
  }
};

// Delete Cart Item
const deleteCart = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const cartItemId = parseInt(id, 10);
    if (isNaN(cartItemId)) {
      return res.status(400).json({ message: 'Invalid cart item ID.' });
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId }
    });

    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found.' });
    }

    if (cartItem.userId !== userId) {
      return res.status(403).json({ message: 'Access denied. You do not own this cart item.' });
    }

    await prisma.cartItem.delete({
      where: { id: cartItemId }
    });

    return res.status(200).json({ message: 'Cart item removed.' });

  } catch (error) {
    console.error('Delete cart error:', error);
    return res.status(500).json({ message: 'Server error deleting cart item.', error: error.message });
  }
};

// Clear All Cart Items (Helper route/action if needed)
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    await prisma.cartItem.deleteMany({
      where: { userId }
    });
    return res.status(200).json({ message: 'Cart cleared successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error clearing cart.', error: error.message });
  }
};

// Get Cart Details (with subtotal)
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            store: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    let subtotal = 0;
    cartItems.forEach(item => {
      subtotal += item.product.price * item.quantity;
    });

    return res.status(200).json({
      items: cartItems,
      subtotal
    });

  } catch (error) {
    console.error('Get cart error:', error);
    return res.status(500).json({ message: 'Server error retrieving cart.', error: error.message });
  }
};

// Validate Discount Code
const validateDiscount = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code || code.trim() === '') {
      return res.status(400).json({ message: 'Discount code is required.' });
    }

    const upperCode = code.trim().toUpperCase();

    // 1. Check Promo
    const promo = await prisma.promo.findUnique({
      where: { code: upperCode }
    });

    if (promo) {
      const now = new Date();
      if (new Date(promo.expiryDate) < now) {
        return res.status(400).json({ isValid: false, message: 'Discount code has expired.' });
      }
      return res.status(200).json({
        isValid: true,
        type: 'promo',
        code: promo.code,
        discountValue: promo.discountValue,
        expiryDate: promo.expiryDate
      });
    }

    // 2. Check Voucher
    const voucher = await prisma.voucher.findUnique({
      where: { code: upperCode }
    });

    if (voucher) {
      const now = new Date();
      if (new Date(voucher.expiryDate) < now) {
        return res.status(400).json({ isValid: false, message: 'Discount code has expired.' });
      }
      if (voucher.remainingUsage <= 0) {
        return res.status(400).json({ isValid: false, message: 'Discount code has reached its usage limit.' });
      }
      return res.status(200).json({
        isValid: true,
        type: 'voucher',
        code: voucher.code,
        discountValue: voucher.discountValue,
        expiryDate: voucher.expiryDate,
        remainingUsage: voucher.remainingUsage
      });
    }

    return res.status(404).json({ isValid: false, message: 'Invalid discount code.' });

  } catch (error) {
    console.error('Validate discount error:', error);
    return res.status(500).json({ message: 'Server error validating discount.', error: error.message });
  }
};

// Get Spending Report for Buyer
const getSpendingReport = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await prisma.order.findMany({
      where: { buyerId: userId }
    });

    let totalSpending = 0;
    orders.forEach(order => {
      totalSpending += order.total;
    });

    return res.status(200).json({
      totalSpending
    });

  } catch (error) {
    console.error('Get spending report error:', error);
    return res.status(500).json({ message: 'Server error loading spending report.', error: error.message });
  }
};

// Checkout Cart items to Order (Atomic Transaction)
const checkout = async (req, res) => {
  try {
    const { deliveryMethod, discountCode } = req.body;
    const userId = req.user.id;

    // Validate delivery method
    const allowedMethods = ['Instant', 'Next Day', 'Regular'];
    if (!deliveryMethod || !allowedMethods.includes(deliveryMethod)) {
      return res.status(400).json({ message: 'Valid deliveryMethod (Instant, Next Day, Regular) is required.' });
    }

    // Fetch user details (address & wallet)
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user.address) {
      return res.status(400).json({ message: 'Shipping address is required before checking out.' });
    }

    // Fetch cart items
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: { store: true }
        }
      }
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty.' });
    }

    // Verify stock availability
    for (const item of cartItems) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for product '${item.product.name}'. Available: ${item.product.stock} units.` });
      }
    }

    // Calculate finances
    let subtotal = 0;
    cartItems.forEach(item => {
      subtotal += item.product.price * item.quantity;
    });

    // Validate discount code if provided
    let discountApplied = 0;
    let discountType = null;
    let discountEntity = null;

    if (discountCode && discountCode.trim() !== '') {
      const upperCode = discountCode.trim().toUpperCase();

      // Check Promo
      const promo = await prisma.promo.findUnique({
        where: { code: upperCode }
      });

      if (promo) {
        const now = new Date();
        if (new Date(promo.expiryDate) < now) {
          return res.status(400).json({ message: 'Discount code has expired.' });
        }
        discountApplied = Math.min(promo.discountValue, subtotal);
        discountType = 'promo';
        discountEntity = promo;
      } else {
        // Check Voucher
        const voucher = await prisma.voucher.findUnique({
          where: { code: upperCode }
        });

        if (!voucher) {
          return res.status(400).json({ message: 'Invalid discount code.' });
        }

        const now = new Date();
        if (new Date(voucher.expiryDate) < now) {
          return res.status(400).json({ message: 'Discount code has expired.' });
        }
        if (voucher.remainingUsage <= 0) {
          return res.status(400).json({ message: 'Discount code has reached its usage limit.' });
        }
        discountApplied = Math.min(voucher.discountValue, subtotal);
        discountType = 'voucher';
        discountEntity = voucher;
      }
    }

    const deliveryFee = getDeliveryFee(deliveryMethod);
    const taxableSubtotal = Math.max(0, subtotal - discountApplied);
    const tax = Math.round(taxableSubtotal * 0.12); // PPN 12% on discounted subtotal
    const total = taxableSubtotal + deliveryFee + tax;

    // Verify wallet balance
    if (user.walletBalance < total) {
      return res.status(400).json({
        message: `Insufficient wallet balance. Total required is ${total}, but you only have ${user.walletBalance}.`
      });
    }

    const storeId = cartItems[0].product.storeId;

    // Run ATOMIC transaction
    const order = await prisma.$transaction(async (tx) => {
      // 1. Deduct wallet balance
      await tx.user.update({
        where: { id: userId },
        data: {
          walletBalance: {
            decrement: total
          }
        }
      });

      // 2. Decrement voucher usage if voucher code was used
      if (discountType === 'voucher' && discountEntity) {
        await tx.voucher.update({
          where: { id: discountEntity.id },
          data: {
            remainingUsage: {
              decrement: 1
            }
          }
        });
      }

      // 3. Decrement stock for each product
      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        });
      }

      // 4. Clear cart
      await tx.cartItem.deleteMany({
        where: { userId }
      });

      // 5. Create Order, OrderItems and initial OrderStatusHistory
      const newOrder = await tx.order.create({
        data: {
          buyerId: userId,
          storeId,
          subtotal,
          deliveryFee,
          tax,
          total,
          deliveryMethod,
          status: 'Sedang Dikemas',
          discountApplied,
          discountCode: discountCode ? discountCode.trim().toUpperCase() : null,
          items: {
            create: cartItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price
            }))
          },
          statusHistory: {
            create: {
              status: 'Sedang Dikemas',
              comment: 'Order placed successfully.'
            }
          }
        },
        include: {
          items: true,
          statusHistory: true
        }
      });

      return newOrder;
    });

    return res.status(201).json({
      message: 'Checkout successful! Order has been created.',
      order
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ message: 'Server error during checkout.', error: error.message });
  }
};

// Retrieve Buyer Orders history
const getOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await prisma.order.findMany({
      where: { buyerId: userId },
      include: {
        store: {
          select: { name: true }
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
    console.error('Get buyer orders error:', error);
    return res.status(500).json({ message: 'Server error loading order history.', error: error.message });
  }
};

module.exports = {
  topupWallet,
  updateAddress,
  addToCart,
  updateCart,
  deleteCart,
  clearCart,
  getCart,
  checkout,
  getOrders,
  validateDiscount,
  getSpendingReport
};
