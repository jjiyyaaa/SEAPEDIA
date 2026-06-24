const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// List all products from all stores
const listProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        store: {
          select: {
            id: true,
            name: true,
            userId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json(products);

  } catch (error) {
    console.error('List products error:', error);
    return res.status(500).json({ message: 'Server error loading product catalog.', error: error.message });
  }
};

// Get product details with nested store information
const getProductDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid product ID.' });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            userId: true,
            user: {
              select: {
                username: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    return res.status(200).json(product);

  } catch (error) {
    console.error('Get product detail error:', error);
    return res.status(500).json({ message: 'Server error loading product details.', error: error.message });
  }
};

module.exports = {
  listProducts,
  getProductDetail
};
