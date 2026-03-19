const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const Event = require('../models/Event');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// @desc    Get Event info
// @route   GET /api/quiz/event-info
router.get('/event-info', async (req, res) => {
    try {
        const event = await Event.findById(req.user.eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        
        res.json({
            eventId: event.eventId,
            name: event.name,
            startTime: event.startTime,
            round2StartTime: event.round2StartTime
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get questions for student (hide answers/test cases)
// @route   GET /api/quiz/questions
router.get('/questions', async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can access this route' });
        }

        const questions = await Question.find({ eventId: req.user.eventId }).sort({ order: 1 }).lean();
        
        // Remove sensitive info before sending to client
        const safeQuestions = questions.map(q => {
            if (q.type === 'mcq') {
                q.options = q.options.map(opt => ({ _id: opt._id, text: opt.text })); // remove isCorrect
            } else if (q.type === 'coding') {
                q.testCases = q.testCases.filter(tc => !tc.isHidden); // hide hidden test cases
            }
            return q;
        });

        res.json(safeQuestions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Submit MCQ Answer
// @route   POST /api/quiz/submit-mcq
router.post('/submit-mcq', async (req, res) => {
    try {
        const { questionId, selectedOptionIndex, timeTaken } = req.body;
        
        const question = await Question.findById(questionId);
        if (!question || question.type !== 'mcq') {
            return res.status(404).json({ message: 'Invalid MCQ Question' });
        }

        const isCorrect = question.options[selectedOptionIndex]?.isCorrect || false;

        // Upsert Submission
        const submission = await Submission.findOneAndUpdate(
            { userId: req.user._id, questionId },
            { 
                eventId: req.user.eventId, 
                type: 'mcq', 
                selectedOptionIndex, 
                isCorrect,
                timeTaken 
            },
            { upsert: true, new: true }
        );

        res.json({ message: 'Submitted', isCorrect }); // remove isCorrect in prod if strict
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
