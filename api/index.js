const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User.js');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { StreamChat } = require('stream-chat');

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

// Initialize Stream Chat client
const streamChatClient = StreamChat.getInstance(process.env.STREAM_API_KEY, process.env.STREAM_API_SECRET);

// Custom function to generate video token
const generateVideoToken = (userId, secret) => {
    console.log("Generating video token for userId:", userId);
    const token = jwt.sign(
        { user_id: userId },
        secret,
        { expiresIn: '1h' }
    );
    console.log("Generated video token:", token);
    return token;
};

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

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({'test ok': true});
});

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

// Generate Stream tokens for Chat and Video
app.post('/api/token', async (req, res) => {
    try {
        const userData = await getUserDataFromRequest(req);
        const user = await User.findById(userData.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const chatToken = streamChatClient.createToken(user._id.toString());
        const videoToken = generateVideoToken(user._id.toString(), process.env.STREAM_API_SECRET);
        console.log("Returning tokens:", { chatToken, videoToken });
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
        const users = await User.find({}, {'_id': 1, username: 1});
        
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

// Create call endpoint for Stream Video
app.post('/api/create-call', async (req, res) => {
    try {
        const userData = await getUserDataFromRequest(req);
        const { recipientId } = req.body;
        if (!recipientId) return res.status(400).json({ error: "Recipient ID required" });

        const user = await User.findById(userData.userId);
        const recipient = await User.findById(recipientId);
        if (!user || !recipient) return res.status(404).json({ error: "User or recipient not found" });

        const callId = require('crypto').randomUUID();
        const call = streamChatClient.call('default', callId);
        await call.getOrCreate({
            ring: true,
            data: {
                members: [
                    { user_id: user._id.toString(), role: 'admin' },
                    { user_id: recipientId.toString() },
                ],
            },
        });

        res.json({ callId });
    } catch (err) {
        console.error("Create call error:", err);
        res.status(500).json({ error: err.message });
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
        // Check MongoDB connection
        if (mongoose.connection.readyState !== 1) {
            console.log("MongoDB not connected");
            throw new Error("MongoDB is not connected");
        }

        // Find user
        console.log("Querying user...");
        const foundUser = await User.findOne({ username });
        if (!foundUser) {
            console.log("User not found");
            return res.status(404).json({ error: "User not found" });
        }

        // Verify password
        console.log("Verifying password...");
        const passOK = bcrypt.compareSync(password, foundUser.password);
        if (!passOK) {
            console.log("Incorrect password");
            return res.status(401).json({ error: "Incorrect password" });
        }

        // Generate Stream tokens
        console.log("Generating Stream tokens...");
        let chatToken, videoToken;
        try {
            chatToken = streamChatClient.createToken(foundUser._id.toString());
            videoToken = generateVideoToken(foundUser._id.toString(), process.env.STREAM_API_SECRET);
            console.log("Tokens generated:", { chatToken, videoToken });
        } catch (err) {
            console.log("Token generation failed:", err.message);
            throw new Error(`Failed to generate Stream tokens: ${err.message}`);
        }

        // Generate JWT
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
                    chatToken,
                    videoToken,
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
        const videoToken = generateVideoToken(createdUser._id.toString(), process.env.STREAM_API_SECRET);

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
                    chatToken,
                    videoToken,
                });
            }
        );
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ error: "Error creating user" });
    }
});

const server = app.listen(4000);
console.log(`Listening on port ${server.address().port}`);