import { useEffect, useState, useRef } from "react";
import axios from "axios";
import {
  Chat,
  Channel,
  ChannelList,
  Window,
  ChannelHeader,
  MessageList,
  MessageInput,
  Thread,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import { useNavigate } from "react-router-dom";
import Avatar from "../common/avatar";
import Logo from "../common/logo";
import Contact from "../contacts/Contact";
import { LogOut, Video } from "lucide-react";
import "stream-chat-react/dist/css/v2/index.css";
import io from "socket.io-client";

// ChatComponent: Core component for real-time messaging and video call functionality
// Overview: This component integrates Stream Chat for messaging and Socket.IO for real-time user presence and video call signaling.
// It manages user authentication, chat channels, online/offline status, and video call states, providing a seamless chat experience.
export default function ChatComponent() {
  // State variables for managing component behavior
  // Each state is critical for tracking specific aspects of the chat and call functionality
  const [chatClient, setChatClient] = useState(null); // Holds the Stream Chat client instance for messaging
  const socketRef = useRef(null); // Holds the Socket.IO client instance for real-time events
  const [myUserId, setMyUserId] = useState(null); // Stores the current user's ID from the backend
  const [username, setUsername] = useState(null); // Stores the current user's username for display
  const [loggedIn, setLoggedIn] = useState(false); // Tracks whether the user is authenticated
  const [selectedUserId, setSelectedUserId] = useState(null); // ID of the contact selected for chatting
  const [onlinePeople, setOnlinePeople] = useState({}); // Object mapping online user IDs to usernames
  const [offlinePeople, setOfflinePeople] = useState({}); // Object mapping offline user IDs to user objects
  const [error, setError] = useState(""); // Stores error messages for initialization or connection issues
  const [callStatus, setCallStatus] = useState("idle"); // Tracks video call state (idle, incoming, calling, ringing, accepted)
  const [incomingCall, setIncomingCall] = useState(null); // Stores details of an incoming call (callId, callerId, callerName, timestamp)
  const [activeChannel, setActiveChannel] = useState(null); // Holds the currently active Stream Chat channel
  const navigate = useNavigate(); // React Router hook for programmatic navigation

  // Primary initialization effect: Sets up the entire chat and video call infrastructure
  // Complexity: This effect orchestrates multiple asynchronous operations (profile fetch, token fetch, Stream Chat setup,
  // Socket.IO setup) and handles real-time event listeners. It’s critical for bootstrapping the component.
  useEffect(() => {
    let isMounted = true;

    // Async function to initialize all dependencies
    // Why: Centralizes setup logic to ensure user authentication, chat, and real-time features are ready before rendering.
    async function initialize() {
      try {
        console.log("Initializing Chat.jsx...");

        // Step 1: Fetch user profile from backend
        // Purpose: Authenticate the user and retrieve their ID and username, which are required for Stream Chat and Socket.IO.
        // Why: Ensures the user is logged in and provides essential data for personalization and channel creation.
        let profileRes;
        try {
          console.log("Fetching /api/profile...");
          profileRes = await axios.get("/api/profile", { withCredentials: true });
          console.log("Profile response:", profileRes);
        } catch (err) {
          // Detailed error handling to capture specific failure reasons
          const errorDetails = err.response
            ? `Status: ${err.response.status}, Data: ${JSON.stringify(err.response.data)}`
            : `No response: ${err.message}`;
          throw new Error(`Failed to fetch profile: ${errorDetails}`);
        }

        // Validate profile data to ensure required fields are present
        // Why: Prevents downstream errors in Stream Chat or Socket.IO if user data is incomplete.
        if (!profileRes?.data?.id || !profileRes?.data?.username) {
          throw new Error("Invalid profile data: id or username missing");
        }
        console.log("Profile data:", profileRes.data);
        if (isMounted) {
          setMyUserId(profileRes.data.id);
          setUsername(profileRes.data.username);
          setLoggedIn(true);
        }

        // Step 2: Fetch Stream Chat authentication token
        // Purpose: Obtain a token to authenticate the user with Stream Chat’s API.
        // Why: Stream Chat requires a valid token to connect a user, ensuring secure access to messaging features.
        let tokenRes;
        try {
          console.log("Fetching /api/token...");
          tokenRes = await axios.post("/api/token", {}, { withCredentials: true });
          console.log("Token response:", tokenRes);
        } catch (err) {
          const errorDetails = err.response
            ? `Status: ${err.response.status}, Data: ${JSON.stringify(err.response.data)}`
            : `No response: ${err.message}`;
          throw new Error(`Failed to fetch tokens: ${errorDetails}`);
        }

        // Validate token response
        const { chatToken } = tokenRes.data || {};
        if (!chatToken) {
          throw new Error("Invalid token data: chatToken missing");
        }
        console.log("Tokens:", { chatToken });

        // Step 3: Initialize and connect Stream Chat client
        // Purpose: Set up the Stream Chat client and connect the authenticated user for real-time messaging.
        // Why: Stream Chat handles all messaging functionality, including channels, messages, and user presence.
        let chatClient;
        try {
          // Initialize Stream Chat with API key from environment variables
          console.log("Initializing StreamChat with API key:", import.meta.env.VITE_STREAM_API_KEY);
          chatClient = StreamChat.getInstance(import.meta.env.VITE_STREAM_API_KEY);
          console.log("Connecting StreamChat user...");
          await chatClient.connectUser(
            {
              id: profileRes.data.id, // Unique user ID
              name: profileRes.data.username, // Display name for messages
            },
            chatToken // Authentication token
          );
          console.log("Stream Chat connected");
          if (isMounted) {
            setChatClient(chatClient);
          }

          // Fetch initial online users to populate the contact list
          // Why: Provides an immediate view of who is online, enhancing the user experience.
          const users = await chatClient.queryUsers(
            { id: { $ne: profileRes.data.id } }, // Exclude the current user
            { last_active: -1 } // Sort by most recently active
          );
          const initialOnlinePeople = users.users
            .filter((user) => user.online)
            .reduce((acc, user) => {
              acc[user.id] = user.name || "";
              return acc;
            }, {});
          if (isMounted) {
            setOnlinePeople(initialOnlinePeople);
          }
        } catch (err) {
          throw new Error(`Failed to initialize Stream Chat: ${err.message || JSON.stringify(err)}`);
        }

        // Step 4: Initialize Socket.IO for real-time communication
        // Purpose: Enable real-time user presence updates and video call signaling.
        // Why: Socket.IO provides low-latency communication for dynamic features like online/offline status and call notifications.
        // Complexity: Managing multiple event listeners and ensuring reliable connection/reconnection logic.
        try {
          console.log("Initializing Socket.IO...");
          const socketInstance = io(import.meta.env.VITE_SERVER_URL || "http://localhost:4000", {
            withCredentials: true, // Enable cookies for authentication
            transports: ["websocket"], // Use WebSocket for faster communication
            reconnection: true, // Automatically reconnect on failure
            reconnectionAttempts: 5, // Limit reconnection attempts
            reconnectionDelay: 1000, // Initial delay between attempts
            reconnectionDelayMax: 5000, // Maximum delay
          });
          socketRef.current = socketInstance;

          // Socket.IO event listeners
          // Each listener handles a specific real-time event, updating state or triggering UI changes
          socketInstance.on("connect", () => {
            // Register user with Socket.IO server upon connection
            console.log("Socket.IO connected, registering user:", profileRes.data.id);
            socketInstance.emit("register", profileRes.data.id);
          });

          socketInstance.on("connect_error", (err) => {
            // Handle connection failures, informing the user
            console.error("Socket.IO connection error:", err.message);
            if (isMounted) {
              setError(`Socket.IO connection failed: ${err.message}`);
            }
          });

          socketInstance.on("user-online", ({ userId, username }) => {
            // Update online status when a user connects
            console.log(`User online: ${userId} (${username})`);
            if (isMounted) {
              setOnlinePeople((prev) => ({
                ...prev,
                [userId]: username,
              }));
              setOfflinePeople((prev) => {
                const newOffline = { ...prev };
                delete newOffline[userId]; // Remove from offline list
                return newOffline;
              });
            }
          });

          socketInstance.on("user-offline", ({ userId }) => {
            // Update offline status when a user disconnects
            console.log(`User offline: ${userId}`);
            if (isMounted) {
              setOnlinePeople((prev) => {
                const newOnline = { ...prev };
                delete newOnline[userId]; // Remove from online list
                return newOnline;
              });
              setOfflinePeople((prev) => ({
                ...prev,
                [userId]: prev[userId] || { username: "Unknown" }, // Add to offline list
              }));
            }
          });

          socketInstance.on("incoming-call", ({ callId, callerId, callerName }) => {
            // Handle incoming video call notifications
            // Why: Allows the user to accept or reject a call, updating the UI with a dialog.
            console.log("Received incoming call:", { callId, callerId, callerName });
            if (!callerName) {
              console.warn("Caller name is missing, using default");
              callerName = "Unknown"; // Fallback for missing data
            }
            if (isMounted) {
              setIncomingCall({
                callId,
                callerId,
                callerName,
                timestamp: Date.now(), // Track call initiation time
              });
              setCallStatus("incoming"); // Trigger UI to show call dialog
            }
          });

          socketInstance.on("call-ringing", ({ callId }) => {
            // Indicate that the recipient’s device is ringing
            console.log(`Call ${callId} is ringing`);
            if (isMounted) {
              setCallStatus("ringing");
            }
          });

          socketInstance.on("call-accepted", ({ callId, calleeId }) => {
            // Handle call acceptance by the recipient
            // Why: Navigates the caller to the video call page with necessary state.
            console.log("Call accepted by:", calleeId, "callId:", callId);
            if (isMounted) {
              setCallStatus("accepted");
              const recipientUsername = onlinePeople[calleeId] || offlinePeople[calleeId]?.username || "Unknown";
              console.log("Navigating to call page:", `/call/${callId}`, "with state:", {
                callId,
                recipientId: calleeId,
                recipientUsername,
                initiator: true,
                userId: myUserId,
              });
              try {
                navigate(`/call/${callId}`, {
                  state: {
                    callId,
                    recipientId: calleeId,
                    recipientUsername,
                    initiator: true,
                    userId: myUserId,
                  },
                  replace: true, // Replace history to prevent back navigation issues
                });
              } catch (err) {
                console.error("Navigation error:", err);
                setCallStatus("idle");
                alert("Failed to join call: Navigation error");
              }
            }
          });

          socketInstance.on("call-rejected", ({ callId, calleeId }) => {
            // Handle call rejection by the recipient
            console.log(`Call ${callId} rejected by ${calleeId}`);
            if (isMounted) {
              setCallStatus("idle");
              alert("Call was rejected by the recipient");
            }
          });

          socketInstance.on("call-failed", ({ reason, message }) => {
            // Handle generic call failures
            console.log("Call failed:", { reason, message });
            if (isMounted) {
              setCallStatus("idle");
              alert(`Call failed: ${message}`);
            }
          });

          socketInstance.on("call-not-available", ({ userId, reason }) => {
            // Handle cases where the recipient is unavailable
            console.log(`User ${userId} not available: ${reason}`);
            if (isMounted) {
              setCallStatus("idle");
              alert(`Call failed: User is not available (${reason})`);
            }
          });

          socketInstance.on("call-ended", ({ callId, reason }) => {
            // Handle call termination
            // Why: Ensures the UI and state are reset, and the user is navigated appropriately.
            console.log(`Call ${callId} ended, reason: ${reason || "unknown"}`);
            if (isMounted) {
              setCallStatus("idle");
              const currentPath = window.location.pathname;
              if (!currentPath.startsWith(`/call/${callId}`)) {
                navigate("/chat"); // Redirect to chat if not on call page
              }
              alert(`Call ended${reason === "user-disconnected" ? ": Other user disconnected" : ""}`);
            }
          });
        } catch (err) {
          throw new Error(`Failed to initialize Socket.IO: ${err.message || JSON.stringify(err)}`);
        }

        // Step 5: Set up Stream Chat event listeners
        // Purpose: Monitor user presence changes to update online/offline status in real-time.
        // Why: Enhances user experience by showing which contacts are available for messaging or calls.
        console.log("Setting up Stream Chat event listeners...");
        chatClient.on("user.presence.changed", (event) => {
          const user = event.user;
          if (user && user.id !== myUserId) {
            // Update online/offline state based on user presence
            if (isMounted) {
              setOnlinePeople((prev) => {
                if (user.online) {
                  return { ...prev, [user.id]: user.name || "" };
                } else {
                  const newOnline = { ...prev };
                  delete newOnline[user.id];
                  return newOnline;
                }
              });
              setOfflinePeople((prev) => {
                if (!user.online) {
                  return { ...prev, [user.id]: { username: user.name || "" } };
                } else {
                  const newOffline = { ...prev };
                  delete newOffline[user.id];
                  return newOffline;
                }
              });
            }
          }
        });
      } catch (err) {
        // Centralized error handling for initialization failures
        console.error("Initialization failed:", err);
        console.error("Error details:", JSON.stringify(err, null, 2));
        if (isMounted) {
          setError(`Failed to initialize: ${err.message || "Unknown error"}`);
          setLoggedIn(false);
          setChatClient(null);
        }
      }
    }

    initialize();

    // Cleanup on component unmount
    // Why: Ensures resources are released and connections are closed to prevent memory leaks.
    return () => {
      isMounted = false;
      if (chatClient) {
        chatClient.disconnectUser();
        console.log("Stream Chat disconnected");
      }
      // Do not disconnect socket to persist across navigation
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to handle incoming call timeouts
  // Purpose: Automatically reject unanswered incoming calls after 30 seconds to prevent hanging states.
  // Why: Improves user experience by clearing stale call notifications.
  useEffect(() => {
    if (incomingCall) {
      const timeoutId = setTimeout(() => {
        if (callStatus === "incoming") {
          console.log(`Call ${incomingCall.callId} timed out without response`);
          handleRejectCall(); // Trigger rejection logic
        }
      }, 30000); // 30-second timeout

      return () => clearTimeout(timeoutId); // Cleanup timeout on effect re-run or unmount
    }
  }, [incomingCall, callStatus]); // Dependencies ensure effect runs when call state changes

  // Effect to fetch offline users
  // Purpose: Populate offlinePeople state with users not currently online.
  // Why: Ensures the contact list includes all known users, even those offline, for a complete view.
  useEffect(() => {
    if (loggedIn && myUserId) {
      axios
        .get("/api/people")
        .then((res) => {
          // Filter out current user and online users
          const offlinePeopleArray = res.data
            .filter((p) => p._id !== myUserId)
            .filter((p) => !Object.keys(onlinePeople).includes(p._id));
          const offlinePeople = offlinePeopleArray.reduce((acc, p) => {
            acc[p._id] = { username: p.username };
            return acc;
          }, {});
          setOfflinePeople(offlinePeople);
        })
        .catch((err) => {
          console.error("Failed to fetch people:", err);
        });
    }
  }, [onlinePeople, myUserId, loggedIn]); // Re-run when online users or login status changes

  // Logout function
  // Purpose: Terminate user session, disconnect services, and reset component state.
  // Why: Ensures a clean logout process, freeing resources and redirecting to the login page.
  function logout() {
    axios
      .post("/api/logout")
      .then(() => {
        if (chatClient) chatClient.disconnectUser();
        if (socketRef.current) socketRef.current.disconnect();
        // Reset all state to initial values
        setMyUserId(null);
        setUsername(null);
        setSelectedUserId(null);
        setOnlinePeople({});
        setOfflinePeople({});
        setLoggedIn(false);
        setChatClient(null);
        setCallStatus("idle");
        navigate("/"); // Redirect to home/login page
      })
      .catch((err) => {
        console.error("Logout failed:", err);
      });
  }

  // Handle accepting an incoming video call
  // Purpose: Allow the user to join a video call by emitting an acceptance event and navigating to the call page.
  // Why: Coordinates client-side call state with server-side signaling and ensures seamless navigation.
  const handleAcceptCall = () => {
    if (!incomingCall || !socketRef.current) return; // Guard against invalid state

    console.log("Call accepted by user, emitting call-accepted");
    socketRef.current.emit("call-accepted", {
      callId: incomingCall.callId,
      calleeId: myUserId,
      callerId: incomingCall.callerId,
    });

    setCallStatus("accepted");
    navigate(`/call/${incomingCall.callId}`, {
      state: {
        callId: incomingCall.callId,
        recipientId: incomingCall.callerId,
        recipientUsername: incomingCall.callerName,
        initiator: false,
        userId: myUserId,
      },
    });

    setIncomingCall(null); // Clear incoming call state
  };

  // Handle rejecting an incoming video call
  // Purpose: Decline a call by emitting a rejection event and resetting call state.
  // Why: Allows the user to dismiss unwanted calls and informs the caller via Socket.IO.
  const handleRejectCall = () => {
    if (!incomingCall || !socketRef.current) return; // Guard against invalid state

    console.log("Call rejected by user, emitting call-rejected");
    socketRef.current.emit("call-rejected", {
      callId: incomingCall.callId,
      calleeId: myUserId,
      callerId: incomingCall.callerId,
    });

    setCallStatus("idle");
    setIncomingCall(null); // Clear incoming call state
  };

  // Handle contact selection for chatting
  // Purpose: Load an existing chat channel or create a new one for the selected user.
  // Why: Enables one-on-one messaging by managing Stream Chat channels dynamically.
  const handleContactClick = (userId) => {
    setSelectedUserId(userId);
    if (chatClient) {
      // Query for existing channels with the selected user
      chatClient
        .queryChannels({
          type: "messaging",
          members: { $eq: [myUserId.toString(), userId] },
        })
        .then((channels) => {
          if (channels.length > 0) {
            setActiveChannel(channels[0]); // Use the first matching channel
          } else {
            // Create a new channel if none exists
            chatClient
              .channel("messaging", {
                members: [myUserId.toString(), userId],
              })
              .create()
              .then((channel) => {
                setActiveChannel(channel);
              })
              .catch((err) => console.error("Failed to create channel:", err));
          }
        })
        .catch((err) => console.error("Failed to query channels:", err));
    }
  };

  // CustomChannelHeader: Renders the chat channel header with a video call button
  // Purpose: Extends the default Stream Chat header to include video call initiation.
  // Why: Provides a convenient way to start calls directly from the chat interface.
  const CustomChannelHeader = () => {
    // Initiate a video call with the selected user
    // Complexity: Involves multiple validation checks, Socket.IO communication, and timeout handling.
    const handleVideoCall = async () => {
      // Validation checks to ensure call can proceed
      if (!selectedUserId || !socketRef.current || !chatClient) {
        alert("Please select a contact and ensure clients are initialized.");
        return;
      }
      if (selectedUserId === myUserId) {
        alert("You cannot call yourself.");
        return;
      }
      if (!onlinePeople[selectedUserId]) {
        alert("Cannot initiate call: Selected user is offline.");
        return;
      }
      if (callStatus !== "idle") {
        alert("Another call is in progress or waiting for response.");
        return;
      }

      try {
        console.log("Initiating call to:", selectedUserId);

        // Generate a unique call ID
        const callId = `call_${Date.now()}_${myUserId}_${selectedUserId}`;
        setCallStatus("calling");

        // Verify Socket.IO connection
        if (!socketRef.current.connected) {
          console.error("Socket is not connected");
          setCallStatus("idle");
          alert("Connection lost. Please try again.");
          return;
        }

        // Emit call request to server
        socketRef.current.emit("call-request", {
          callId,
          calleeId: selectedUserId,
          callerId: myUserId,
          callerName: username,
        });

        // Set a timeout for unanswered calls
        // Why: Prevents the caller from waiting indefinitely if the recipient doesn’t respond.
        const callTimeout = setTimeout(() => {
          if (callStatus === "calling" || callStatus === "ringing") {
            socketRef.current.emit("call-rejected", {
              callId,
              calleeId: selectedUserId,
              callerId: myUserId,
            });
            setCallStatus("idle");
            alert("Call timed out: No response from recipient.");
          }
        }, 30000);

        return () => clearTimeout(callTimeout); // Cleanup timeout
      } catch (error) {
        console.error("Failed to initiate video call:", error);
        setCallStatus("idle");
        alert(`Failed to start video call: ${error.message}. Please try again.`);
      }
    };

    return (
      <div className="flex items-center justify-between p-4 border-b border-gray-300 bg-white">
        <ChannelHeader /> {/* Default Stream Chat header */}
        {selectedUserId && (
          <button
            onClick={handleVideoCall}
            disabled={callStatus !== "idle"}
            className={`p-2 rounded-lg transition-colors ${
              callStatus !== "idle"
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-300 hover:text-black"
            }`}
            title={callStatus === "idle" ? "Start Video Call" : "Call in progress"}
          >
            <Video className="w-5 h-5" />
            {callStatus !== "idle" && (
              <span className="ml-2 text-xs">{callStatus === "calling" ? "Calling..." : callStatus}</span>
            )}
          </button>
        )}
      </div>
    );
  };

  // IncomingCallDialog: Displays a modal for incoming video calls
  // Purpose: Allows the user to accept or reject an incoming call with a clear UI.
  // Why: Provides an intuitive interface for handling call notifications.
  const IncomingCallDialog = () => {
    if (!incomingCall || callStatus !== "incoming") return null; // Only render when a call is incoming

    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full border border-gray-300">
          <h3 className="text-xl font-medium text-black mb-4">Incoming Call</h3>
          <p className="text-gray-700 mb-6">{incomingCall.callerName} is calling you</p>
          <div className="flex justify-between">
            <button
              onClick={handleRejectCall}
              className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg"
            >
              Decline
            </button>
            <button
              onClick={handleAcceptCall}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render login prompt if user is not authenticated or chat client is not initialized
  // Why: Ensures unauthorized users are redirected to the login page and provides feedback on errors.
  if (!loggedIn || !chatClient) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-xl text-black mb-4 mt-8">You are logged out</h1>
          {error && <p className="text-red-600 mb-4">{error}</p>}
          <p className="text-gray-700 mb-6">Please login to continue chatting</p>
          <a
            href="/login"
            className="bg-blue-500 text-white py-3 px-6 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // Main chat interface
  // Structure: A sidebar with contacts and a main chat window with messaging and call controls.
  return (
    <>
      <Chat client={chatClient} theme="messaging light">
        <div className="flex h-screen w-full overflow-x-hidden bg-white">
          {/* Sidebar: Displays logo, contacts, and user profile */}
          <div className="bg-white border-r border-gray-300 w-80 flex flex-col fixed top-0 left-0 h-full">
            <div className="flex-grow overflow-y-auto scrollbar-hidden">
              <Logo /> {/* App logo */}
              <div className="border-b mx-3 border-gray-300" /> {/* Separator */}
              {/* List online contacts */}
              {Object.keys(onlinePeople).map((userId) => (
                <Contact
                  key={userId}
                  id={userId}
                  username={onlinePeople[userId]}
                  online={true}
                  onClick={() => handleContactClick(userId)}
                  selected={userId === selectedUserId}
                />
              ))}
              {/* List offline contacts */}
              {Object.keys(offlinePeople).map((userId) => (
                <Contact
                  key={userId}
                  id={userId}
                  username={offlinePeople[userId].username}
                  online={false}
                  onClick={() => handleContactClick(userId)}
                  selected={userId === selectedUserId}
                />
              ))}
            </div>
            {/* User profile and logout button */}
            <div className="flex items-center justify-between bg-gray-100 rounded-lg m-4 p-4 border border-gray-300">
              <span className="flex items-center text-sm text-gray-700">
                <Avatar userId={myUserId} username={username} className="flex-shrink-0 w-8 h-8 mr-2" />
                <div className="mr-4"></div>
                {username}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={logout}
                  className="text-gray-700 p-2 rounded-lg hover:bg-gray-300 hover:text-black transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          {/* Main chat window */}
          <div className="flex flex-col bg-white flex-1 ml-80 p-6 overflow-x-hidden">
            <Channel channel={activeChannel}>
              <Window>
                <CustomChannelHeader /> {/* Custom header with video call button */}
                <MessageList /> {/* Displays chat messages */}
                <MessageInput /> {/* Input for sending messages */}
              </Window>
              <Thread /> {/* Displays message threads */}
            </Channel>
          </div>
        </div>
      </Chat>
      <IncomingCallDialog /> {/* Modal for incoming calls */}
    </>
  );
}