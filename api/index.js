// Importing all the necessary packages
const express = require('express');         // For creating the server
const mongoose = require('mongoose');       // For MongoDB interactions
const dotenv = require('dotenv');           // For environment variables
const User = require('./models/User.js');   // User model/schema
const jwt = require('jsonwebtoken');        // For authentication tokens
const cors = require('cors');               // For cross-origin requests
const cookieParser = require('cookie-parser'); // For handling cookies
const Message = require('./models/message.js'); // Message model/schema
const bycrpt = require('bcryptjs');         // For password hashing
const ws = require('ws');                   // WebSocket for real-time features
const fs = require('fs');                   // File system for handling uploads
const path = require('path');               // For handling file paths
const buffer = require('buffer').Buffer;    // For handling binary data

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB database
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });

// Get JWT secret and create salt for password hashing
const jwtSecret = process.env.JWT_SECRET;
const bycrptSalt = bycrpt.genSaltSync(10);

// Create Express app
const app = express();

// Middleware setup
app.use('/uploads', express.static(__dirname + '/uploads')) // Serve uploaded files
app.use(express.json()); // Parse JSON bodies
app.use(cookieParser())  // Parse cookies
app.use(cors({           // Configure CORS
    origin: process.env.CLIENT_URL,
    credentials: true,
}));

// Simple test endpoint to check if server is running
app.get('/test', (req, res) => {
    res.json({'test ok': true});
});


// Function: getUserDataFromRequest
// Description: Retrieves user data from the request by verifying the JWT token in cookies.
// Returns: a Promise that resolves with userData if token and user are valid.
async function getUserDataFromRequest(req) {
  return new Promise((resolve, reject) => {
    // 1. Try to extract the JWT token from cookies (if available)
    const token = req.cookies?.token;

    // 2. If token is found, attempt to verify it
    if (token) {
      jwt.verify(token, jwtSecret, {}, (err, userData) => {
        // 3. If token is invalid or expired, reject with an error message
        if (err) {
          reject("Invalid token");
          return;
        }

        // 4. If token is valid, look up the user in the database using the ID from the token
        User.findById(userData.userId)
          .then(user => {
            // 5. If user does not exist in the database, reject with error
            if (!user) {
              reject("User not found");
              return;
            }

            // 6. If user exists and token is valid, resolve with the decoded userData
            resolve(userData);
          })
          .catch(err => {
            // 7. If a DB error occurs during lookup, reject with error
            reject("Error finding user");
          });
      });
    } else {
      // 8. If no token is found in cookies, reject with error
      reject("No token found");
    }
  });
}

// Get messages between current user and another user
app.get('/messages/:userId', async (req, res) => {
  const {userId} = req.params;
  
  try {
    const userData = await getUserDataFromRequest(req);
    const ourUserId = userData.userId;
    
    // Find messages where either sender or recipient is either user
    const messages = await Message.find({
      sender: {$in:[userId, ourUserId]},
      recipient: {$in:[userId, ourUserId]},
    }).sort({createdAt: 1});

    res.json(messages);
  } catch (err) {
    res.status(401).json({error: err});
  }
});

// Get list of all users (just IDs and usernames)
app.get('/people', async (req, res) => {
  const users = await User.find({}, {'_id':1, username:1});
  res.json(users);
})

// Route: GET /profile
// Description: Returns the user's profile data (id and username) if a valid JWT token is present in cookies.
app.get('/profile', (req, res) => {
  // 1. Extract the token from cookies (optional chaining avoids errors if cookies are undefined)
  const token = req.cookies?.token;

  // 2. Check if token exists
  if (token) {
      // 3. Verify token using JWT secret
      jwt.verify(token, jwtSecret, {}, (err, userData) => {
          // 4. If verification fails, return unauthorized
          if (err) {
              return res.status(401).json("Invalid token");
          }

          // 5. If token is valid, look up the user in the database using the ID from the token
          User.findById(userData.userId)
              .then(user => {
                  // 6. If no user is found, return unauthorized
                  if (!user) {
                      return res.status(401).json("User not found");
                  }

                  // 7. If user exists, return basic profile info
                  res.json({
                      id: user._id,
                      username: user.username
                  });
              })
              .catch(err => {
                  // 8. If database error occurs, return server error
                  res.status(500).json("Error finding user");
              });
      });
  } else {
      // 9. If no token in cookies, return unauthorized
      res.status(401).json("No token found");
  }
});


// Route: POST /login
// Description: Authenticates a user and issues a JWT token via cookie if credentials are valid.
app.post('/login', async (req, res) => {
  // 1. Extract username and password from request body
  const { username, password } = req.body;

  // 2. Search for the user in the database by username
  const foundUser = await User.findOne({ username });

  // 3. If the user exists, proceed to password verification
  if (foundUser) {
    // 4. Compare the entered password with the hashed password stored in the database
    const passOK = bycrpt.compareSync(password, foundUser.password);

    // 5. If the password matches, create a JWT token
    if (passOK) {
      jwt.sign(
        { userId: foundUser._id }, // payload 
        jwtSecret,                 // secret key
        {},                        // options 
        (err, token) => {
          // 6. If token creation fails, throw error
          if (err) throw err;

          // 7. If successful, send the token as a secure HTTP-only cookie and return user data
          res.cookie('token', token, {
            httpOnly: true,     // prevents JS access on the client side
            sameSite: 'none',   // required for cross-site cookie usage 
            secure: true,       // ensures cookie is only sent over HTTPS
          }).status(200).json({
            id: foundUser._id,
            username: foundUser.username,
          });
        }
      );
    } else {
      // 8. If password does not match, return unauthorized
      res.status(401).json("Incorrect password");
    }

  } else {
    // 9. If no user is found with the given username, return not found
    res.status(404).json("User not found");
  }
});


// Logout endpoint - clears the token cookie
app.post('/logout', (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
  }).json('ok');
})

// Route: POST /register
// Description: Handles user registration by saving a new user to the database with a hashed password.
// Returns: After successful creation, it issues a JWT token and sets it as an HTTP-only cookie.

app.post('/register', async (req, res) => {
  // 1. Extract username and password from the request body
  const { username, password } = req.body;

  try {
    // 2. Hash the password before saving it to the database
    const hashedPassword = bycrpt.hashSync(password);

    // 3. Create a new user record with the provided username and hashed password
    const createdUser = await User.create({
      username: username,
      password: hashedPassword,
    });

    // 4. Generate a JWT token for the newly created user
    jwt.sign(
      { userId: createdUser._id },  // Payload
      jwtSecret,                    // Secret key for signing
      {},                           // Additional options (none provided here)
      (err, token) => {
        // 5. Handle any error during token creation
        if (err) throw err;

        // 6. If token is successfully created, store it as an HTTP-only secure cookie
        res.cookie('token', token, {
          httpOnly: true,  // Prevents client-side JS access 
          sameSite: 'none', // Allows cross-origin requests
          secure: true,    // Ensures cookie is only sent over HTTPS
        })
        .status(201)       // HTTP status 201: Created
        .json({
          id: createdUser._id,
          username,
        });
      }
    );
  } catch (err) {
    // 7. Catch any server/database error and return error response
    console.error("Registration error:", err);
    res.status(500).json("Error creating user");
  }
});

// Start the HTTP server on port 4000
const server = app.listen(4000);

// Create WebSocket server on top of HTTP server
const wss = new ws.WebSocketServer({server});

// Function: notifyUserConnection
// Description: Notifies all connected clients when a user connects or disconnects.
function notifyUserConnection(userId, isOnline) {
  // 1. Loop through all WebSocket clients
  [...wss.clients].forEach(client => {
    // 2. Send an online status update to each client
    client.send(JSON.stringify({
      online_status_change: {
        userId: userId,
        online: isOnline
      }
    }));
  });
}


// Function: broadcastOnlineUsers
// Description: Sends an updated list of online users to every connected client (excluding themselves).
function broadcastOnlineUsers(wss) {
  // 1. Loop through each client
  [...wss.clients].forEach(client => {
    // 2. Create a list of other online users (excluding the client)
    const onlinePeopleForClient = [...wss.clients]
      .filter(c => c.username && c.userId !== client.userId)
      .map(c => ({ userId: c.userId, username: c.username }));

    // 3. Send the online list and the client's own ID
    client.send(JSON.stringify({
      online: onlinePeopleForClient,
      you: client.userId
    }));
  });
}

// Event: wss.on('connection')
// Description: Handles a new WebSocket connection, including authentication, file handling, messaging, and disconnection.
wss.on('connection', (connection, req) => {
  // 1. Extract token from cookies in the WebSocket request header
  const cookies = req.headers.cookie;
  if (cookies) {
    const tokenCookieString = cookies.split(';').find(str => str.startsWith('token='));
    if (tokenCookieString) {
      const token = tokenCookieString.split('=')[1];

      if (token) {
        // 2. Verify the token and extract user data
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
          if (err) throw err;

          // 3. Store user ID on connection object
          const { userId } = userData;
          connection.userId = userId;

          // 4. Fetch user's username and notify others
          User.findById(userId).then(user => {
            if (user) {
              connection.username = user.username;

              // 5. Inform all users that someone has come online
              broadcastOnlineUsers(wss);
              notifyUserConnection(userId, true);
            }
          });
        });
      }
    }
  }

  // 6. Create uploads directory if it doesn't exist
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

   // 7. Listen for messages from client
   connection.on('message', async (message) => {
    const messageData = JSON.parse(message.toString());
    const { recipient, text, file } = messageData;

    let filename = null;

  // 8. Process and save uploaded file, if present
  // Purpose: Handles file uploads by extracting the file extension, generating a unique filename,
  // converting base64 data to a buffer, and saving it to the uploads directory
  if (file) {
    try {
      // Split filename to extract extension
      const parts = file.name.split('.');
      const ext = parts[parts.length - 1];
      
      // Generate unique filename using timestamp and original extension
      filename = Date.now() + '.' + ext;
      
      // Define file path in uploads directory
      const path = __dirname + '/uploads/' + filename;

      // Convert base64 data to buffer, removing data URI prefix
      const bufferData = Buffer.from(file.data.split(',')[1], 'base64');
      
      // Write file to disk asynchronously
      fs.writeFile(path, bufferData, (err) => {
        if (err) {
          // Log error if file saving fails
          console.error('Error saving file:', err);
        } else {
          // Log success message with file path
          console.log('File saved:', path);
        }
      });
    } catch (err) {
      // Log any errors during file processing
      console.error('File processing error:', err);
    }
  }

    // 9. Save the message to MongoDB if there's content
    if (recipient && (text || filename)) {
      const messageDocument = await Message.create({
        sender: connection.userId,
        recipient,
        text: text || '',
        file: filename ? filename : null,
      });

      // 10. Send the message to the recipient if they are online
      [...wss.clients]
        .filter(c => c.userId === recipient)
        .forEach(c => c.send(JSON.stringify({
          text,
          sender: connection.userId,
          recipient: recipient,
          _id: messageDocument._id,
          file: filename ? filename : null,
        })));
    }
  });

  // Send initial online users list to newly connected client
  connection.send(JSON.stringify({
    online: [...wss.clients]
      .filter(c => c.username && c.userId !== connection.userId)
      .map(c => ({userId: c.userId, username: c.username})),
    you: connection.userId
  }));

  // Handle client disconnection
  connection.on('close', () => {
    if (connection.userId) {
      notifyUserConnection(connection.userId, false);
    }
    broadcastOnlineUsers(wss);
  });
});