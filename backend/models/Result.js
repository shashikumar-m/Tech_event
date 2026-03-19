const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    score: {
        type: Number,
        default: 0
    },
    totalTime: {
        type: Number, // Total time taken across all submitted answers
        default: 0
    },
    violationCount: {
        type: Number, // Tracking tab switches
        default: 0
    },
    isLocked: {
        type: Boolean,
        default: false // Set to true when exam is auto-submitted or finished
    }
}, { timestamps: true });

resultSchema.index({ userId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('Result', resultSchema);
