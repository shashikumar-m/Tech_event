const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: false
    },
    role: {
        type: String,
        enum: ['admin', 'student'],
        default: 'student'
    },
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: function() { return this.role === 'student'; }
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
