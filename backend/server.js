require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Connect Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/', (req, res) => res.send('API Running'));

// Define Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/quiz', require('./routes/quiz.routes'));
app.use('/api/code', require('./routes/code.routes'));
app.use('/api/leaderboard', require('./routes/leaderboard.routes'));

const PORT = process.env.PORT || 5000;

const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: { origin: "*" }
});

let activeStudents = 0;

io.on('connection', (socket) => {
    socket.on('student_login', () => {
        activeStudents++;
        io.emit('stats_update', { activeStudents });
    });

    socket.on('student_logout', () => {
        if (activeStudents > 0) activeStudents--;
        io.emit('stats_update', { activeStudents });
    });

    socket.on('disconnect', () => {
        // Simple decrement on disconnect (could be more robust with specific socket ids tracking)
        if (activeStudents > 0) activeStudents--;
        io.emit('stats_update', { activeStudents });
    });

    socket.on('admin_broadcast', (msg) => {
        io.emit('server_message', msg);
    });

    // Initial stats for admin on connect
    socket.emit('stats_update', { activeStudents });
});

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
