### **1. Project Overview**

Our project is a **MERN-based Chat Application** designed to provide users with a seamless, real-time communication experience. Built using the **MERN stack (MongoDB, Express, React, Node.js)**, the application leverages modern web technologies to deliver a fast, responsive, and user-friendly chat platform.

### **Purpose:**

The primary goal of this chat application is to enable users to **connect and communicate** effortlessly, whether through **text messages** or **video calls**. It aims to provide a platform for **real-time communication**, fostering both casual and professional interactions. By implementing **robust user authentication** and **status tracking**, the application ensures secure and reliable connectivity.

---

### **Main Features:**

1. **User Authentication:**
    - Secure user registration and login using **JWT (JSON Web Token)**.
    - Passwords are stored securely using **hashing**.
    - Authenticated users can seamlessly access chat functionalities.
2. **Real-Time Messaging:**
    - Instant text-based communication between users.
    - Messages are stored in a **MongoDB database**, ensuring persistence.
    - Users can see new messages in real-time without refreshing the page.
3. **User Presence Management:**
    - View **online and offline** status of contacts.
    - Automatically updates the status when users join or disconnect.
4. **Video Call Capability:**
    - Real-time **video calling** using WebRTC.
    - Direct peer-to-peer connection for minimal latency.
    - Integrated video chat within the application interface.
5. **Enhanced User Experience:**
    - User-friendly interface with intuitive navigation.
    - Dynamic updates of online contacts and chat messages.
    - Notifications for incoming messages and video calls.

## **2. Main Project Dependencies**

This contains dependencies for a full-stack application with React, Express, MongoDB, and real-time communication features.

### **Unique Dependencies:**

- **Core Libraries**:
    - **`@stream-io/node-sdk`**: Stream's Node.js SDK for building chat applications
    - **`@stream-io/video-react-sdk`**: Stream's React SDK for video calling features
    - **`stream-chat`**: Stream Chat JavaScript client
    - **`stream-chat-react`**: React components for Stream Chat
- **Backend**:
    - **`express`**: Web framework for Node.js
    - **`mongoose`**: MongoDB object modeling
    - **`jsonwebtoken`**: JSON Web Token implementation
    - **`bcryptjs`**: Password hashing
    - **`cookie-parser`**: Cookie handling middleware
    - **`cors`**: Cross-Origin Resource Sharing middleware
    - **`dotenv`**: Environment variable loader
    - **`nodemon`**: Development server utility
- **Frontend**:
    - **`react`**: React library (v18.3.1)
    - **`react-dom`**: React DOM renderer
    - **`react-router-dom`**: Routing for React
    - **`lucide-react`**: Icon library
    - **`tailwind-scrollbar-hide`**: Tailwind plugin
- **Real-time Communication**:
    - **`socket.io`**: Real-time bidirectional event-based communication
    - **`socket.io-client`**: Client-side Socket.IO
- **Utilities**:
    - **`axios`**: HTTP client
    - **`lodash`**: Utility library
- **Dev Dependencies**:
    - **`typescript`**: TypeScript compiler
    - **`vite`**: Frontend build tool

## **2. Client-Side Application**

This contains dedicated React client application with modern tooling.

### **Unique Dependencies:**

- **Core Libraries**:
    - **`react`**: React library (v19.0.0)
    - **`react-dom`**: React DOM renderer (v19.0.0)
    - **`react-cookie`**: React hooks for cookies
- **Utilities**:
    - **`axios`**: HTTP client
    - **`jwt-decode`**: JWT decoding utility
    - **`lodash`**: Utility library
- **Dev Dependencies**:
    - **`@eslint/js`**: ESLint JavaScript configuration
    - **`@types/react`**: TypeScript definitions for React
    - **`@types/react-dom`**: TypeScript definitions for React DOM
    - **`@vitejs/plugin-react`**: Vite plugin for React
    - **`autoprefixer`**: CSS autoprefixer
    - **`eslint`**: JavaScript linter
    - **`eslint-plugin-react-hooks`**: ESLint rules for React hooks
    - **`eslint-plugin-react-refresh`**: ESLint plugin for React Refresh
    - **`globals`**: Global variables for ESLint
    - **`postcss`**: CSS processor
    - **`tailwindcss`**: Utility-first CSS framework
    - **`vite`**: Frontend build tool

## **3. Server-Side Components**

This contains for a dedicated backend service, for an API server.

### **Unique Dependencies:**

- **Core Libraries**:
    - **`express`**: Web framework for Node.js
    - **`ws`**: WebSocket implementation
- **Database**:
    - **`mongoose`**: MongoDB object modeling
- **Authentication**:
    - **`jsonwebtoken`**: JSON Web Token implementation
    - **`bcryptjs`**: Password hashing
- **Middleware**:
    - **`cookie-parser`**: Cookie handling middleware
    - **`cors`**: Cross-Origin Resource Sharing middleware
    - **`dotenv`**: Environment variable loader
- **Development**:
    - **`nodemon`**: Development server utility

## **Summary of Technology Stack**

- **Frontend**: React (v18 and v19), Vite, Tailwind CSS, Socket.IO client
- **Backend**: Express.js, MongoDB (Mongoose), Socket.IO server
- **Real-time Features**: Stream Chat/Video, Socket.IO, WebSockets
- **Authentication**: JWT, cookie-based sessions
- **Build Tools**: Vite, ESLint, TypeScript
- **Styling**: Tailwind CSS with plugins

### **3. Setup Instructions**

Follow these steps to set up the **MERN Chat App** locally on your machine.

---

### **Step 1: Clone the Repository**

1. Open your terminal or command prompt.
2. Run the following command to clone the project from the **main branch** of GitHub:
    
    ```bash
    git clone https://github.com/Pkv562/ChatApp.git
    ```
    
3. Once the cloning process is complete, navigate to the project folder:
    
    ```bash
    cd ChatApp
    ```
    

---

### 💻 **Step 2: Install Yarn (if not already installed)**

Yarn is required to run the client side of the project. You can install Yarn globally using npm:

```bash
npm install -g yarn
```

---

### **Step 3: Install Dependencies**

**Backend (API) Setup:**

1. Navigate to the **api** folder:
    
    ```bash
    cd api
    ```
    
2. Install the necessary packages:
    
    ```bash
    npm install
    ```
    

---

**Frontend (Client) Setup:**

1. Navigate to the **client** folder:
    
    ```bash
    cd ../client
    ```
    
2. Install the client dependencies using Yarn:
    
    ```bash
    yarn install
    ```
    

---

### 🔧 **Step 4: Set Up Environment Variables**

1. Create a `.env` file in the **api** folder with the following variables:
    
    ```
    MONGO_URL=<Your MongoDB Connection String>
    JWT_SECRET=<Your JWT Secret Key>
    CLIENT_URL=http://localhost:3000
    ```
    
2. Replace `<Your MongoDB Connection String>` and `<Your JWT Secret Key>` with your actual credentials.

---

### **Step 5: Run the Application**

### **Start the Backend Server:**

1. Open a new terminal window.
2. Go to the **api** folder:
    
    ```bash
    cd ChatApp/api
    ```
    
3. Run the server using Node:
    
    ```bash
    node index.js
    ```
    
4. Or, use Nodemon for auto-reloading:
    
    ```bash
    nodemon index.js
    ```
    
5. You should see the following message:
    
    ```
    Server is running on port 4000
    Connected to MongoDB
    ```
    

---

### **Start the Frontend Client:**

1. Open another terminal window.
2. Go to the **client** folder:
    
    ```bash
    cd ChatApp/client
    ```
    
3. Start the client using Yarn:
    
    ```bash
    yarn dev
    ```
    
4. You should see the message indicating that the client is running:
    
    ```
    VITE dev server running at:
    > Local: http://localhost:3000/
    ```
    

---

### **Step 6: Access the Application**

1. Open your browser and visit:
    
    ```
    http://localhost:3000
    ```
    
2. You can now **register, log in, and start chatting** using the application.

---

### **Step 7: Troubleshooting**

If you encounter errors, make sure:

- The **MongoDB connection string** in your `.env` file is correct.
- The required packages are installed in both the **api** and **client** folders.
- Both the **backend** and **frontend** servers are running concurrently.
- If ports conflict, check if other applications are using **port 3000 or 4000**.

# 4. Folder Structure

## Project Organization Overview

The project follows a modern full-stack architecture with two main folders:

1. **api**: Contains the backend code
    - **index.js**: Entry point that connects the application to MongoDB
2. **client**: Contains the frontend React application

## Client Folder Structure

```

client/
├── node_modules/         # Dependencies installed via npm/yarn
├── public/               # Static assets served directly
├── src/                  # Source code for the React application
│   ├── assets/           # Static resources used in the application
│   │   └── styles/       # CSS styling files
│   │       └── index.css # Main stylesheet
│   │   └── react.svg     # SVG assets for React components
│   ├── components/       # Reusable React components
│   │   ├── auth/         # Authentication related components
│   │   │   ├── RegisterandLoginForm.jsx  # User registration and login form
│   │   │   └── userContext.jsx           # Context for user authentication state
│   │   ├── chat/         # Chat functionality components
│   │   │   ├── Call.jsx              # Video/audio call component
│   │   │   ├── CallButton.jsx        # Button to initiate calls
│   │   │   ├── CallPage.jsx          # Full page for call interface
│   │   │   └── Chat.jsx              # Main chat interface component
│   │   ├── common/       # Shared UI components
│   │   │   ├── avatar.jsx            # User avatar component
│   │   │   └── logo.jsx              # Application logo component
│   │   └── contacts/     # Contact management components
│   │       └── Contact.jsx           # Individual contact display component
│   ├── routes/           # Application routing
│   ├── App.jsx           # Main application component
│   └── main.jsx          # Entry point for React application

```

## Key Components

### Authentication

- **RegisterandLoginForm.jsx**: Handles user registration and login functionality
- **userContext.jsx**: Provides authentication state throughout the application

### Chat Functionality

- **Chat.jsx**: Main chat interface where users can send and receive messages
- **Call.jsx/CallPage.jsx**: Components for video/audio calling functionality
- **CallButton.jsx**: UI element to initiate calls

### Common Components

- **avatar.jsx**: Displays user avatars consistently throughout the app
- **logo.jsx**: Renders the application logo
- **Contact.jsx**: Displays contact information in a standardized format

### Application Structure

- **App.jsx**: Sets up routes and global application state
- **main.jsx**: Renders the React application to the DOM

This modular organization separates concerns, making the codebase more maintainable and easier to navigate. Components are grouped by functionality rather than type, which helps with feature development and maintenance.

# 5. Code Explenation

See other pages for the complete code explenation 

### Code Summary

The frontend is a dynamic React application built with Stream Chat and Socket.IO, providing a real-time chat and video call interface. It handles:

- **User Interface**: A responsive chat interface with a sidebar for contacts, a message list, and a video call button, styled with a dark theme.
- **Real-Time Communication**: Socket.IO manages user online/offline status, incoming/outgoing video calls, and call state transitions (e.g., ringing, accepted, rejected).
- **Messaging**: Stream Chat powers text messaging with channel creation, message input, and threaded conversations.
- **State Management**: React hooks (useState, useEffect, useRef) manage chat client, socket instance, user data, call status, and contact selection.
- **API Integration**: Axios handles API calls for fetching user profiles, chat tokens, contact lists, and logout functionality.
- **Navigation**: React Router enables seamless transitions between chat, call, and login pages.

This setup delivers a user-friendly, real-time communication platform with robust chat and video call features.

# 6. Challenges Faced

During the development of the MERN Chat App, we encountered several challenges related to real-time communication, video calling, and managing online/offline statuses. Below are the main issues we faced and how we resolved them.

---

### **1. Managing Online and Offline Status**

**Problem:**

It was challenging to keep users accurately informed about who was currently online and who had gone offline. Due to the asynchronous nature of connections, tracking real-time user status without causing conflicts was problematic.

**Solution:**

We implemented **WebSockets** using **Socket.IO** to handle user presence. When a user connects, their status is updated and broadcast to other users. Similarly, when they disconnect, their status is automatically updated. This approach ensures that the user list accurately reflects the current online and offline states.

---

### **2. Real-Time Message Updates**

**Problem:**

Messages were not appearing immediately for all participants in the chat. This caused confusion and disrupted the user experience, especially during rapid conversations.

**Solution:**

We leveraged **Socket.IO** to send messages instantly to connected users. Whenever a message is sent, the server broadcasts it to all connected clients in the relevant chat room. This implementation ensures that every message appears in real time for all active participants.

---

### **3. Video Call Integration**

**Problem:**

Initially, we attempted to implement video calling using basic WebRTC, but handling peer-to-peer connections and signaling became increasingly complex, especially for establishing reliable connections.

**Solution:**

To overcome this, we decided to integrate **Socket.IO** for handling the signaling process of WebRTC. By using **Socket.IO** for video call signaling, we streamlined the process of exchanging session descriptions and ICE candidates between users. This significantly reduced connection errors and improved the reliability of video calls.

---

# 7. Future Improvements

While the current version of the chat app is functional, there are several areas where the application could be further enhanced. Below are some potential improvements and additional features to consider.

---

### 👫 **1. Adding Friends**

Currently, users can chat with anyone who is online, but there is no **"friends list"** feature. Adding a **friend system** would allow users to maintain a list of favorite contacts and easily start private conversations. This could also be integrated with a **friend request** and **approval mechanism**.

---

### 👥 **2. Group Chats**

Currently, the app supports one-on-one conversations. To make the platform more social and collaborative, implementing **group chat functionality** would allow users to communicate within a group setting. This would include **group creation, inviting members, and group-specific settings**.

---

### 🎥 **3. Hosting Multiple Video Calls**

While video calling works for one-on-one interactions, the current setup does not support **group video calls**. Implementing **multi-user video conferencing** would allow multiple users to join a video chat simultaneously, which is useful for team meetings or social gatherings.

---

### 🛠️ **4. Message Search and Archiving**

Adding a **search bar** to find specific messages within a chat history would enhance usability. Additionally, implementing a **message archiving feature** would allow users to store older conversations without cluttering the main chat window.

---

### 🌐 **5. Multi-Device Support**

Currently, a user can only stay logged in on one device at a time. Improving the app to support **multi-device sessions** would allow users to seamlessly switch between devices while keeping their chat data synchronized.

# 7. App Screenshots

**Log-In / Register page**

![image.png](attachment:cdd3970d-a276-4544-8a65-3e1062f4e521:image.png)

**Chat-Page**

![image.png](attachment:44b0b11f-6d9c-4b56-ba14-425b20eae7b6:image.png)

**Chat message options**

![image.png](attachment:a4eccd77-5dc9-4c8c-bfc3-e13da253d618:image.png)

**Reply to message**

![image.png](attachment:c2fcd485-4bd7-4fe0-934d-697808451d38:image.png)

**Unread / delete message**

![image.png](attachment:2f0d549f-2971-4be7-8f6d-21b864f77112:image.png)

**Upload file** 

![image.png](attachment:28f7c862-aa31-4983-82ae-ae07d7a91ce9:image.png)

**In-App Picture/File display**

![image.png](attachment:8bf76656-7ca1-42e7-9997-6b7b3bac950b:image.png)

**Videocall Notification**

![image.png](attachment:42b1dffd-201f-4342-974a-8500065a3125:image.png)

**Video Call Page (off-cam)**

![image.png](attachment:ccc6acf0-9bd7-4ac5-b25e-29ac98276934:image.png)

**Video Call**

![image.png](attachment:08f252ed-3c54-4e56-b7bc-c9f665d171c0:image.png)

[5.1 Chat Application](https://www.notion.so/5-1-Chat-Application-1f56c7c937d280f4afb1ef7649463fa3?pvs=21)

[5.2 Index.js](https://www.notion.so/5-2-Index-js-1f56c7c937d2802ca182cff42f3cc797?pvs=21)

[5.3 Chat.jsx](https://www.notion.so/5-3-Chat-jsx-1f56c7c937d280388c76edf9dc6e234d?pvs=21)

[5.4 Video Call (Call.jsx & CallPage.jsx)](https://www.notion.so/5-4-Video-Call-Call-jsx-CallPage-jsx-1f56c7c937d280a7a41eeb59924702a4?pvs=21)
