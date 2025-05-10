import { useEffect, useRef, useState } from 'react';
    import { useParams, useLocation, useNavigate } from 'react-router-dom';
    import { Video } from 'lucide-react';

    export default function CallPage() {
        const { callId } = useParams();
        const { state } = useLocation();
        const navigate = useNavigate();
        const localVideoRef = useRef(null);
        const remoteVideoRef = useRef(null);
        const [peerConnection, setPeerConnection] = useState(null);
        const [localStream, setLocalStream] = useState(null);
        const [ws, setWs] = useState(null);
        const recipientUsername = state?.recipientUsername || 'User';
        const recipientId = state?.recipientId;

        useEffect(() => {
            const socket = new WebSocket(`ws://localhost:4000/call/${callId}`);
            setWs(socket);

            socket.onopen = () => {
                console.log('WebSocket connected for call');
            };

            socket.onmessage = async (event) => {
                const message = JSON.parse(event.data);
                if (message.type === 'offer') {
                    await handleOffer(message);
                } else if (message.type === 'answer') {
                    await handleAnswer(message);
                } else if (message.type === 'ice-candidate') {
                    await handleIceCandidate(message);
                }
            };

            socket.onclose = () => {
                console.log('WebSocket disconnected');
                cleanup();
            };

            initializePeerConnection();
            startLocalStream();

            return () => {
                socket.close();
                cleanup();
            };
        }, [callId]);

        const initializePeerConnection = () => {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            pc.onicecandidate = (event) => {
                if (event.candidate && ws) {
                    ws.send(JSON.stringify({
                        type: 'ice-candidate',
                        candidate: event.candidate,
                        callId
                    }));
                }
            };

            pc.ontrack = (event) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            setPeerConnection(pc);
        };

        const startLocalStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                setLocalStream(stream);

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                if (peerConnection) {
                    stream.getTracks().forEach(track => {
                        peerConnection.addTrack(track, stream);
                    });

                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);
                    if (ws) {
                        ws.send(JSON.stringify({
                            type: 'offer',
                            offer,
                            callId,
                            recipientId
                        }));
                    }
                }
            } catch (error) {
                console.error('Error accessing media devices:', error);
            }
        };

        const handleOffer = async (message) => {
            if (!peerConnection) return;

            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                if (ws) {
                    ws.send(JSON.stringify({
                        type: 'answer',
                        answer,
                        callId
                    }));
                }
            } catch (error) {
                console.error('Error handling offer:', error);
            }
        };

        const handleAnswer = async (message) => {
            if (!peerConnection) return;

            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
            } catch (error) {
                console.error('Error handling answer:', error);
            }
        };

        const handleIceCandidate = async (message) => {
            if (!peerConnection) return;

            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
            } catch (error) {
                console.error('Error handling ICE candidate:', error);
            }
        };

        const cleanup = () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            if (peerConnection) {
                peerConnection.close();
            }
            setLocalStream(null);
            setPeerConnection(null);
        };

        const handleEndCall = () => {
            if (ws) {
                ws.close();
            }
            cleanup();
            navigate('/chat');
        };

        return (
            <div className="flex flex-col h-screen bg-zinc-900 text-white">
                <div className="p-4 border-b border-zinc-700">
                    <h1 className="text-xl font-semibold">Video Call with {recipientUsername}</h1>
                </div>
                <div className="flex-grow flex items-center justify-center gap-4 p-4">
                    <div className="relative w-1/2 h-3/4 bg-zinc-800 rounded-lg overflow-hidden">
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 bg-zinc-900 bg-opacity-50 px-2 py-1 rounded">
                            {recipientUsername}
                        </div>
                    </div>
                    <div className="relative w-1/4 h-1/4 bg-zinc-800 rounded-lg overflow-hidden">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 bg-zinc-900 bg-opacity-50 px-2 py-1 rounded">
                            You
                        </div>
                    </div>
                </div>
                <div className="p-4 flex justify-center">
                    <button
                        onClick={handleEndCall}
                        className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                    >
                        <Video className="w-5 h-5" />
                        End Call
                    </button>
                </div>
            </div>
        );
    }