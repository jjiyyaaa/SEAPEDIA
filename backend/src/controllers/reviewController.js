const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sanitizeInput } = require('../utils/security');

// Create application review (Guest access)
const createReview = async (req, res) => {
  try {
    const { reviewerName, rating, comment } = req.body;

    // Validate inputs
    if (!reviewerName || rating === undefined || !comment) {
      return res.status(400).json({ message: 'All fields (reviewerName, rating, comment) are required.' });
    }

    const parsedRating = parseInt(rating, 10);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5.' });
    }

    const cleanReviewerName = sanitizeInput(reviewerName.trim());
    const cleanComment = sanitizeInput(comment.trim());

    const review = await prisma.applicationReview.create({
      data: {
        reviewerName: cleanReviewerName,
        rating: parsedRating,
        comment: cleanComment
      }
    });

    return res.status(201).json({
      message: 'Review submitted successfully.',
      review
    });

  } catch (error) {
    return res.status(500).json({ message: 'Server error creating review.', error: error.message });
  }
};

// Get all application reviews (Guest access)
const getReviews = async (req, res) => {
  try {
    const reviews = await prisma.applicationReview.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json(reviews);

  } catch (error) {
    return res.status(500).json({ message: 'Server error retrieving reviews.', error: error.message });
  }
};

module.exports = {
  createReview,
  getReviews
};
