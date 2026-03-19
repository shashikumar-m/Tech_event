const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const Submission = require('../models/Submission');
const { protect } = require('../middleware/auth');

// @desc    Calculate and lock Result for a user (Triggered on Exam completion)
// @route   POST /api/leaderboard/calculate
router.post('/calculate', protect, async (req, res) => {
    try {
        if(req.user.role !== 'student') return res.status(403).json({ message: 'Not authorized' });

        const { violationCount, totalTime } = req.body;
        const eventId = req.user.eventId;

        // Sum up correct submissions
        const submissions = await Submission.find({ userId: req.user._id, eventId });
        
        let score = 0;
        submissions.forEach(sub => {
            if (sub.isCorrect) score += 10; // 10 points per correct answer as default
        });

        const result = await Result.findOneAndUpdate(
            { userId: req.user._id, eventId },
            { 
                score, 
                totalTime: totalTime || 0,
                violationCount: violationCount || 0,
                isLocked: true 
            },
            { upsert: true, new: true }
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get leaderboard for an event
// @route   GET /api/leaderboard/:eventId
router.get('/:eventId', protect, async (req, res) => {
    try {
         // Sort by highest score first, then lowest time taken
         const leaderboard = await Result.find({ eventId: req.params.eventId })
             .populate('userId', 'username')
             .sort({ score: -1, totalTime: 1 })
             .lean();

         res.json(leaderboard);
    } catch (error) {
         res.status(500).json({ message: error.message });
    }
});

module.exports = router;
