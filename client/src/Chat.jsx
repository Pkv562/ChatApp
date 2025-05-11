import { useEffect, useState, useRef } from "react";
import axios from "axios";
import {
    Chat,
    Channel,
    Window,
    ChannelHeader,
    MessageList,
    MessageInput,
    Thread,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import { useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import Logo from "./logo";
import Contact from "./Contact";
import { LogOut, Video } from "lucide-react";
import "stream-chat-react/dist/css/v2/index.css";
import io from "socket.io-client";

export default function ChatComponent() {
    const [chatClient, setChatClient] = useState(null);
    const [socket, setSocket] = useState(null);
    const [myUserId, setMyUserId] = useState(null);
    const [username, setUsername] = useState(null);
    const [loggedIn, setLoggedIn] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({});
    const [error, setError] = useState("");
    const [callStatus, setCallStatus] = useState("idle");
    const [incomingCall, setIncomingCall] = useState(null);
    const [activeChannel, setActiveChannel] = useState(null);
    const socketRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        let cleanupSocket = null;
        let socketInstance = null;

        async function initialize() {
            try {
                console.log("Initializing Chat.jsx...");

                // Step 1: Fetch user profile
                let profileRes;
                try {
                    console.log("Fetching /api/profile...");
                    profileRes = await axios.get("/api/profile", { withCredentials: true });
                    console.log("Profile response:", profileRes);
                } catch (err) {
                    const errorDetails = err.response
                        ? `Status: ${err.response.status}, Data: ${JSON.stringify(err.response.data)}`
                        : `No response: ${err.message}`;
                    throw new Error(`Failed to fetch profile: ${errorDetails}`);
                }

                if (!profileRes?.data?.id || !profileRes?.data?.username) {
                    throw new Error("Invalid profile data: id or username missing");
                }
                console.log("Profile data:", profileRes.data);
                setMyUserId(profileRes.data.id);
                setUsername(profileRes.data.username);
                setLoggedIn(true);

                // Step 2: Fetch Stream chat token
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

                const { chatToken } = tokenRes.data || {};
                if (!chatToken) {
                    throw new Error("Invalid token data: chatToken missing");
                }
                console.log("Tokens:", { chatToken });

                // Step 3: Initialize Stream Chat
                let chatClient;
                try {
                    console.log("Initializing StreamChat with API key:", import.meta.env.VITE_STREAM_API_KEY);
                    chatClient = StreamChat.getInstance(import.meta.env.VITE_STREAM_API_KEY);
                    console.log("Connecting StreamChat user...");
                    await chatClient.connectUser(
                        {
                            id: profileRes.data.id,
                            name: profileRes.data.username,
                        },
                        chatToken
                    );
                    console.log("Stream Chat connected");
                    setChatClient(chatClient);

                    // Fetch initial online users
                    const users = await chatClient.queryUsers(
                        { id: { $ne: profileRes.data.id } },
                        { last_active: -1 }
                    );
                    const initialOnlinePeople = users.users
                        .filter((user) => user.online)
                        .reduce((acc, user) => {
                            acc[user.id] = user.name || "";
                            return acc;
                        }, {});
                    setOnlinePeople(initialOnlinePeople);
                } catch (err) {
                    throw new Error(`Failed to initialize Stream Chat: ${err.message || JSON.stringify(err)}`);
                }

                // Step 4: Initialize Socket.IO
                try {
                    console.log("Initializing Socket.IO...");
                    socketInstance = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:4000', {
                        withCredentials: true,
                        transports: ['websocket'],
                        reconnection: true,
                        reconnectionAttempts: 5,
                        reconnectionDelay: 1000,
                        reconnectionDelayMax: 5000,
                    });
                    setSocket(socketInstance);
                    socketRef.current = socketInstance;

                    socketInstance.on('connect', () => {
                        console.log('Socket.IO connected, registering user:', profileRes.data.id);
                        socketInstance.emit('register', profileRes.data.id);
                    });

                    socketInstance.on('connect_error', (err) => {
                        console.error('Socket.IO connection error:', err.message);
                        setError(`Socket.IO connection failed: ${err.message}`);
                    });

                    socketInstance.on('user-online', ({ userId, username }) => {
                        console.log(`User online: ${userId} (${username})`);
                        setOnlinePeople((prev) => ({
                            ...prev,
                            [userId]: username,
                        }));
                        setOfflinePeople((prev) => {
                            const newOffline = { ...prev };
                            delete newOffline[userId];
                            return newOffline;
                        });
                    });

                    socketInstance.on('user-offline', ({ userId }) => {
                        console.log(`User offline: ${userId}`);
                        setOnlinePeople((prev) => {
                            const newOnline = { ...prev };
                            delete newOnline[userId];
                            return newOnline;
                        });
                        setOfflinePeople((prev) => ({
                            ...prev,
                            [userId]: prev[userId] || { username: 'Unknown' },
                        }));
                    });

                    socketInstance.on('incoming-call', ({ callId, callerId, callerName }) => {
                        console.log('Received incoming call:', { callId, callerId, callerName });
                        if (!callerName) {
                            console.warn('Caller name is missing, using default');
                            callerName = 'Unknown';
                        }
                        
                        // Store incoming call data and set call status
                        setIncomingCall({
                            callId,
                            callerId,
                            callerName,
                            timestamp: Date.now()
                        });
                        setCallStatus("incoming");
                    });

                    socketInstance.on('call-ringing', ({ callId }) => {
                        console.log(`Call ${callId} is ringing`);
                        setCallStatus("ringing");
                    });

                    socketInstance.on('call-accepted', ({ callId, calleeId }) => {
                        console.log('Call accepted by:', calleeId);
                        setCallStatus("accepted");
                        navigate(`/call/${callId}`, {
                            state: {
                                callId,
                                recipientId: calleeId,
                                recipientUsername: onlinePeople[calleeId] || offlinePeople[calleeId]?.username || 'Unknown',
                                initiator: true,
                            },
                        });
                    });

                    socketInstance.on('call-rejected', ({ callId, calleeId }) => {
                        console.log(`Call ${callId} rejected by ${calleeId}`);
                        setCallStatus("idle");
                        alert('Call was rejected by the recipient');
                    });

                    socketInstance.on('call-failed', ({ reason, message }) => {
                        console.log('Call failed:', { reason, message });
                        setCallStatus("idle");
                        alert(`Call failed: ${message}`);
                    });

                    socketInstance.on('call-not-available', ({ userId, reason }) => {
                        console.log(`User ${userId} not available: ${reason}`);
                        setCallStatus("idle");
                        alert(`Call failed: User is not available (${reason})`);
                    });

                    socketInstance.on('call-ended', ({ callId, reason }) => {
                        console.log(`Call ${callId} ended, reason: ${reason || 'unknown'}`);
                        setCallStatus("idle");
                        navigate('/chat');
                        alert(`Call ended${reason === 'user-disconnected' ? ': Other user disconnected' : ''}`);
                    });

                    cleanupSocket = () => {
                        console.log('Cleaning up Socket.IO listeners');
                        socketInstance.off('connect');
                        socketInstance.off('connect_error');
                        socketInstance.off('user-online');
                        socketInstance.off('user-offline');
                        socketInstance.off('incoming-call');
                        socketInstance.off('call-ringing');
                        socketInstance.off('call-accepted');
                        socketInstance.off('call-rejected');
                        socketInstance.off('call-failed');
                        socketInstance.off('call-not-available');
                        socketInstance.off('call-ended');
                        socketInstance.disconnect();
                    };
                } catch (err) {
                    throw new Error(`Failed to initialize Socket.IO: ${err.message || JSON.stringify(err)}`);
                }

                // Step 5: Set up Stream Chat event listeners
                console.log("Setting up Stream Chat event listeners...");
                chatClient.on("user.presence.changed", (event) => {
                    const user = event.user;
                    if (user && user.id !== myUserId) {
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
                });
            } catch (err) {
                console.error("Initialization failed:", err);
                console.error("Error details:", JSON.stringify(err, null, 2));
                setError(`Failed to initialize: ${err.message || 'Unknown error'}`);
                setLoggedIn(false);
                setChatClient(null);
                setSocket(null);
            }
        }

        initialize();

        return () => {
            if (chatClient) {
                chatClient.disconnectUser();
                console.log("Stream Chat disconnected");
            }
            if (cleanupSocket) {
                cleanupSocket();
                console.log("Socket.IO disconnected");
            }
        };
    }, []);

    // Handle incoming call timeouts
    useEffect(() => {
        if (incomingCall) {
            const timeoutId = setTimeout(() => {
                if (callStatus === "incoming") {
                    console.log(`Call ${incomingCall.callId} timed out without response`);
                    handleRejectCall();
                }
            }, 30000); // 30 seconds timeout
            
            return () => clearTimeout(timeoutId);
        }
    }, [incomingCall, callStatus]);

    useEffect(() => {
        if (loggedIn && myUserId) {
            axios.get("/api/people").then((res) => {
                const offlinePeopleArray = res.data
                    .filter((p) => p._id !== myUserId)
                    .filter((p) => !Object.keys(onlinePeople).includes(p._id));
                const offlinePeople = offlinePeopleArray.reduce((acc, p) => {
                    acc[p._id] = { username: p.username };
                    return acc;
                }, {});
                setOfflinePeople(offlinePeople);
            }).catch((err) => {
                console.error("Failed to fetch people:", err);
            });
        }
    }, [onlinePeople, myUserId, loggedIn]);

    function logout() {
        axios
            .post("/api/logout")
            .then(() => {
                if (chatClient) chatClient.disconnectUser();
                if (socket) socket.disconnect();
                setMyUserId(null);
                setUsername(null);
                setSelectedUserId(null);
                setOnlinePeople({});
                setOfflinePeople({});
                setLoggedIn(false);
                setChatClient(null);
                setSocket(null);
                setCallStatus("idle");
                navigate("/login");
            })
            .catch((err) => {
                console.error("Logout failed:", err);
            });
    }

    const handleAcceptCall = () => {
        if (!incomingCall || !socketRef.current) return;
        
        console.log('Call accepted by user, emitting call-accepted');
        socketRef.current.emit('call-accepted', { 
            callId: incomingCall.callId, 
            calleeId: myUserId, 
            callerId: incomingCall.callerId 
        });
        
        setCallStatus("accepted");
        navigate(`/call/${incomingCall.callId}`, {
            state: {
                callId: incomingCall.callId,
                recipientId: incomingCall.callerId,
                recipientUsername: incomingCall.callerName,
                initiator: false,
            },
        });
        
        setIncomingCall(null);
    };

    const handleRejectCall = () => {
        if (!incomingCall || !socketRef.current) return;
        
        console.log('Call rejected by user, emitting call-rejected');
        socketRef.current.emit('call-rejected', { 
            callId: incomingCall.callId, 
            calleeId: myUserId, 
            callerId: incomingCall.callerId 
        });
        
        setCallStatus("idle");
        setIncomingCall(null);
    };

    const handleContactClick = (userId) => {
        setSelectedUserId(userId);
        if (chatClient) {
            chatClient
                .queryChannels({
                    type: "messaging",
                    members: { $eq: [myUserId.toString(), userId] },
                })
                .then((channels) => {
                    if (channels.length > 0) {
                        setActiveChannel(channels[0]); // Use the existing channel
                    } else {
                        // Create a new channel if it doesn't exist
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

    const CustomChannelHeader = () => {
        const handleVideoCall = async () => {
            if (!selectedUserId || !socket || !chatClient) {
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
                console.log('Initiating call to:', selectedUserId);

                const callId = `call_${Date.now()}_${myUserId}_${selectedUserId}`;
                setCallStatus("calling");

                socket.emit('call-request', {
                    callId,
                    calleeId: selectedUserId,
                    callerId: myUserId,
                    callerName: username
                });

                const callTimeout = setTimeout(() => {
                    if (callStatus === "calling" || callStatus === "ringing") {
                        socket.emit('call-rejected', {
                            callId,
                            calleeId: selectedUserId,
                            callerId: myUserId
                        });
                        setCallStatus("idle");
                        alert("Call timed out: No response from recipient.");
                    }
                }, 30000);

                return () => clearTimeout(callTimeout);
            } catch (error) {
                console.error("Failed to initiate video call:", error);
                setCallStatus("idle");
                alert(`Failed to start video call: ${error.message}. Please try again.`);
            }
        };

        return (
            <div className="flex items-center justify-between p-4 border-b border-gray-300 bg-white">
                <ChannelHeader />
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

    const IncomingCallDialog = () => {
        if (!incomingCall || callStatus !== "incoming") return null;
        
        return (
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full border border-gray-300">
                    <h3 className="text-xl font-medium text-black mb-4">Incoming Call</h3>
                    <p className="text-gray-700 mb-6">
                        {incomingCall.callerName} is calling you
                    </p>
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

    return (
        <>
            <Chat client={chatClient} theme="messaging light">
                <div className="flex h-screen w-full overflow-x-hidden bg-white">
                    <div className="bg-white border-r border-gray-300 w-80 flex flex-col fixed top-0 left-0 h-full">
                        <div className="flex-grow overflow-y-auto scrollbar-hidden">
                            <Logo />
                            <div className="border-b mx-3 border-gray-300" />
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
                    <div className="flex flex-col bg-white flex-1 ml-80 p-6 overflow-x-hidden">
                        <Channel channel={activeChannel}>
                            <Window>
                                <CustomChannelHeader />
                                <MessageList />
                                <MessageInput />
                            </Window>
                            <Thread />
                        </Channel>
                    </div>
                </div>
            </Chat>

            <IncomingCallDialog />
        </>
    );
}