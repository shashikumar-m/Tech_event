const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { username, password, eventId } = req.body;

        const user = await User.findOne({ username }).populate('eventId');

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Only check eventId for student
        if (user.role === 'student' && (!user.eventId || user.eventId.eventId !== eventId)) {
             return res.status(401).json({ message: 'Invalid Event ID for this user' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Create JWT payload
        const payload = {
            id: user._id,
            role: user.role
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                eventId: user.role === 'student' ? user.eventId : null
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Create first admin (Temporary route just to seed data if needed)
// @route   POST /api/auth/seed-admin
router.get('/seed-admin', async (req, res) => {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if(adminExists) {
            return res.status(400).json({ message: 'Admin already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        const admin = new User({
            username: 'admin',
            password: hashedPassword,
            role: 'admin'
        });

        await admin.save();
        res.status(201).json({ message: 'Admin user created. Login with admin:admin123' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
})

module.exports = router;
