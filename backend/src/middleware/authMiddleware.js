const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Access denied. Invalid token format.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seapedia_secure_jwt_secret_token_key_2026');
    if (decoded.isTemp) {
      return res.status(403).json({ message: 'Access forbidden. Complete role selection first.' });
    }
    req.user = decoded; // Contains id, username, activeRole
    next();
  } catch (error) {
    return res.status(400).json({ message: 'Invalid token.' });
  }
};

const verifyTempToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Access denied. Invalid token format.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seapedia_secure_jwt_secret_token_key_2026');
    if (!decoded.isTemp) {
      return res.status(400).json({ message: 'Invalid token. Expected role selection token.' });
    }
    req.user = decoded; // Contains id, roles
    next();
  } catch (error) {
    return res.status(400).json({ message: 'Invalid token.' });
  }
};

const verifySeller = (req, res, next) => {
  if (!req.user || req.user.activeRole !== 'SELLER') {
    return res.status(403).json({ message: 'Access forbidden. Active role must be SELLER.' });
  }
  next();
};

const verifyBuyer = (req, res, next) => {
  if (!req.user || req.user.activeRole !== 'BUYER') {
    return res.status(403).json({ message: 'Access forbidden. Active role must be BUYER.' });
  }
  next();
};

const verifyDriver = (req, res, next) => {
  if (!req.user || req.user.activeRole !== 'DRIVER') {
    return res.status(403).json({ message: 'Access forbidden. Active role must be DRIVER.' });
  }
  next();
};

const verifyAdmin = (req, res, next) => {
  if (!req.user || req.user.activeRole !== 'ADMIN') {
    return res.status(403).json({ message: 'Access forbidden. Active role must be ADMIN.' });
  }
  next();
};

module.exports = {
  verifyToken,
  verifyTempToken,
  verifySeller,
  verifyBuyer,
  verifyDriver,
  verifyAdmin
};
