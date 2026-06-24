const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Generate Voucher or Promo codes
const generateDiscounts = async (req, res) => {
  try {
    const { type, code, discountValue, expiryDate, remainingUsage } = req.body;

    if (!type || !code || discountValue === undefined || !expiryDate) {
      return res.status(400).json({ message: 'Fields type (voucher/promo), code, discountValue, and expiryDate are required.' });
    }

    const value = parseInt(discountValue, 10);
    if (isNaN(value) || value <= 0) {
      return res.status(400).json({ message: 'discountValue must be a valid positive integer.' });
    }

    const parsedExpiry = new Date(expiryDate);
    if (isNaN(parsedExpiry.getTime())) {
      return res.status(400).json({ message: 'expiryDate must be a valid date-time string.' });
    }

    const upperCode = code.trim().toUpperCase();

    if (type.toLowerCase() === 'voucher') {
      const usage = parseInt(remainingUsage, 10);
      if (isNaN(usage) || usage < 0) {
        return res.status(400).json({ message: 'remainingUsage must be a valid non-negative integer for vouchers.' });
      }

      // Check uniqueness in both tables
      const existingVoucher = await prisma.voucher.findUnique({ where: { code: upperCode } });
      const existingPromo = await prisma.promo.findUnique({ where: { code: upperCode } });
      if (existingVoucher || existingPromo) {
        return res.status(400).json({ message: `Discount code '${upperCode}' already exists.` });
      }

      const voucher = await prisma.voucher.create({
        data: {
          code: upperCode,
          discountValue: value,
          expiryDate: parsedExpiry,
          remainingUsage: usage
        }
      });

      return res.status(201).json({ message: 'Voucher generated successfully.', voucher });

    } else if (type.toLowerCase() === 'promo') {
      // Check uniqueness in both tables
      const existingVoucher = await prisma.voucher.findUnique({ where: { code: upperCode } });
      const existingPromo = await prisma.promo.findUnique({ where: { code: upperCode } });
      if (existingVoucher || existingPromo) {
        return res.status(400).json({ message: `Discount code '${upperCode}' already exists.` });
      }

      const promo = await prisma.promo.create({
        data: {
          code: upperCode,
          discountValue: value,
          expiryDate: parsedExpiry
        }
      });

      return res.status(201).json({ message: 'Promo generated successfully.', promo });

    } else {
      return res.status(400).json({ message: "Invalid discount type. Must be 'voucher' or 'promo'." });
    }

  } catch (error) {
    console.error('Generate discount error:', error);
    return res.status(500).json({ message: 'Server error generating discount.', error: error.message });
  }
};

// Helper to get overdue in-progress orders based on simulated time
const getOverdueOrders = async (nowSimulated) => {
  const inProgressOrders = await prisma.order.findMany({
    where: {
      status: {
        in: ['Sedang Dikemas', 'Menunggu Pengirim', 'Sedang Dikirim']
      }
    }
  });

  return inProgressOrders.filter(order => {
    const ageInMs = nowSimulated.getTime() - new Date(order.createdAt).getTime();
    const ageInDays = ageInMs / (24 * 60 * 60 * 1000);
    if (order.deliveryMethod === 'Instant' && ageInDays >= 1) return true;
    if (order.deliveryMethod === 'Next Day' && ageInDays >= 1) return true;
    if (order.deliveryMethod === 'Regular' && ageInDays >= 3) return true;
    return false;
  });
};

// GET /api/admin/dashboard
const getDashboard = async (req, res) => {
  try {
    const nowSimulated = new Date(Date.now() + (global.timeOffsetDays || 0) * 24 * 60 * 60 * 1000);

    const totalUsers = await prisma.user.count();
    const totalStores = await prisma.store.count();
    const totalProducts = await prisma.product.count();
    const totalOrders = await prisma.order.count();

    // Vouchers count active
    const vouchersCount = await prisma.voucher.count({
      where: {
        expiryDate: { gte: nowSimulated },
        remainingUsage: { gt: 0 }
      }
    });

    // Promos count active
    const promosCount = await prisma.promo.count({
      where: {
        expiryDate: { gte: nowSimulated }
      }
    });

    const activeDiscounts = vouchersCount + promosCount;

    // Overdue count
    const overdueOrders = await getOverdueOrders(nowSimulated);
    const overdueOrdersCount = overdueOrders.length;

    return res.status(200).json({
      totalUsers,
      totalStores,
      totalProducts,
      totalOrders,
      activeDiscounts,
      overdueOrdersCount,
      timeOffsetDays: global.timeOffsetDays || 0
    });

  } catch (error) {
    console.error('Get admin dashboard error:', error);
    return res.status(500).json({ message: 'Server error retrieving admin dashboard.', error: error.message });
  }
};

// POST /api/admin/simulate-next-day
const simulateNextDay = async (req, res) => {
  try {
    global.timeOffsetDays = (global.timeOffsetDays || 0) + 1;
    const nowSimulated = new Date(Date.now() + global.timeOffsetDays * 24 * 60 * 60 * 1000);

    const overdueOrders = await getOverdueOrders(nowSimulated);
    const processed = [];

    for (const order of overdueOrders) {
      // Find order items for stock restoration
      const items = await prisma.orderItem.findMany({
        where: { orderId: order.id }
      });

      // Run atomic transaction to refund buyer, restore stock, and set status to 'Dikembalikan'
      await prisma.$transaction(async (tx) => {
        // Re-query order to double-check status
        const currentOrder = await tx.order.findUnique({
          where: { id: order.id }
        });

        if (currentOrder.status === 'Dikembalikan') {
          return;
        }

        // a. Refund buyer wallet
        await tx.user.update({
          where: { id: order.buyerId },
          data: {
            walletBalance: { increment: order.total }
          }
        });

        // c. Restore stocks
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity }
            }
          });
        }

        // e. Set status and status history log
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'Dikembalikan',
            statusHistory: {
              create: {
                status: 'Dikembalikan',
                comment: `Order cancelled automatically due to SLA overdue. Refunded ${order.total} and restored item stocks.`
              }
            }
          }
        });
      });

      processed.push(order.id);
    }

    return res.status(200).json({
      message: `Time simulated 1 day forward. Total simulation offset: ${global.timeOffsetDays} days.`,
      simulatedDate: nowSimulated,
      overdueOrdersProcessed: processed
    });

  } catch (error) {
    console.error('Time simulation error:', error);
    return res.status(500).json({ message: 'Server error during time simulation.', error: error.message });
  }
};

const resetSimulation = async (req, res) => {
  try {
    global.timeOffsetDays = 0;
    return res.status(200).json({ message: 'Simulation offset reset to 0 days.' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error resetting simulation.', error: error.message });
  }
};

module.exports = {
  generateDiscounts,
  getDashboard,
  simulateNextDay,
  resetSimulation
};
