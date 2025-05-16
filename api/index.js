// index.js: Backend server for a real-time chat and video call application
// This file sets up an Express server with MongoDB for user management,
// Socket.io for real-time communication, and Stream Chat for chat/video functionality.

// Import required dependencies
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

// Load environment variables from .env file
// This allows secure configuration of sensitive data like API keys and database URLs
dotenv.config();

// Connect to MongoDB database
// Uses the MONGO_URL from environment variables to establish a connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Connected to MongoDB10:36 PM PST on Friday, May 16, 2025"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

// Initialize Stream Chat client
// Stream Chat is used for chat and video call functionality
const streamChatClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET
);

// Store JWT secret and bcrypt salt for secure authentication
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

// Initialize Express application
const app = express();

// Middleware setup
app.use(express.json()); // Parse JSON request bodies
app.use(cookieParser()); // Parse cookies for JWT authentication
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173', // Allow requests from client URL
  credentials: true, // Allow cookies to be sent with requests
}));
app.use('/api', express.static('public')); // Serve static files from public directory

// Create HTTP server and initialize Socket.io
// Socket.io enables real-time, bidirectional communication between clients and server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Data structures to track active users and calls
// activeUsers: Maps user IDs to sets of their active socket IDs
// activeCalls: Maps call IDs to call details (participants, status, createdAt)
const activeCalls = new Map();
const activeUsers = new Map();

// Socket.io event handlers for real-time communication
io.on('connection', (socket) => {
  // Log new socket connection
  console.log('New socket connection:', socket.id);
  let currentUserId = null;

  // Handle user registration
  socket.on('register', async (userId) => {
    // Step 1: Log user registration attempt
    console.log(`User ${userId} registering with socket ${socket.id}`);
    currentUserId = userId;

    // Step 2: Clean up old sockets for this user to prevent multiple connections
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

    // Step 3: Store new socket connection
    if (!activeUsers.has(userId)) {
      activeUsers.set(userId, new Set());
    }
    activeUsers.get(userId).add(socket.id);
    console.log(`Active sockets for user ${userId}:`, [...activeUsers.get(userId)]);

    // Step 4: Verify socket is still active
    if (!io.sockets.sockets.get(socket.id)) {
      console.error(`Socket ${socket.id} is not active after registration for user ${userId}`);
    }

    // Step 5: Notify other clients that this user is online
    const user = await User.findById(userId, 'username');
    const username = user ? user.username : 'Unknown';
    socket.broadcast.emit('user-online', { userId, username });
  });

  // Handle call request from a caller to a callee
  socket.on('call-request', ({ callId, calleeId, callerId, callerName }) => {
    console.log(`Call request from ${callerId} to ${calleeId} with callId ${callId}`);

    // Step 1: Validate input parameters
    if (!callId || !calleeId || !callerId) {
      console.error('Invalid call request parameters:', { callId, calleeId, callerId });
      socket.emit('call-failed', {
        reason: 'invalid-parameters',
        message: 'Invalid call parameters'
      });
      return;
    }

    // Step 2: Prevent self-calls
    if (callerId === calleeId) {
      console.log('Self-call detected');
      socket.emit('call-failed', {
        reason: 'self-call',
        message: 'You cannot call yourself'
      });
      return;
    }

    // Step 3: Check if callee is online
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

    // Step 4: Check if callee is already in a call
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

    // Step 5: Store the pending call
    activeCalls.set(callId, {
      participants: [callerId, calleeId],
      status: 'pending',
      createdAt: Date.now()
    });

    // Step 6: Notify callee of incoming call
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

    // Step 7: Notify caller that the call is ringing
    socket.emit('call-ringing', { callId });
  });

  // Handle call acceptance by the callee
  socket.on('call-accepted', ({ callId, calleeId, callerId }) => {
    console.log(`Call ${callId} accepted by ${calleeId}`);
    const call = activeCalls.get(callId);

    // Step 1: Verify call exists
    if (!call) {
      console.error(`Call ${callId} not found`);
      socket.emit('call-failed', {
        reason: 'call-not-found',
        message: 'Call does not exist'
      });
      return;
    }

    // Step 2: Verify call is in pending state
    if (call.status !== 'pending') {
      console.error(`Call ${callId} is not in pending state, current status: ${call.status}`);
      socket.emit('call-failed', {
        reason: 'invalid-state',
        message: 'Call is not pending'
      });
      return;
    }

    // Step 3: Update call status to active
    call.status = 'active';

    // Step 4: Notify caller that call was accepted
    const callerSocketIds = activeUsers.get(callerId);
    if (callerSocketIds && callerSocketIds.size > 0) {
      callerSocketIds.forEach((socketId) => {
        const callerSocket = io.sockets.sockets.get(socketId);
        if (callerSocket) {
          console.log(`Emitting call-accepted to socket ${socketId} for caller ${callerId}`);
          callerSocket.emit('call-accepted', {
            callId,
            calleeId
          });
        } else {
          console.warn(`Socket ${socketId} not found for caller ${callerId}`);
        }
      });
    } else {
      console.error(`No active sockets found for caller ${callerId}`);
      socket.emit('call-failed', {
        reason: 'caller-unavailable',
        message: 'Caller is no longer available'
      });
      activeCalls.delete(callId);
    }
  });

  // Handle call rejection by the callee
  socket.on('call-rejected', ({ callId, calleeId, callerId }) => {
    console.log(`Call ${callId} rejected by ${calleeId}`);
    const call = activeCalls.get(callId);

    // Step 1: Verify call exists
    if (!call) {
      console.error(`Call ${callId} not found`);
      return;
    }

    // Step 2: Notify caller that call was rejected
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

    // Step 3: Remove the call from active calls
    activeCalls.delete(callId);
  });

  // Handle socket disconnection
  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected`);
    if (currentUserId) {
      const userSockets = activeUsers.get(currentUserId);
      if (userSockets) {
        userSockets.delete(socket.id);
        console.log(`Removed socket ${socket.id} for user ${currentUserId}. Remaining sockets:`, [...userSockets]);

        // Step 1: Delay cleanup to allow for reconnection
        setTimeout(() => {
          const updatedUserSockets = activeUsers.get(currentUserId);
          if (!updatedUserSockets || updatedUserSockets.size === 0) {
            // Step 2: Remove user if no sockets remain
            activeUsers.delete(currentUserId);
            console.log(`User ${currentUserId} is now offline`);
            socket.broadcast.emit('user-offline', { userId: currentUserId });

            // Step 3: End any active calls involving this user
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
        }, 2000); // 2-second grace period for reconnection
      }
    }
  });
});

// Periodic cleanup of stale calls
// Removes pending calls older than 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [callId, call] of activeCalls) {
    if (call.status === 'pending' && now - call.createdAt > 30000) {
      console.log(`Cleaning up stale call ${callId}`);
      const [callerId] = call.participants;
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
}, 10000); // Run every 10 seconds

// Cookie configuration for JWT tokens
const cookieOptions = {
  httpOnly: true, // Prevent client-side JavaScript access
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // CSRF protection
  secure: process.env.NODE_ENV === 'production' ? true : false, // HTTPS only in production
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7-day expiration
};

// Utility function to extract user data from JWT token
async function getUserDataFromRequest(req) {
  return new Promise((resolve, reject) => {
    // Step 1: Extract token from cookies
    const token = req.cookies?.token;
    console.log("Token from cookie:", token);
    if (token) {
      // Step 2: Verify JWT token
      jwt.verify(token, jwtSecret, {}, (err, userData) => {
        if (err) {
          console.error("JWT verification error:", err);
          return reject("Invalid token");
        }
        // Step 3: Verify user exists in database
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

// API endpoint to generate Stream chat and video tokens
app.post('/api/token', async (req, res) => {
  try {
    // Step 1: Authenticate user
    const userData = await getUserDataFromRequest(req);
    const user = await User.findById(userData.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Step 2: Generate Stream tokens
    const chatToken = streamChatClient.createToken(user._id.toString());
    const videoToken = streamChatClient.createToken(user._id.toString());

    // Step 3: Sync user with Stream
    await streamChatClient.upsertUser({
      id: user._id.toString(),
      name: user.username,
    });

    // Step 4: Return tokens
    res.json({ chatToken, videoToken });
  } catch (err) {
    console.error("Token generation error:", err);
    res.status(401).json({ error: err.message });
  }
});

// API endpoint to get list of users for contact list
app.get('/api/people', async (req, res) => {
  try {
    // Step 1: Authenticate user
    const userData = await getUserDataFromRequest(req);
    
    // Step 2: Fetch all users except the current user
    const users = await User.find({ _id: { $ne: userData.userId } }, { '_id': 1, username: 1 });

    // Step 3: Sync users with Stream
    const streamUsers = users.map(user => ({
      id: user._id.toString(),
      name: user.username,
    }));
    await streamChatClient.upsertUsers(streamUsers);

    // Step 4: Return user list
    res.json(users);
  } catch (err) {
    console.error("People endpoint error:", err);
    res.status(401).json({ error: err.message });
  }
});

// API endpoint to get authenticated user's profile
app.get('/api/profile', async (req, res) => {
  try {
    console.log("Processing /api/profile request...");
    // Step 1: Authenticate user
    const userData = await getUserDataFromRequest(req);
    const user = await User.findById(userData.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Step 2: Return user profile data
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

// API endpoint for user login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log("Login attempt for username:", username);

  // Step 1: Validate input
  if (!username || !password) {
    console.log("Missing username or password");
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    // Step 2: Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.log("MongoDB not connected");
      throw new Error("MongoDB is not connected");
    }

    // Step 3: Find user by username
    console.log("Querying user...");
    const foundUser = await User.findOne({ username });
    if (!foundUser) {
      console.log("User not found");
      return res.status(404).json({ error: "User not found" });
    }

    // Step 4: Verify password
    console.log("Verifying password...");
    const passOK = bcrypt.compareSync(password, foundUser.password);
    if (!passOK) {
      console.log("Incorrect password");
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Step 5: Generate Stream chat token
    console.log("Generating Stream token...");
    let chatToken;
    try {
      chatToken = streamChatClient.createToken(foundUser._id.toString());
      console.log("Token generated:", { chatToken });
    } catch (err) {
      console.log("Token generation failed:", err.message);
      throw new Error(`Failed to generate Stream token: ${err.message}`);
    }

    // Step 6: Generate JWT and set cookie
    console.log("Generating JWT...");
    jwt.sign(
      { userId: foundUser._id },
      jwtSecret,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) {
          console.log("JWT generation failed:", err.message);
          throw new Error(`Failed to generate JWT: ${err.message}`);
        }
        console.log("Setting cookie with options:", cookieOptions);
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

// API endpoint for user logout
app.post('/api/logout', (req, res) => {
  // Clear authentication cookie
  console.log("Clearing cookie with options:", cookieOptions);
  res.cookie('token', '', { ...cookieOptions, maxAge: 0 }).json('ok');
});

// API endpoint for user registration
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  // Step 1: Validate input
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    // Step 2: Check for existing user
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Step 3: Hash password
    const hashedPassword = bcrypt.hashSync(password, bcryptSalt);

    // Step 4: Create new user
    const createdUser = await User.create({
      username: username,
      password: hashedPassword,
    });

    // Step 5: Sync user with Stream
    await streamChatClient.upsertUser({
      id: createdUser._id.toString(),
      name: createdUser.username,
    });

    // Step 6: Generate Stream chat token
    const chatToken = streamChatClient.createToken(createdUser._id.toString());

    // Step 7: Generate JWT and set cookie
    jwt.sign(
      { userId: createdUser._id },
      jwtSecret,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) {
          console.error("JWT signing error:", err);
          return res.status(500).json({ error: "Failed to generate token" });
        }
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

// Start the server on port 4000
server.listen(4000, () => {
  console.log(`Server running on port 4000`);
});