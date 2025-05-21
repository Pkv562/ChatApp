/**
 * CallPage.jsx
 * 
 * This component implements a WebRTC-based video call interface using a WebSocket
 * for signaling. It handles peer-to-peer video and audio streaming, including
 * local and remote video display, ICE candidate exchange, and media controls.
 * 
 * Key Features:
 * - Establishes a WebRTC peer connection for real-time video/audio communication.
 * - Uses WebSocket for signaling (offer/answer and ICE candidate exchange).
 * - Provides UI controls to toggle audio/video and end the call.
 * - Displays local and remote video streams with participant labels.
 * 
 * Dependencies:
 * - React (useEffect, useRef, useState for state management)
 * - react-router-dom (useParams, useLocation, useNavigate for routing)
 * - lucide-react (icons for UI controls)
 * - socket.io-client (for WebSocket communication)
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Video, Mic, MicOff, VideoOff } from 'lucide-react';
import io from 'socket.io-client';

/**
 * Main CallPage component
 * 
 * Manages the video call lifecycle, including WebSocket connection, WebRTC setup,
 * and UI rendering. Retrieves callId and recipient details from URL params and
 * location state.
 */
export default function CallPage() {
  // Extract callId from URL parameters
  const { callId } = useParams();
  // Access location state for recipient details
  const { state } = useLocation();
  // Navigation hook for redirecting (e.g., after call ends)
  const navigate = useNavigate();
  // Refs for local and remote video elements
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  // State for WebRTC peer connection
  const [peerConnection, setPeerConnection] = useState(null);
  // State for local media stream (camera/mic)
  const [localStream, setLocalStream] = useState(null);
  // State for WebSocket connection
  const [ws, setWs] = useState(null);
  // State for error messages
  const [error, setError] = useState('');
  // State for loading status
  const [loading, setLoading] = useState(true);
  // Recipient details from location state (default to 'User' if not provided)
  const recipientUsername = state?.recipientUsername || 'User';
  const recipientId = state?.recipientId;
  const initiator = state?.initiator || false;

  /**
   * useEffect: Initialize WebSocket and WebRTC
   * 
   * Runs on component mount and when callId changes. Sets up the WebSocket
   * connection for signaling and initializes the WebRTC peer connection and
   * local media stream.
   * 
   * Cleanup:
   * - Closes WebSocket and releases resources on unmount.
   */
  useEffect(() => {
    let isMounted = true;

    // Step 1: Create Socket.IO connection to signaling server
    const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:4000', {
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    setWs(socket);

    // Step 2: Handle Socket.IO connection open
    socket.on('connect', () => {
      console.log('Socket.IO connected for call');
      // Register the user with the callId
      socket.emit('register-call', { callId, userId: state?.userId });
    });

    // Step 3: Handle incoming Socket.IO messages
    socket.on('message', async (message) => {
      if (!isMounted) return;
      console.log('Received message:', message);
      if (message.type === 'offer') {
        // Handle incoming offer from remote peer
        await handleOffer(message);
      } else if (message.type === 'answer') {
        // Handle incoming answer from remote peer
        await handleAnswer(message);
      } else if (message.type === 'ice-candidate') {
        // Handle incoming ICE candidate
        await handleIceCandidate(message);
      }
    });

    // Step 4: Handle Socket.IO disconnection
    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
      if (isMounted) {
        setError('Connection lost. Please try again.');
        setLoading(false);
      }
    });

    // Step 5: Handle Socket.IO errors
    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err);
      if (isMounted) {
        setError(`Failed to connect to signaling server: ${err.message}`);
        setLoading(false);
      }
    });

    // Step 6: Initialize WebRTC peer connection
    initializePeerConnection();
    // Step 7: Start local media stream (camera/mic)
    startLocalStream();

    // Cleanup on component unmount
    return () => {
      isMounted = false;
      socket.disconnect();
      cleanup();
    };
  }, [callId, state?.userId]);

  /**
   * initializePeerConnection
   * 
   * Sets up the WebRTC RTCPeerConnection for peer-to-peer communication.
   * Configures ICE servers and event handlers for ICE candidates and remote tracks.
   */
  const initializePeerConnection = () => {
    // Step 1: Create RTCPeerConnection with STUN server
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Step 2: Handle ICE candidate events
    pc.onicecandidate = (event) => {
      if (event.candidate && ws && ws.connected) {
        // Send ICE candidate to remote peer via Socket.IO
        ws.emit('message', {
          type: 'ice-candidate',
          candidate: event.candidate,
          callId,
        });
      }
    };

    // Step 3: Handle incoming remote tracks
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && isMounted) {
        // Set remote video element source to incoming stream
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Step 4: Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed' && isMounted) {
        setError('Failed to establish WebRTC connection.');
        setLoading(false);
      } else if (pc.connectionState === 'connected' && isMounted) {
        setLoading(false);
      }
    };

    // Step 5: Store peer connection in state
    setPeerConnection(pc);
  };

  /**
   * startLocalStream
   * 
   * Requests access to the user's camera and microphone, sets up the local
   * video stream, and initiates the WebRTC offer process.
   */
  const startLocalStream = async () => {
    try {
      // Step 1: Request media devices (camera and microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (!isMounted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setLocalStream(stream);

      // Step 2: Set local video element source
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Step 3: Add local tracks to peer connection
      if (peerConnection) {
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        // Step 4: Create and set local offer (only for initiator)
        if (initiator) {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);

          // Step 5: Send offer to remote peer via Socket.IO
          if (ws && ws.connected) {
            ws.emit('message', {
              type: 'offer',
              offer,
              callId,
              recipientId,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      if (isMounted) {
        setError(`Failed to access camera or microphone: ${error.message}`);
        setLoading(false);
      }
    }
  };

  /**
   * handleOffer
   * 
   * Processes an incoming offer from the remote peer, sets the remote description,
   * and responds with an answer.
   */
  const handleOffer = async (message) => {
    if (!peerConnection || !isMounted) return;

    try {
      // Step 1: Set remote description from offer
      await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
      // Step 2: Create answer
      const answer = await peerConnection.createAnswer();
      // Step 3: Set local description with answer
      await peerConnection.setLocalDescription(answer);
      // Step 4: Send answer to remote peer via Socket.IO
      if (ws && ws.connected) {
        ws.emit('message', {
          type: 'answer',
          answer,
          callId,
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      if (isMounted) {
        setError(`Failed to process offer: ${error.message}`);
        setLoading(false);
      }
    }
  };

  /**
   * handleAnswer
   * 
   * Processes an incoming answer from the remote peer and sets the remote description.
   */
  const handleAnswer = async (message) => {
    if (!peerConnection || !isMounted) return;

    try {
      // Step 1: Set remote description from answer
      await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
    } catch (error) {
      console.error('Error handling answer:', error);
      if (isMounted) {
        setError(`Failed to process answer: ${error.message}`);
        setLoading(false);
      }
    }
  };

  /**
   * handleIceCandidate
   * 
   * Adds an incoming ICE candidate to the peer connection to facilitate
   * connectivity.
   */
  const handleIceCandidate = async (message) => {
    if (!peerConnection || !isMounted) return;

    try {
      // Step 1: Add ICE candidate to peer connection
      await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
      if (isMounted) {
        setError(`Failed to process ICE candidate: ${error.message}`);
        setLoading(false);
      }
    }
  };

  /**
   * cleanup
   * 
   * Releases resources by stopping media tracks and closing the peer connection.
   */
  const cleanup = () => {
    // Step 1: Stop all local media tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    // Step 2: Close peer connection
    if (peerConnection) {
      peerConnection.close();
    }
    // Step 3: Reset state
    setLocalStream(null);
    setPeerConnection(null);
  };

  /**
   * handleEndCall
   * 
   * Ends the call by closing the WebSocket, cleaning up resources, and
   * navigating back to the chat page.
   */
  const handleEndCall = () => {
    // Step 1: Notify server to end the call
    if (ws && ws.connected) {
      ws.emit('call-ended', { callId, reason: 'user-ended' });
    }
    // Step 2: Close WebSocket
    if (ws) {
      ws.disconnect();
    }
    // Step 3: Cleanup resources
    cleanup();
    // Step 4: Navigate to chat page
    navigate('/chat');
  };

  /**
   * Render
   * 
   * Renders the video call interface with local and remote video streams,
   * participant labels, and control buttons.
   */
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="bg-zinc-800 p-6 rounded-lg max-w-md w-full text-center">
          <h2 className="text-red-500 text-xl mb-4">Call Error</h2>
          <p className="text-zinc-300 mb-6">{error}</p>
          <button
            onClick={handleEndCall}
            className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
            aria-label="Return to chat"
          >
            Return to Chat
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
          <p>Connecting to call...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-900 text-white">
      {/* Header with call title and end call button */}
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

      {/* Main video area */}
      <div className="flex-grow relative flex items-center justify-center p-4">
        {/* Remote video (main display) */}
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

        {/* Local video (bottom right) */}
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

      {/* Control buttons */}
      <div className="p-4 bg-zinc-800 bg-opacity-80 flex justify-center gap-4">
        <AudioToggleButton localStream={localStream} />
        <VideoToggleButton localStream={localStream} />
      </div>
    </div>
  );
}

/**
 * AudioToggleButton
 * 
 * A button component to toggle the audio track (mute/unmute) of the local stream.
 */
function AudioToggleButton({ localStream }) {
  const [isMuted, setIsMuted] = useState(false);

  // Toggle audio track enabled state
  const toggleAudio = () => {
    if (localStream && localStream.getAudioTracks().length > 0) {
      const audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    } else {
      console.warn('No audio track available');
    }
  };

  return (
    <button
      onClick={toggleAudio}
      className={`text-white p-3 rounded-full hover:bg-zinc-700 flex items-center justify-center ${
        isMuted ? 'bg-red-500' : 'bg-zinc-600'
      }`}
      title={isMuted ? 'Unmute' : 'Mute'}
      aria-label={isMuted ? 'Unmute' : 'Mute'}
    >
      {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
    </button>
  );
}

/**
 * VideoToggleButton
 * 
 * A button component to toggle the video track (on/off) of the local stream.
 */
function VideoToggleButton({ localStream }) {
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Toggle video track enabled state
  const toggleVideo = () => {
    if (localStream && localStream.getVideoTracks().length > 0) {
      const videoTrack = localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    } else {
      console.warn('No video track available');
    }
  };

  return (
    <button
      onClick={toggleVideo}
      className={`text-white p-3 rounded-full hover:bg-zinc-700 flex items-center justify-center ${
        isVideoOff ? 'bg-red-500' : 'bg-zinc-600'
      }`}
      title={isVideoOff ? 'Turn on video' : 'Turn off video'}
      aria-label={isVideoOff ? 'Turn on video' : 'Turn off video'}
    >
      {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
    </button>
  );
}