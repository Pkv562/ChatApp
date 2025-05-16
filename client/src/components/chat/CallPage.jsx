import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Video, Mic, MicOff, VideoOff } from 'lucide-react';

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
      {/* Header */}
      <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Video Call with {recipientUsername}
        </h1>
        <button
          onClick={handleEndCall}
          className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
          aria-label="End call"
        >
          <Video className="w-5 h-5" />
          End Call
        </button>
      </div>

      {/* Main Video Area */}
      <div className="flex-grow relative flex items-center justify-center p-4">
        {/* Remote Video (Main) */}
        <div className="w-full h-full max-w-5xl bg-zinc-800 rounded-lg overflow-hidden shadow-lg">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2 bg-zinc-900 bg-opacity-50 px-2 py-1 rounded text-xs">
            {recipientUsername}
          </div>
        </div>

        {/* Local Video (Bottom Right) */}
        <div className="absolute bottom-4 right-4 w-48 h-36 md:w-32 md:h-24 bg-zinc-800 rounded-lg overflow-hidden shadow-lg border border-zinc-700">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-zinc-900 bg-opacity-50 px-2 py-1 rounded text-xs">
            You
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 bg-zinc-800 bg-opacity-80 flex justify-center gap-4">
        <AudioToggleButton localStream={localStream} />
        <VideoToggleButton localStream={localStream} />
      </div>
    </div>
  );
}

function AudioToggleButton({ localStream }) {
  const [isMuted, setIsMuted] = useState(false);

  const toggleAudio = () => {
    if (localStream && localStream.getAudioTracks().length > 0) {
      const audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    } else {
      console.warn("No audio track available");
    }
  };

  return (
    <button
      onClick={toggleAudio}
      className={`text-white p-3 rounded-full hover:bg-zinc-700 flex items-center justify-center ${
        isMuted ? "bg-red-500" : "bg-zinc-600"
      }`}
      title={isMuted ? "Unmute" : "Mute"}
      aria-label={isMuted ? "Unmute" : "Mute"}
    >
      {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
    </button>
  );
}

function VideoToggleButton({ localStream }) {
  const [isVideoOff, setIsVideoOff] = useState(false);

  const toggleVideo = () => {
    if (localStream && localStream.getVideoTracks().length > 0) {
      const videoTrack = localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    } else {
      console.warn("No video track available");
    }
  };

  return (
    <button
      onClick={toggleVideo}
      className={`text-white p-3 rounded-full hover:bg-zinc-700 flex items-center justify-center ${
        isVideoOff ? "bg-red-500" : "bg-zinc-600"
      }`}
      title={isVideoOff ? "Turn on video" : "Turn off video"}
      aria-label={isVideoOff ? "Turn on video" : "Turn off video"}
    >
      {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
    </button>
  );
}