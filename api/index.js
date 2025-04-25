const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User.js');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const Message = require('./models/message.js');
const bycrpt = require('bcryptjs');
const ws = require('ws');

dotenv.config();
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });
const jwtSecret = process.env.JWT_SECRET;
const bycrptSalt = bycrpt.genSaltSync(10);

const app = express();
app.use(express.json());
app.use(cookieParser())
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}));

app.get('/test', (req, res) => {
    res.json({'test ok': true});
});

app.get('/profile', (req, res) => {
    const token = req.cookies?.token;
    if(token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
            if(err) {
                return res.status(401).json("Invalid token");
            }
            User.findById(userData.userId).then(user => {
                if (!user) {
                    return res.status(401).json("User not found");
                }
                res.json({
                    id: user._id,
                    username: user.username
                });
            }).catch(err => {
                res.status(500).json("Error finding user");
            });
        });
    } else {
        res.status(401).json("No token found");
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await User.findOne({ username });
  
    if (foundUser) {
      const passOK = bycrpt.compareSync(password, foundUser.password);
      
      if (passOK) {
        jwt.sign(
          { userId: foundUser._id },
          jwtSecret,
          {},
          (err, token) => {
            if (err) throw err;
            res.cookie('token', token, {
              httpOnly: true,
              sameSite: 'none',
              secure: true,
            }).status(200).json({
              id: foundUser._id,
              username: foundUser.username,
            });
          }
        );
      } else {
        res.status(401).json("Incorrect password");
      }
  
    } else {
      res.status(404).json("User not found");
    }
  });
  

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const hashedPassword = bycrpt.hashSync(password)
        const createdUser = await User.create({ 
            username: username, 
            password: hashedPassword, 
        })
        jwt.sign(
            {userId: createdUser._id}, 
            jwtSecret, 
            {}, 
            (err, token) => {
                if(err) throw err;
                res.cookie('token', token, {
                    httpOnly: true,
                    sameSite: 'none',
                    secure: true
                }).status(201).json({
                    id: createdUser._id,
                    username,
                });
            }
        );
    } catch(err) {
        console.error("Registration error:", err);
        res.status(500).json("Error creating user");
    }
});

const server = app.listen(4000);

const wss = new ws.WebSocketServer({server});

function broadcastOnlineUsers(wss) {
  [...wss.clients].forEach(client => {
    const onlinePeopleForClient = [...wss.clients]
      .filter(c => c.username && c.userId !== client.userId) 
      .map(c => ({userId: c.userId, username: c.username}));
    
    client.send(JSON.stringify({
      online: onlinePeopleForClient,
      you: client.userId
    }));
  });
}

wss.on('connection', (connection, req) => {
  const cookies = req.headers.cookie;
  if(cookies) {
    const tokenCookieString = cookies.split(';').find(str => str.startsWith('token='))
    if(tokenCookieString) {
      const token = tokenCookieString.split('=')[1];
      if(token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
          if(err) throw err;
          
          const {userId} = userData;
          connection.userId = userId;

          User.findById(userId).then(user => {
            if (user) {
              connection.username = user.username;
              broadcastOnlineUsers(wss);
            }
          });
        });
      }
    }
  }

  connection.on('message', async (message) => {
    const messageData = JSON.parse(message.toString());
    console.log(messageData);
    const {recipient, text} = messageData;
    if(recipient && text) {
      const messageDocument = await Message.create({
        sender: connection.userId,
        recipient,
        text,
      });
      [...wss.clients]
      .filter(c => c.userId === recipient)
      .forEach(c => c.send(JSON.stringify({
        text,
        sender: connection.userId,
        id: messageDocument._id,
      })))
    }
  });

  connection.send(JSON.stringify({
    online: [...wss.clients]
      .filter(c => c.username && c.userId !== connection.userId)
      .map(c => ({userId: c.userId, username: c.username})),
    you: connection.userId
  }));

  connection.on('close', () => {
    broadcastOnlineUsers(wss);
  });
});