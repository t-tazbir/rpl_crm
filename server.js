const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // Bug #6 fix — required for req.cookies in authMiddleware.js
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
// Bug #6 fix: cors() with a wildcard origin (the previous config) is INCOMPATIBLE with
// credentialed requests — browsers refuse to expose/send cookies when
// Access-Control-Allow-Origin is '*'. We must echo back a specific origin and set
// credentials: true. Set CORS_ORIGIN in .env to your actual frontend origin in production;
// this only matters if the frontend is served from a different origin than the API — if
// both are served from this same Express app (as public/ is below), the browser treats
// requests as same-origin and this CORS config is never even consulted.
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5000',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser()); // Bug #6 fix — parses the HttpOnly auth cookie into req.cookies

// 1. Serve Static Frontend Files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// 2. Root Route -> Direct redirect to Login Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 3. API Routes Pipeline
const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/leadRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const todoRoutes = require('./routes/todoRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/todos', todoRoutes);

// 4. Background jobs
const { startFollowupReminderJob } = require('./jobs/followupReminderJob');
startFollowupReminderJob();

const { startLeadUnassignJob } = require('./jobs/leadUnassignJob');
startLeadUnassignJob();

// Server Listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running smoothly on port ${PORT}`);
});