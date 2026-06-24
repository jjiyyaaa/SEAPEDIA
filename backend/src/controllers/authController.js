const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'seapedia_secure_jwt_secret_token_key_2026';

// Register User
const register = async (req, res) => {
  try {
    const { username, email, password, roles } = req.body;

    // Validate inputs
    if (!username || !email || !password || !roles) {
      return res.status(400).json({ message: 'All fields (username, email, password, roles) are required.' });
    }

    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ message: 'Roles must be a non-empty array.' });
    }

    // Validate role types
    const validRoles = ['ADMIN', 'SELLER', 'BUYER', 'DRIVER'];
    const invalidRoles = roles.filter(role => !validRoles.includes(role));
    if (invalidRoles.length > 0) {
      return res.status(400).json({ message: `Invalid roles: ${invalidRoles.join(', ')}. Allowed values are: ADMIN, SELLER, BUYER, DRIVER.` });
    }

    // Validate Admin constraint (Admin cannot be combined with other roles)
    if (roles.includes('ADMIN') && roles.length > 1) {
      return res.status(400).json({ message: 'The ADMIN role cannot be combined with other roles.' });
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: email }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ message: 'Username is already taken.' });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ message: 'Email is already registered.' });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and roles in transaction/nested relation
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        roles: {
          create: roles.map(role => ({ role }))
        }
      },
      include: {
        roles: true
      }
    });

    const userRoles = newUser.roles.map(r => r.role);

    return res.status(201).json({
      message: 'User registered successfully.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        roles: userRoles
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
};

// Login User
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username/email and password are required.' });
    }

    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ]
      },
      include: {
        roles: true
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid username/email or password.' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username/email or password.' });
    }

    const roleNames = user.roles.map(r => r.role);
    if (roleNames.length === 0) {
      return res.status(400).json({ message: 'User has no assigned roles. Please contact administration.' });
    }

    // Handle single vs multiple roles
    if (roleNames.length === 1) {
      const activeRole = roleNames[0];
      const token = jwt.sign(
        { id: user.id, username: user.username, activeRole },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.status(200).json({
        message: 'Login successful.',
        token,
        requireRoleSelection: false,
        activeRole,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: roleNames
        }
      });
    } else {
      // User has multiple roles, must issue a temporary token
      const tempToken = jwt.sign(
        { id: user.id, isTemp: true, roles: roleNames },
        JWT_SECRET,
        { expiresIn: '10m' } // 10 minutes to select role
      );

      return res.status(200).json({
        message: 'Select active role to complete login.',
        token: tempToken,
        requireRoleSelection: true,
        roles: roleNames
      });
    }

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
};

// Select Active Role (Uses temporary token)
const selectRole = async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.user.id;
    const allowedRoles = req.user.roles; // Injected from temporary JWT payload

    if (!role) {
      return res.status(400).json({ message: 'Role selection is required.' });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: `Role '${role}' is not assigned to this user.` });
    }

    // Fetch user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Issue final session JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, activeRole: role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      message: 'Role selected. Login completed.',
      token,
      activeRole: role,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles.map(r => r.role)
      }
    });

  } catch (error) {
    console.error('Role selection error:', error);
    return res.status(500).json({ message: 'Server error during role selection.', error: error.message });
  }
};

// Switch Active Role (Uses final token)
const switchRole = async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.user.id; // From verifyToken

    if (!role) {
      return res.status(400).json({ message: 'Role is required to switch.' });
    }

    // Query DB to verify if user has this role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const roleNames = user.roles.map(r => r.role);
    if (!roleNames.includes(role)) {
      return res.status(403).json({ message: `Role '${role}' is not assigned to you.` });
    }

    // Issue new session JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, activeRole: role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      message: `Switched active role to ${role}.`,
      token,
      activeRole: role,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: roleNames
      }
    });

  } catch (error) {
    console.error('Role switch error:', error);
    return res.status(500).json({ message: 'Server error during role switch.', error: error.message });
  }
};

// Get User Profile & Active Role (Protected by final token middleware)
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const activeRole = req.user.activeRole;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      walletBalance: user.walletBalance,
      address: user.address,
      roles: user.roles.map(r => r.role),
      activeRole
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ message: 'Server error retrieving profile.', error: error.message });
  }
};

module.exports = {
  register,
  login,
  selectRole,
  switchRole,
  getProfile
};
