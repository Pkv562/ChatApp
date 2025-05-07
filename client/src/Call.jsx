import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
    StreamCall,
    SpeakerLayout,
    CallControls,
    StreamTheme,
    StreamVideoClient,
} from "@stream-io/video-react-sdk";
import axios from "axios";
import "@stream-io/video-react-sdk/dist/css/styles.css";

export default function Call() {
    const { callId } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();
    const { recipientId, recipientUsername, initiator } = state || {};
    const [callInstance, setCallInstance] = useState(null);
    const [videoClient, setVideoClient] = useState(null);

    useEffect(() => {
        if (!recipientId || !recipientUsername || !callId) {
            alert("Invalid call details. Please try again.");
            navigate("/");
            return;
        }

        const initializeCall = async () => {
            try {
                const { videoToken } = await axios.post("/api/token", {}, {
                    withCredentials: true,
                }).then(res => res.data);

                const client = new StreamVideoClient({
                    apiKey: import.meta.env.VITE_STREAM_API_KEY,
                    user: { id: recipientId, name: recipientUsername },
                    token: videoToken,
                });

                await client.connectUser();
                setVideoClient(client);

                const call = client.call("default", callId);
                await call.join({ create: initiator });
                setCallInstance(call);

                return () => {
                    call.leave();
                    client.disconnectUser();
                };
            } catch (err) {
                console.error("Failed to join call:", err);
                alert("Failed to join call: " + err.message);
                navigate("/");
            }
        };

        initializeCall();
    }, [callId, recipientId, recipientUsername, initiator, navigate]);

    if (!callInstance || !videoClient) return null;

    return (
        <StreamCall call={callInstance}>
            <StreamTheme>
                <div className="flex h-screen flex-col items-center justify-center bg-zinc-900 text-white">
                    <h1 className="text-2xl mb-4">Video Call with {recipientUsername}</h1>
                    <SpeakerLayout participantsBarPosition="bottom" />
                    <CallControls
                        onLeave={() => navigate("/")}
                    />
                </div>
            </StreamTheme>
        </StreamCall>
    );
}