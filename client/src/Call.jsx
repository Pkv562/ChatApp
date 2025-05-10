import { useEffect, useState, useCallback } from "react";
import { StreamVideoClient } from "@stream-io/video-react-sdk";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  StreamCall,
  CallControls,
  CallParticipantsList,
  SpeakerLayout,
  useCallStateHooks,
  useCall,
} from "@stream-io/video-react-sdk";
import { ArrowLeft, Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

export default function Call() {
  const { id: callId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [videoClient, setVideoClient] = useState(null);
  const [call, setCall] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [callInitialized, setCallInitialized] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

  const { recipientUsername, initiator } = location.state || {};

  const { useParticipantCount } = useCallStateHooks();
  const participantCount = useParticipantCount();

  const cleanup = useCallback(async () => {
    console.log("Cleaning up video call resources...");
    try {
      if (call) {
        console.log("Leaving call:", callId);
        await call.leave();
      }
      if (videoClient) {
        console.log("Disconnecting video client user");
        await videoClient.disconnectUser();
      }
    } catch (err) {
      console.error("Error during cleanup:", err);
    }
  }, [call, videoClient, callId]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      cleanup();
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    let isMounted = true;
    
    async function initializeVideoCall() {
      try {
        console.log("Initializing video call, callId:", callId, "initiator:", initiator);
        setLoading(true);
        
        // Step 1: Get profile and token
        console.log("Fetching profile and token...");
        const profileRes = await axios.get("/api/profile", { withCredentials: true });
        const tokenRes = await axios.post("/api/token", {}, { withCredentials: true });
        
        if (!profileRes.data || !tokenRes.data.videoToken) {
          throw new Error("Failed to get user profile or video token");
        }
        
        // Check if component is still mounted
        if (!isMounted) return;
        
        // Step 2: Initialize video client
        console.log("Initializing video client...");
        const videoClientConfig = {
          apiKey: import.meta.env.VITE_STREAM_API_KEY,
          user: { 
            id: profileRes.data.id, 
            name: profileRes.data.username,
            image: `https://getstream.io/random_png/?id=${profileRes.data.id}&name=${profileRes.data.username}`
          },
          token: tokenRes.data.videoToken,
          options: {
            logLevel: 'debug',
            browser: {
              audioOutput: {
                deviceId: 'default' // Ensure audio output is set
              }
            }
          },
        };
        
        const videoClientInstance = new StreamVideoClient(videoClientConfig);
        
        // Check if component is still mounted
        if (!isMounted) {
          videoClientInstance.disconnectUser().catch(err => console.error("Error disconnecting user during cleanup:", err));
          return;
        }
        
        setVideoClient(videoClientInstance);
        
        // Step 3: Get or create the call
        console.log("Creating/getting call instance:", callId);
        const callInstance = videoClientInstance.call("default", callId);
        
        // Check if component is still mounted
        if (!isMounted) {
          videoClientInstance.disconnectUser().catch(err => console.error("Error disconnecting user during cleanup:", err));
          return;
        }
        
        setCall(callInstance);
        
        // Add call state change listener
        const callStateListener = (event) => {
          console.log("Call state changed:", event.type, callInstance.state.callingState);
          
          // Handle call ended or failed states
          if (callInstance.state.callingState === 'ended' || 
              callInstance.state.callingState === 'failed') {
            console.log("Call ended or failed, navigating back to chat");
            setCallEnded(true);
          }
        };
        
        callInstance.on('callStateChanged', callStateListener);
        
        // Step 4: Join the call with appropriate options
        console.log("Joining call with create:", Boolean(initiator));
        const joinOptions = { 
          create: Boolean(initiator),
          ring: false,
          data: {
            custom: {
              username: profileRes.data.username,
              userId: profileRes.data.id
            }
          },
          audio: true, // Ensure audio is enabled by default
          video: true // Ensure video is enabled by default
        };
        
        await callInstance.join(joinOptions);
        console.log("Successfully joined call:", callId);
        
        // Check if component is still mounted
        if (!isMounted) {
          callInstance.leave().catch(err => console.error("Error leaving call during cleanup:", err));
          videoClientInstance.disconnectUser().catch(err => console.error("Error disconnecting user during cleanup:", err));
          return;
        }
        
        setCallInitialized(true);
        setLoading(false);
      } catch (err) {
        console.error("Failed to initialize video call:", err);
        if (isMounted) {
          setError(`Error initializing call: ${err.message}`);
          setLoading(false);
        }
      }
    }
    
    initializeVideoCall();
    
    return () => {
      isMounted = false;
    };
  }, [callId, initiator]);
  
  const handleEndCall = async () => {
    try {
      await cleanup();
      setCallEnded(true);
    } catch (err) {
      console.error("Error ending call:", err);
    }
  };

  function handleBackToChat() {
    navigate('/');
  }

  if (callEnded) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="bg-zinc-800 p-6 rounded-lg max-w-md w-full text-center">
          <h2 className="text-white text-xl mb-4">Call Ended</h2>
          <p className="text-zinc-300 mb-6">The video call has ended.</p>
          <button
            onClick={handleBackToChat}
            className="flex items-center justify-center gap-2 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 w-full"
          >
            <ArrowLeft size={16} />
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
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="bg-zinc-800 p-6 rounded-lg max-w-md w-full">
          <h2 className="text-red-500 text-xl mb-4">Call Error</h2>
          <p className="text-white mb-6">{error}</p>
          <button
            onClick={handleBackToChat}
            className="flex items-center gap-2 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            <ArrowLeft size={16} />
            Back to Chat
          </button>
        </div>
      </div>
    );
  }
  
  if (!call || !videoClient || !callInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="bg-zinc-800 p-6 rounded-lg max-w-md w-full">
          <h2 className="text-yellow-500 text-xl mb-4">Connection Issue</h2>
          <p className="text-white mb-6">Unable to establish call connection. Please try again.</p>
          <button
            onClick={handleBackToChat}
            className="flex items-center gap-2 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            <ArrowLeft size={16} />
            Back to Chat
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen bg-zinc-900 flex flex-col">
      <div className="bg-zinc-800 p-4 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={handleBackToChat}
            className="mr-4 text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-700"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-white text-lg">
            {recipientUsername ? `Call with ${recipientUsername}` : "Video Call"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-700"
          >
            {participantCount} Participant{participantCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
      
      <div className="flex-1 relative">
        <StreamCall call={call}>
          <div className="flex flex-col h-full">
            <div className="flex-1 relative">
              <SpeakerLayout participantsBarPosition="bottom" />
            </div>
            <div className="p-4 bg-zinc-800 flex justify-center gap-4">
              <AudioToggleButton />
              <VideoToggleButton />
              <button
                onClick={handleEndCall}
                className="bg-red-500 text-white p-3 rounded-full hover:bg-red-600 flex items-center justify-center"
                title="End call"
              >
                <PhoneOff size={20} />
              </button>
            </div>
          </div>
          
          {showParticipants && (
            <div className="absolute top-4 right-4 bg-zinc-800 bg-opacity-90 rounded-lg p-4 w-80 max-h-[80vh] overflow-y-auto">
              <CallParticipantsList />
            </div>
          )}
        </StreamCall>
      </div>
    </div>
  );
}

function AudioToggleButton() {
  const call = useCall();
  const { useMicrophoneState } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();
  
  const toggleAudio = async () => {
    if (isMute) {
      await microphone.unmute();
    } else {
      await microphone.mute();
    }
  };
  
  return (
    <button
      onClick={toggleAudio}
      className={`text-white p-3 rounded-full hover:bg-zinc-700 flex items-center justify-center ${
        isMute ? 'bg-red-500' : 'bg-zinc-600'
      }`}
      title={isMute ? "Unmute" : "Mute"}
    >
      {isMute ? <MicOff size={20} /> : <Mic size={20} />}
    </button>
  );
}

function VideoToggleButton() {
  const call = useCall();
  const { useCameraState } = useCallStateHooks();
  const { camera, isMute } = useCameraState();
  
  const toggleVideo = async () => {
    if (isMute) {
      await camera.enable();
    } else {
      await camera.disable();
    }
  };
  
  return (
    <button
      onClick={toggleVideo}
      className={`text-white p-3 rounded-full hover:bg-zinc-700 flex items-center justify-center ${
        isMute ? 'bg-red-500' : 'bg-zinc-600'
      }`}
      title={isMute ? "Turn on video" : "Turn off video"}
    >
      {isMute ? <VideoOff size={20} /> : <Video size={20} />}
    </button>
  );
}