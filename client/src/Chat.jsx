import { useEffect, useState } from "react";
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
import { StreamVideo, StreamVideoClient } from "@stream-io/video-react-sdk";
import { useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import Logo from "./Logo";
import Contact from "./Contact";
import { LogOut, Video } from "lucide-react";
import "stream-chat-react/dist/css/v2/index.css";

export default function ChatComponent() {
    const [chatClient, setChatClient] = useState(null);
    const [videoClient, setVideoClient] = useState(null);
    const [myUserId, setMyUserId] = useState(null);
    const [username, setUsername] = useState(null);
    const [loggedIn, setLoggedIn] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({});
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        let cleanupVideoClient = null;

        async function initialize() {
            try {
                console.log("Initializing Chat.jsx...");

                // Step 1: Fetch user profile
                let profileRes;
                try {
                    console.log("Fetching /api/profile...");
                    console.log("Request URL:", axios.defaults.baseURL + "/api/profile");
                    console.log("Cookies sent with request:", document.cookie);
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

                // Step 2: Fetch Stream tokens
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

                const { chatToken, videoToken } = tokenRes.data || {};
                if (!chatToken || !videoToken) {
                    throw new Error("Invalid token data: chatToken or videoToken missing");
                }
                console.log("Tokens:", { chatToken, videoToken });

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
                } catch (err) {
                    throw new Error(`Failed to initialize Stream Chat: ${err.message || JSON.stringify(err)}`);
                }

                // Step 4: Initialize Stream Video
                let videoClient;
                try {
                    console.log("Initializing StreamVideoClient...");
                    const videoConfig = {
                        apiKey: import.meta.env.VITE_STREAM_API_KEY,
                        user: { id: profileRes.data.id, name: profileRes.data.username },
                        token: videoToken,
                    };
                    console.log("Video config:", videoConfig);
                    videoClient = StreamVideoClient.getOrCreateInstance(videoConfig);
                    console.log("Connecting StreamVideo user...");
                    await videoClient.connectUser();
                    console.log("Stream Video connected");
                    setVideoClient(videoClient);
                    cleanupVideoClient = () => videoClient.disconnectUser();
                } catch (err) {
                    throw new Error(`Failed to initialize Stream Video: ${err.message || JSON.stringify(err)}`);
                }

                // Step 5: Set up event listeners
                console.log("Setting up event listeners...");
                chatClient.on("user.presence.changed", (event) => {
                    const user = event.user;
                    if (user && user.id !== myUserId) {
                        setOnlinePeople((prev) => ({
                            ...prev,
                            [user.id]: user.name || "",
                        }));
                    }
                });

                chatClient.on("notification.message_new", async (event) => {
                    if (event.message?.type === "call_invitation") {
                        const callId = event.message.text;
                        const initiatorId = event.message.user.id;
                        const initiatorUsername = onlinePeople[initiatorId] || offlinePeople[initiatorId]?.username;
                        if (window.confirm(`Incoming call from ${initiatorUsername}. Accept?`)) {
                            navigate(`/call/${callId}`, {
                                state: {
                                    recipientId: initiatorId,
                                    recipientUsername: initiatorUsername,
                                    initiator: false,
                                },
                            });
                        }
                    }
                });
            } catch (err) {
                console.error("Initialization failed:", err);
                console.error("Error details:", JSON.stringify(err, null, 2));
                setError(`Failed to initialize: ${err.message || 'Unknown error'}`);
                setLoggedIn(false);
                setChatClient(null);
                setVideoClient(null);
            }
        }

        initialize();

        return () => {
            if (chatClient) {
                chatClient.disconnectUser();
                console.log("Stream Chat disconnected");
            }
            if (cleanupVideoClient) {
                cleanupVideoClient();
                console.log("Stream Video disconnected");
            }
        };
    }, []);

    useEffect(() => {
        if (loggedIn) {
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
                if (videoClient) videoClient.disconnectUser();
                setMyUserId(null);
                setUsername(null);
                setSelectedUserId(null);
                setOnlinePeople({});
                setOfflinePeople({});
                setLoggedIn(false);
                setChatClient(null);
                setVideoClient(null);
                navigate("/login");
            })
            .catch((err) => {
                console.error("Logout failed:", err);
            });
    }

    const CustomChannelHeader = () => {
        const handleVideoCall = async () => {
            if (!selectedUserId || !videoClient || !chatClient) {
                alert("Please select a contact and ensure clients are initialized.");
                return;
            }

            try {
                const callId = require("crypto").randomUUID();
                const call = videoClient.call("default", callId);
                await call.getOrCreate({
                    ring: true,
                    data: {
                        members: [
                            { user_id: myUserId, role: "admin" },
                            { user_id: selectedUserId },
                        ],
                    },
                });

                // Notify recipient via Stream Chat
                const channel = chatClient.channel("messaging", {
                    members: [myUserId, selectedUserId],
                });
                await channel.create();
                await channel.sendMessage({
                    text: callId,
                    type: "call_invitation",
                });

                navigate(`/call/${callId}`, {
                    state: {
                        recipientId: selectedUserId,
                        recipientUsername: onlinePeople[selectedUserId] || offlinePeople[selectedUserId]?.username,
                        initiator: true,
                    },
                });
            } catch (error) {
                console.error("Failed to initiate video call:", error);
                alert("Failed to start video call. Please try again.");
            }
        };

        return (
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                <ChannelHeader />
                {selectedUserId && (
                    <button
                        onClick={handleVideoCall}
                        className="text-zinc-400 p-2 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors"
                        title="Start Video Call"
                    >
                        <Video className="w-5 h-5" />
                    </button>
                )}
            </div>
        );
    };

    const filters = { type: "messaging", members: { $in: [myUserId?.toString()] } };
    const sort = [{ last_message_at: -1 }];

    if (!loggedIn || !chatClient) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-900">
                <div className="text-center">
                    <h1 className="text-xl text-white mb-4 mt-8">You are logged out</h1>
                    {error && <p className="text-red-400 mb-4">{error}</p>}
                    <p className="text-zinc-400 mb-6">Please login to continue chatting</p>
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
        <StreamVideo client={videoClient}>
            <Chat client={chatClient} theme="messaging dark">
                <div className="flex h-screen w-full overflow-x-hidden">
                    <div className="bg-zinc-900 border-r border-zinc-700 w-80 flex flex-col fixed top-0 left-0 h-full">
                        <div className="flex-grow overflow-y-auto scrollbar-hidden">
                            <Logo />
                            <div className="border-b mx-3 border-zinc-700" />
                            {Object.keys(onlinePeople).map((userId) => (
                                <Contact
                                    key={userId}
                                    id={userId}
                                    username={onlinePeople[userId]}
                                    online={true}
                                    onClick={() => {
                                        setSelectedUserId(userId);
                                        chatClient
                                            .queryChannels({
                                                type: "messaging",
                                                members: { $eq: [myUserId.toString(), userId] },
                                            })
                                            .then((channels) => {
                                                if (channels.length === 0) {
                                                    chatClient
                                                        .channel("messaging", {
                                                            members: [myUserId.toString(), userId],
                                                        })
                                                        .create();
                                                }
                                            });
                                    }}
                                    selected={userId === selectedUserId}
                                />
                            ))}
                            {Object.keys(offlinePeople).map((userId) => (
                                <Contact
                                    key={userId}
                                    id={userId}
                                    username={offlinePeople[userId].username}
                                    online={false}
                                    onClick={() => {
                                        setSelectedUserId(userId);
                                        chatClient
                                            .queryChannels({
                                                type: "messaging",
                                                members: { $eq: [myUserId.toString(), userId] },
                                            })
                                            .then((channels) => {
                                                if (channels.length === 0) {
                                                    chatClient
                                                        .channel("messaging", {
                                                            members: [myUserId.toString(), userId],
                                                        })
                                                        .create();
                                                }
                                            });
                                    }}
                                    selected={userId === selectedUserId}
                                />
                            ))}
                        </div>
                        <div className="flex items-center justify-between bg-zinc-800 rounded-lg m-4 p-4">
                            <span className="flex items-center text-sm text-zinc-400">
                                <Avatar userId={myUserId} username={username} className="flex-shrink-0 w-8 h-8 mr-2" />
                                <div className="mr-4"></div>
                                {username}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={logout}
                                    className="text-zinc-400 p-2 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors"
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col bg-zinc-900 flex-1 ml-80 p-6 overflow-x-hidden">
                        <ChannelList
                            filters={filters}
                            sort={sort}
                            showChannelSearch={false}
                            additionalChannelListProps={{
                                onChannelSelect: (channel) => {
                                    const members = Object.keys(channel.state.members);
                                    const otherMember = members.find((m) => m !== myUserId.toString());
                                    setSelectedUserId(otherMember || null);
                                },
                            }}
                        />
                        <Channel>
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
        </StreamVideo>
    );
}