const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/driver/jobs
const getAvailableJobs = async (req, res) => {
  try {
    const jobs = await prisma.order.findMany({
      where: { status: 'Menunggu Pengirim' },
      include: {
        store: { select: { name: true } },
        buyer: { select: { username: true, address: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(jobs);
  } catch (error) {
    console.error('Get available jobs error:', error);
    return res.status(500).json({ message: 'Server error loading jobs.', error: error.message });
  }
};

// POST /api/driver/jobs/:id/take
const takeJob = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const driverId = req.user.id;

    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID.' });
    }

    // Check current state in database
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (order.status !== 'Menunggu Pengirim') {
      return res.status(400).json({ message: 'Job is no longer available.' });
    }

    if (order.driverId !== null) {
      return res.status(400).json({ message: 'Job has already been taken by another driver.' });
    }

    // Perform update to take job and update status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        driverId,
        status: 'Sedang Dikirim',
        statusHistory: {
          create: {
            status: 'Sedang Dikirim',
            comment: 'Order picked up by courier and is on its way.'
          }
        }
      },
      include: {
        statusHistory: true
      }
    });

    return res.status(200).json({
      message: 'Job accepted successfully. You are now the courier for this order.',
      order: updatedOrder
    });

  } catch (error) {
    console.error('Take job error:', error);
    return res.status(500).json({ message: 'Server error taking job.', error: error.message });
  }
};

// POST /api/driver/jobs/:id/complete
const completeJob = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const driverId = req.user.id;

    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (order.driverId !== driverId) {
      return res.status(403).json({ message: 'Access denied. You are not assigned to this delivery job.' });
    }

    if (order.status !== 'Sedang Dikirim') {
      return res.status(400).json({ message: 'Only active deliveries can be completed.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'Pesanan Selesai',
        statusHistory: {
          create: {
            status: 'Pesanan Selesai',
            comment: 'Order has been delivered successfully to customer address.'
          }
        }
      },
      include: {
        statusHistory: true
      }
    });

    return res.status(200).json({
      message: 'Delivery completed successfully.',
      order: updatedOrder
    });

  } catch (error) {
    console.error('Complete job error:', error);
    return res.status(500).json({ message: 'Server error completing delivery.', error: error.message });
  }
};

// GET /api/driver/dashboard
const getDriverDashboard = async (req, res) => {
  try {
    const driverId = req.user.id;

    // Active task
    const activeJob = await prisma.order.findFirst({
      where: {
        driverId,
        status: 'Sedang Dikirim'
      },
      include: {
        store: { select: { name: true } },
        buyer: { select: { username: true, email: true, address: true } },
        items: {
          include: { product: { select: { name: true } } }
        }
      }
    });

    // Work history
    const history = await prisma.order.findMany({
      where: {
        driverId,
        status: 'Pesanan Selesai'
      },
      include: {
        store: { select: { name: true } },
        buyer: { select: { username: true, address: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Calculate earnings from delivery fee of completed orders
    let earnings = 0;
    history.forEach(order => {
      earnings += order.deliveryFee;
    });

    return res.status(200).json({
      activeJob,
      history,
      earnings
    });

  } catch (error) {
    console.error('Get driver dashboard error:', error);
    return res.status(500).json({ message: 'Server error loading driver dashboard.', error: error.message });
  }
};

module.exports = {
  getAvailableJobs,
  takeJob,
  completeJob,
  getDriverDashboard
};
