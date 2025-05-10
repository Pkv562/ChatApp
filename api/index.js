const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User.js');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { StreamChat } = require('stream-chat');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

// Initialize Stream Chat client for text messaging
const streamChatClient = StreamChat.getInstance(process.env.STREAM_API_KEY, process.env.STREAM_API_SECRET);

const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use('/api', express.static('public'));

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Store active users and their socket connections
const activeCalls = new Map();
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);
    let currentUserId = null;

    socket.on('register', async (userId) => {
        console.log(`User ${userId} registering with socket ${socket.id}`);
        currentUserId = userId;

        // Clean up old sockets for this user
        if (activeUsers.has(userId)) {
            const oldSockets = activeUsers.get(userId);
            oldSockets.forEach((socketId) => {
                if (socketId !== socket.id) {
                    const oldSocket = io.sockets.sockets.get(socketId);
                    if (oldSocket) {
                        oldSocket.disconnect(true);
                        console.log(`Disconnected old socket ${socketId} for user ${userId}`);
                    }
                }
            });
        }

        // Store new socket
        if (!activeUsers.has(userId)) {
            activeUsers.set(userId, new Set());
        }
        activeUsers.get(userId).add(socket.id);
        console.log(`Active sockets for user ${userId}:`, [...activeUsers.get(userId)]);

        // Notify others of user online status
        const user = await User.findById(userId, 'username');
        const username = user ? user.username : 'Unknown';
        socket.broadcast.emit('user-online', { userId, username });
    });

    socket.on('call-request', ({ callId, calleeId, callerId, callerName }) => {
        console.log(`Call request from ${callerId} to ${calleeId} with callId ${callId}`);

        // Validate inputs
        if (!callId || !calleeId || !callerId) {
            console.error('Invalid call request parameters:', { callId, calleeId, callerId });
            socket.emit('call-failed', {
                reason: 'invalid-parameters',
                message: 'Invalid call parameters'
            });
            return;
        }

        if (callerId === calleeId) {
            console.log('Self-call detected');
            socket.emit('call-failed', {
                reason: 'self-call',
                message: 'You cannot call yourself'
            });
            return;
        }

        // Check if callee is online
        const calleeSocketIds = activeUsers.get(calleeId);
        console.log(`Callee ${calleeId} socket IDs:`, calleeSocketIds ? [...calleeSocketIds] : 'none');
        if (!calleeSocketIds || calleeSocketIds.size === 0) {
            console.log(`Callee ${calleeId} is offline`);
            socket.emit('call-not-available', {
                userId: calleeId,
                reason: 'user-offline'
            });
            return;
        }

        // Check if callee is already in a call
        for (const [existingCallId, call] of activeCalls) {
            if (call.participants.includes(calleeId) && call.status === 'active') {
                console.log(`Callee ${calleeId} is already in a call`);
                socket.emit('call-not-available', {
                    userId: calleeId,
                    reason: 'user-busy'
                });
                return;
            }
        }

        // Store call
        activeCalls.set(callId, {
            participants: [callerId, calleeId],
            status: 'pending',
            createdAt: Date.now()
        });

        // Notify callee
        calleeSocketIds.forEach((socketId) => {
            const calleeSocket = io.sockets.sockets.get(socketId);
            if (calleeSocket) {
                console.log(`Emitting incoming-call to socket ${socketId}`);
                calleeSocket.emit('incoming-call', {
                    callId,
                    callerId,
                    callerName
                });
            } else {
                console.warn(`Socket ${socketId} not found for callee ${calleeId}`);
            }
        });

        // Notify caller that the call is ringing
        socket.emit('call-ringing', { callId });
    });

    socket.on('call-accepted', ({ callId, calleeId, callerId }) => {
        console.log(`Call ${callId} accepted by ${calleeId}`);
        const call = activeCalls.get(callId);

        if (!call) {
            console.error(`Call ${callId} not found`);
            socket.emit('call-failed', {
                reason: 'call-not-found',
                message: 'Call does not exist'
            });
            return;
        }

        if (call.status !== 'pending') {
            console.error(`Call ${callId} is not in pending state`);
            socket.emit('call-failed', {
                reason: 'invalid-state',
                message: 'Call is not pending'
            });
            return;
        }

        call.status = 'active';

        const callerSocketIds = activeUsers.get(callerId);
        if (callerSocketIds) {
            callerSocketIds.forEach((socketId) => {
                const callerSocket = io.sockets.sockets.get(socketId);
                if (callerSocket) {
                    console.log(`Emitting call-accepted to socket ${socketId}`);
                    callerSocket.emit('call-accepted', {
                        callId,
                        calleeId
                    });
                }
            });
        } else {
            console.warn(`No active sockets for caller ${callerId}`);
        }
    });

    socket.on('call-rejected', ({ callId, calleeId, callerId }) => {
        console.log(`Call ${callId} rejected by ${calleeId}`);
        const call = activeCalls.get(callId);

        if (!call) {
            console.error(`Call ${callId} not found`);
            return;
        }

        const callerSocketIds = activeUsers.get(callerId);
        if (callerSocketIds) {
            callerSocketIds.forEach((socketId) => {
                const callerSocket = io.sockets.sockets.get(socketId);
                if (callerSocket) {
                    console.log(`Emitting call-rejected to socket ${socketId}`);
                    callerSocket.emit('call-rejected', {
                        callId,
                        calleeId
                    });
                }
            });
        } else {
            console.warn(`No active sockets for caller ${callerId}`);
        }

        activeCalls.delete(callId);
    });

    socket.on('disconnect', () => {
        console.log(`Socket ${socket.id} disconnected`);
        if (currentUserId) {
            const userSockets = activeUsers.get(currentUserId);
            if (userSockets) {
                userSockets.delete(socket.id);
                console.log(`Removed socket ${socket.id} for user ${currentUserId}. Remaining sockets:`, [...userSockets]);
                if (userSockets.size === 0) {
                    activeUsers.delete(currentUserId);
                    console.log(`User ${currentUserId} is now offline`);
                    socket.broadcast.emit('user-offline', { userId: currentUserId });

                    // End any active calls for this user
                    for (const [callId, call] of activeCalls) {
                        if (call.participants.includes(currentUserId)) {
                            const otherUserId = call.participants.find(id => id !== currentUserId);
                            const otherSocketIds = activeUsers.get(otherUserId);
                            if (otherSocketIds) {
                                otherSocketIds.forEach((socketId) => {
                                    const otherSocket = io.sockets.sockets.get(socketId);
                                    if (otherSocket) {
                                        console.log(`Emitting call-ended to socket ${socketId}`);
                                        otherSocket.emit('call-ended', {
                                            callId,
                                            reason: 'user-disconnected'
                                        });
                                    }
                                });
                            }
                            activeCalls.delete(callId);
                        }
                    }
                }
            }
        }
    });
});

// Periodic cleanup of stale calls
setInterval(() => {
    const now = Date.now();
    for (const [callId, call] of activeCalls) {
        if (call.status === 'pending' && now - call.createdAt > 30000) {
            console.log(`Cleaning up stale call ${callId}`);
            const [callerId, calleeId] = call.participants;
            const callerSocketIds = activeUsers.get(callerId);
            if (callerSocketIds) {
                callerSocketIds.forEach((socketId) => {
                    const callerSocket = io.sockets.sockets.get(socketId);
                    if (callerSocket) {
                        console.log(`Emitting call-failed to socket ${socketId}`);
                        callerSocket.emit('call-failed', {
                            reason: 'timeout',
                            message: 'Call timed out'
                        });
                    }
                });
            }
            activeCalls.delete(callId);
        }
    }
}, 10000);

// Get user data from JWT token
async function getUserDataFromRequest(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies?.token;
        console.log("Token from cookie:", token);
        if (token) {
            jwt.verify(token, jwtSecret, {}, (err, userData) => {
                if (err) {
                    console.error("JWT verification error:", err);
                    return reject("Invalid token");
                }
                User.findById(userData.userId)
                    .then(user => {
                        if (!user) return reject("User not found");
                        resolve(userData);
                    })
                    .catch((err) => reject(`Error finding user: ${err.message}`));
            });
        } else {
            reject("No token found");
        }
    });
}

// Generate Stream tokens for Chat
app.post('/api/token', async (req, res) => {
    try {
        const userData = await getUserDataFromRequest(req);
        const user = await User.findById(userData.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const chatToken = streamChatClient.createToken(user._id.toString());
        const videoToken = streamChatClient.createToken(user._id.toString());

        await streamChatClient.upsertUser({
            id: user._id.toString(),
            name: user.username,
        });

        res.json({ chatToken, videoToken });
    } catch (err) {
        console.error("Token generation error:", err);
        res.status(401).json({ error: err.message });
    }
});

// Get all users for contact list and sync with Stream
app.get('/api/people', async (req, res) => {
    try {
        const userData = await getUserDataFromRequest(req);
        const users = await User.find({ _id: { $ne: userData.userId } }, { '_id': 1, username: 1 });

        const streamUsers = users.map(user => ({
            id: user._id.toString(),
            name: user.username,
        }));
        await streamChatClient.upsertUsers(streamUsers);

        res.json(users);
    } catch (err) {
        console.error("People endpoint error:", err);
        res.status(401).json({ error: err.message });
    }
});

// Profile endpoint
app.get('/api/profile', async (req, res) => {
    try {
        console.log("Processing /api/profile request...");
        const userData = await getUserDataFromRequest(req);
        const user = await User.findById(userData.userId);
        if (!user) return res.status(404).json({ error: "User not found" });
        console.log("Profile data for user:", user);
        res.json({
            id: user._id,
            username: user.username,
        });
    } catch (err) {
        console.error("Profile endpoint error:", err);
        res.status(401).json({ error: err.message });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log("Login attempt for username:", username);
    if (!username || !password) {
        console.log("Missing username or password");
        return res.status(400).json({ error: "Username and password are required" });
    }

    try {
        if (mongoose.connection.readyState !== 1) {
            console.log("MongoDB not connected");
            throw new Error("MongoDB is not connected");
        }

        console.log("Querying user...");
        const foundUser = await User.findOne({ username });
        if (!foundUser) {
            console.log("User not found");
            return res.status(404).json({ error: "User not found" });
        }

        console.log("Verifying password...");
        const passOK = bcrypt.compareSync(password, foundUser.password);
        if (!passOK) {
            console.log("Incorrect password");
            return res.status(401).json({ error: "Incorrect password" });
        }

        console.log("Generating Stream token...");
        let chatToken;
        try {
            chatToken = streamChatClient.createToken(foundUser._id.toString());
            console.log("Token generated:", { chatToken });
        } catch (err) {
            console.log("Token generation failed:", err.message);
            throw new Error(`Failed to generate Stream token: ${err.message}`);
        }

        console.log("Generating JWT...");
        jwt.sign(
            { userId: foundUser._id },
            jwtSecret,
            {},
            (err, token) => {
                if (err) {
                    console.log("JWT generation failed:", err.message);
                    throw new Error(`Failed to generate JWT: ${err.message}`);
                }
                const cookieOptions = {
                    httpOnly: true,
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                    secure: process.env.NODE_ENV === 'production',
                };
                console.log("Setting cookie with options:", cookieOptions);
                console.log("Setting cookie and sending response...");
                res.cookie('token', token, cookieOptions).status(200).json({
                    id: foundUser._id,
                    username: foundUser.username,
                    chatToken
                });
            }
        );
    } catch (err) {
        console.error("Login error:", err.message, err.stack);
        res.status(500).json({ error: `Server error during login: ${err.message}` });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    const cookieOptions = {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production',
    };
    console.log("Clearing cookie with options:", cookieOptions);
    res.cookie('token', '', cookieOptions).json('ok');
});

// Register endpoint
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: "Username already exists" });
        }

        const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
        const createdUser = await User.create({
            username: username,
            password: hashedPassword,
        });

        await streamChatClient.upsertUser({
            id: createdUser._id.toString(),
            name: createdUser.username,
        });

        const chatToken = streamChatClient.createToken(createdUser._id.toString());

        jwt.sign(
            { userId: createdUser._id },
            jwtSecret,
            {},
            (err, token) => {
                if (err) {
                    console.error("JWT signing error:", err);
                    return res.status(500).json({ error: "Failed to generate token" });
                }
                const cookieOptions = {
                    httpOnly: true,
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                    secure: process.env.NODE_ENV === 'production',
                };
                console.log("Setting cookie with options:", cookieOptions);
                res.cookie('token', token, cookieOptions).status(201).json({
                    id: createdUser._id,
                    username,
                    chatToken
                });
            }
        );
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ error: "Error creating user" });
    }
});

server.listen(4000, () => {
    console.log(`Server running on port 4000`);
});