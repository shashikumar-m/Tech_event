const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['mcq', 'coding'],
        required: true
    },
    text: {
        type: String,
        required: true
    },
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    // For MCQ
    options: [{
        text: String,
        isCorrect: Boolean
    }],
    // For Coding
    language: {
        type: String,
        default: 'javascript'
    },
    initialCode: {
        type: String
    },
    testCases: [{
        input: String,
        expectedOutput: String,
        isHidden: { type: Boolean, default: false }
    }],
    order: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
