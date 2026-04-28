const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash });
    const token = signToken(user);
    return res.status(201).json({ token, user: user.toJSON() });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ message: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = signToken(user);
    return res.json({ token, user: user.toJSON() });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ message: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  return res.json({ user: req.user.toJSON() });
});

module.exports = router;
