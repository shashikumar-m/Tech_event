const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const Question = require('../models/Question');
const { protect, admin } = require('../middleware/auth');
const bcrypt = require('bcrypt');

// All routes require admin
router.use(protect, admin);

// @desc    Create an Event
// @route   POST /api/admin/events
router.post('/events', async (req, res) => {
    try {
        const { name, eventId, startTime, duration } = req.body;
        
        const eventExists = await Event.findOne({ eventId });
        if (eventExists) return res.status(400).json({ message: 'Event ID already exists' });

        const event = await Event.create({
            name,
            eventId,
            startTime,
            duration,
            createdBy: req.user._id
        });

        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all events
// @route   GET /api/admin/events
router.get('/events', async (req, res) => {
    try {
        const events = await Event.find({});
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete an Event
// @route   DELETE /api/admin/events/:eventId
router.delete('/events/:eventId', async (req, res) => {
    try {
        const event = await Event.findOne({ eventId: req.params.eventId });
        if (!event) return res.status(404).json({ message: 'Event not found' });
        
        await Event.findByIdAndDelete(event._id);
        await Question.deleteMany({ eventId: event._id });
        await User.deleteMany({ eventId: event._id, role: 'student' });
        
        res.json({ message: 'Event and associated data deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});





// @desc    Create Student Users for an Event
// @route   POST /api/admin/users
router.post('/users', async (req, res) => {
    try {
        const { users, eventId } = req.body; // users = [{ username, password }]
        
        const event = await Event.findOne({ eventId });
        if (!event) return res.status(404).json({ message: 'Event not found' });

        const createdUsers = [];
        for (let user of users) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(user.password, salt);
            
            const newUser = await User.create({
                username: user.username,
                password: hashedPassword,
                email: user.email,
                role: 'student',
                eventId: event._id
            });
            createdUsers.push(newUser);

            // Send Email if EMAIL_USER is configured and email is provided
           if (user.email) {
    try {
        await resend.emails.send({
            from: 'noreply@yourdomain.com',
            to: user.email,
            subject: `Registration for ${event.name}`,
            html: `<h3>Hello,</h3>
                   <p>You have been registered for <strong>${event.name}</strong>.</p>
                   <p>Your login details:</p>
                   <ul>
                     <li><strong>Username:</strong> ${user.username}</li>
                     <li><strong>Password:</strong> ${user.password}</li>
                     <li><strong>Event ID:</strong> ${event.eventId}</li>
                   </ul>`
        });

        console.log("Email sent to:", user.email);

    } catch (err) {
        console.log("EMAIL ERROR FULL:", err);
    }
}
        }

        res.status(201).json({ message: `${createdUsers.length} users created successfully` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Add Question
// @route   POST /api/admin/questions
router.post('/questions', async (req, res) => {
    try {
        const { eventId, type, text, options, language, initialCode, testCases } = req.body;
        
        const event = await Event.findOne({ eventId });
        if (!event) return res.status(404).json({ message: 'Event not found' });

        const question = await Question.create({
            eventId: event._id,
            type,
            text,
            options,
            language,
            initialCode,
            testCases
        });

        res.status(201).json(question);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get Questions for Event
// @route   GET /api/admin/questions/:eventId
router.get('/questions/:eventId', async (req, res) => {
    try {
         const event = await Event.findOne({ eventId: req.params.eventId });
         if(!event) return res.status(404).json({ message: 'Event not found' });
         
         const questions = await Question.find({ eventId: event._id }).sort({ order: 1 });
         res.json(questions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update Event Settings (like round2StartTime)
// @route   PUT /api/admin/events/:eventId
router.put('/events/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { round2StartTime } = req.body;
        
        const event = await Event.findOneAndUpdate(
            { eventId }, 
            { round2StartTime }, 
            { new: true }
        );
        if (!event) return res.status(404).json({ message: 'Event not found' });

        res.json(event);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Reorder Questions
// @route   PUT /api/admin/questions/order
router.put('/questions/order', async (req, res) => {
    try {
        const { orderedQuestions } = req.body; // Array of { _id, order }
        
        const updates = orderedQuestions.map(q => ({
            updateOne: {
                filter: { _id: q._id },
                update: { order: q.order }
            }
        }));

        if (updates.length > 0) {
            await Question.bulkWrite(updates);
        }

        res.json({ message: 'Order updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
