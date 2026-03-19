const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true
    },
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    type: {
        type: String,
        enum: ['mcq', 'coding'],
        required: true
    },
    // For MCQ
    selectedOptionIndex: {
        type: Number
    },
    // For Coding
    code: {
        type: String
    },
    isCorrect: {
        type: Boolean,
        default: false
    },
    timeTaken: {
        type: Number, // in seconds from start of exam
        default: 0
    }
}, { timestamps: true });

// Ensure one submission per question per user
submissionSchema.index({ userId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
