/**
 * Call.jsx
 * 
 * This component implements a video call interface using the Stream.io Video SDK.
 * It manages the video call lifecycle, including client initialization, call joining,
 * and participant management. Provides UI controls for audio/video toggling and
 * ending the call.
 * 
 * Key Features:
 * - Integrates with Stream.io for scalable video call functionality.
 * - Handles user authentication and token retrieval for secure calls.
 * - Displays local and remote video streams with participant labels.
 * - Includes participant list toggle and call state monitoring.
 * 
 * Dependencies:
 * - React (useEffect, useState, useCallback for state and lifecycle management)
 * - react-router-dom (useParams, useLocation, useNavigate for routing)
 * - @stream-io/video-react-sdk (StreamVideoClient, StreamCall, etc.)
 * - axios (for API requests)
 * - lucide-react (icons for UI controls)
 */

import { useEffect, useState, useCallback } from 'react';
import { StreamVideoClient } from '@stream-io/video-react-sdk';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  StreamCall,
  CallParticipantsList,
  SpeakerLayout,
  useCallStateHooks,
  useCall,
} from '@stream-io/video-react-sdk';
import { ArrowLeft, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

/**
 * Main Call component
 * 
 * Manages the video call lifecycle using Stream.io SDK. Initializes the video
 * client, joins or creates a call, and renders the call interface with controls.
 */
export default function Call() {
  // Extract callId from URL parameters
  const { id: callId } = useParams();
  // Access location state for call details
  const location = useLocation();
  // Navigation hook for redirecting
  const navigate = useNavigate();
  // State for Stream.io video client
  const [videoClient, setVideoClient] = useState(null);
  // State for the active call
  const [call, setCall] = useState(null);
  // State for error messages
  const [error, setError] = useState('');
  // State for loading status
  const [loading, setLoading] = useState.writelinesLoading(true);
  // State for showing participant list
  const [showParticipants, setShowParticipants] = useState(false);
  // State for call initialization status
  const [callInitialized, setCallInitialized] = useState(false);
  // State for call end status
  const [callEnded, setCallEnded] = useState(false);

  // Extract recipient details and initiator status from location state
  const { recipientUsername, initiator } = location.state || {};

  // Access participant count from call state
  const { useParticipantCount } = useCallStateHooks();
  const participantCount = useParticipantCount();

  /**
   * cleanup
   * 
   * Releases video call resources by leaving the call and disconnecting the
   * video client. Ensures resources are freed when the component unmounts or
   * the call ends.
   */
  const cleanup = useCallback(async () => {
    console.log('Cleaning up video call resources...');
    try {
      // Step 1: Leave the active call
      if (call) {
        console.log('Leaving call:', callId);
        await call.leave();
      }
      // Step 2: Disconnect video client
      if (videoClient) {
        console.log('Disconnecting video client user');
        await videoClient.disconnectUser();
      }
    } catch (err) {
      console.error('Error during cleanup:', err);
    }
  }, [call, videoClient, callId]);

  /**
   * useEffect: Handle window beforeunload event
   * 
   * Ensures resources are cleaned up when the user closes the browser tab or
   * navigates away.
   */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      cleanup();
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanup();
    };
  }, [cleanup]);

  /**
   * useEffect: Initialize video call
   * 
   * Sets up the Stream.io video client, creates or joins a call, and handles
   * call state changes. Manages component mounting state to prevent memory leaks.
   */
  useEffect(() => {
    let isMounted = true;

    /**
     * initializeVideoCall
     * 
     * Performs the steps to set up and join a video call.
     */
    async function initializeVideoCall() {
      try {
        console.log('Initializing video call, callId:', callId, 'initiator:', initiator);
        setLoading(true);

        // Step 1: Fetch user profile and video token
        console.log('Fetching profile and token...');
        const profileRes = await axios.get('/api/profile', { withCredentials: true });
        const tokenRes = await axios.post('/api/token', {}, { withCredentials: true });

        if (!profileRes.data || !tokenRes.data.videoToken) {
          throw new Error('Failed to get user profile or video token');
        }

        // Step 2: Check if component is still mounted
        if (!isMounted) return;

        // Step 3: Initialize Stream.io video client
        console.log('Initializing video client...');
        const videoClientConfig = {
          apiKey: import.meta.env.VITE_STREAM_API_KEY,
          user: {
            id: profileRes.data.id,
            name: profileRes.data.username,
            image: `https://getstream.io/random_png/?id=${profileRes.data.id}&name=${profileRes.data.username}`,
          },
          token: tokenRes.data.videoToken,
          options: {
            logLevel: 'debug',
            browser: {
              audioOutput: {
                deviceId: 'default',
              },
            },
          },
        };

        const videoClientInstance = new StreamVideoClient(videoClientConfig);

        // Step 4: Check if component is still mounted
        if (!isMounted) {
          videoClientInstance.disconnectUser().catch((err) =>
            console.error('Error disconnecting user during cleanup:', err)
          );
          return;
        }

        setVideoClient(videoClientInstance);

        // Step 5: Get or create call instance
        console.log('Creating/getting call instance:', callId);
        const callInstance = videoClientInstance.call('default', callId);

        // Step 6: Check if component is still mounted
        if (!isMounted) {
          videoClientInstance.disconnectUser().catch((err) =>
            console.error('Error disconnecting user during cleanup:', err)
          );
          return;
        }

        setCall(callInstance);

        // Step 7: Add call state change listener
        const callStateListener = (event) => {
          console.log('Call state changed:', event.type, callInstance.state.callingState);
          if (
            callInstance.state.callingState === 'ended' ||
            callInstance.state.callingState === 'failed'
          ) {
            console.log('Call ended or failed, navigating back to chat');
            setCallEnded(true);
          }
        };

        callInstance.on('callStateChanged', callStateListener);

        // Step 8: Join the call
        console.log('Joining call with create:', Boolean(initiator));
        const joinOptions = {
          create: Boolean(initiator),
          ring: false,
          data: {
            custom: {
              username: profileRes.data.username,
              userId: profileRes.data.id,
            },
          },
          audio: true,
          video: true,
        };

        await callInstance.join(joinOptions);
        console.log('Successfully joined call:', callId);

        // Step 9: Check if component is still mounted
        if (!isMounted) {
          callInstance.leave().catch((err) =>
            console.error('Error leaving call during cleanup:', err)
          );
          videoClientInstance.disconnectUser().catch((err) =>
            console.error('Error disconnecting user during cleanup:', err)
          );
          return;
        }

        setCallInitialized(true);
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize video call:', err);
        if (isMounted) {
          setError(`Error initializing call: ${err.message}`);
          setLoading(false);
        }
      }
    }

    initializeVideoCall();

    // Cleanup on component unmount
    return () => {
      isMounted = false;
    };
  }, [callId, initiator]);

  /**
   * handleEndCall
   * 
   * Ends the call by performing cleanup and setting the callEnded state.
   */
  const handleEndCall = async () => {
    try {
      await cleanup();
      setCallEnded(true);
    } catch (err) {
      console.error('Error ending call:', err);
    }
  };

  /**
   * handleBackToChat
   * 
   * Navigates back to the chat page.
   */
  function handleBackToChat() {
    navigate('/chat');
  }

  /**
   * Render: Call ended state
   * 
   * Displays a message and button to return to chat when the call has ended.
   */
  if (callEnded) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="bg-zinc-800 p-6 rounded-lg max-w-md w-full text-center">
          <h2 className="text-white text-xl mb-4">Call Ended</h2>
          <p className="text-zinc-300 mb-6">The video call has ended.</p>
          <button
            onClick={handleBackToChat}
            className="flex items-center justify-center gap-2 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 w-full transition-colors"
            aria-label="Return to chat"
          >
            <ArrowLeft size={16} />
            Return to Chat
          </button>
        </div>
      </div>
    );
  }

  /**
   * Render: Loading state
   * 
   * Displays a loading spinner while the call is initializing.
   */
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

  /**
   * Render: Error state
   * 
   * Displays an error message and button to return to chat if initialization fails.
   */
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="bg-zinc-800 p-6 rounded-lg max-w-md w-full">
          <h2 className="text-red-500 text-xl mb-4">Call Error</h2>
          <p className="text-white mb-6">{error}</p>
          <button
            onClick={handleBackToChat}
            className="flex items-center gap-2 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
            aria-label="Back to chat"
          >
            <ArrowLeft size={16} />
            Back to Chat
          </button>
        </div>
      </div>
    );
  }

  /**
   * Render: Connection issue state
   * 
   * Displays a message and button to return to chat if the call or client is not initialized.
   */
  if (!call || !videoClient || !callInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="bg-zinc-800 p-6 rounded-lg max-w-md w-full">
          <h2 className="text-yellow-500 text-xl mb-4">Connection Issue</h2>
          <p className="text-white mb-6">Unable to establish call connection. Please try again.</p>
          <button
            onClick={handleBackToChat}
            className="flex items-center gap-2 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
            aria-label="Back to chat"
          >
            <ArrowLeft size={16} />
            Back to Chat
          </button>
        </div>
      </div>
    );
  }

  /**
   * Render: Main call interface
   * 
   * Renders the video call interface with Stream.io components, including
   * remote and local video, controls, and optional participant list.
   */
  return (
    <div className="h-screen bg-zinc-900 flex flex-col">
      {/* Header with navigation and participant toggle */}
      <div className="bg-zinc-800 p-4 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={handleBackToChat}
            className="mr-4 text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-700 transition-colors"
            aria-label="Back to chat"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-white text-lg">Video Call</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-700 transition-colors"
            aria-label="Toggle participants list"
          >
            {participantCount} Participant{participantCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Main video area */}
      <div className="flex-1 relative">
        <StreamCall call={call}>
          <div className="h-full w-full relative">
            {/* Remote video (main display) */}
            <div className="h-full w-full flex items-center justify-center">
              <SpeakerLayout participantsBarPosition={null} />
              {recipientUsername && (
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-xs">
                  {recipientUsername}
                </div>
              )}
            </div>

            {/* Local video (bottom right) */}
            <div className="absolute bottom-16 right-4 w-80 h-60 md:w-64 md:h-48 bg-zinc-800 rounded-lg overflow-hidden shadow-lg border border-zinc-700">
              <LocalParticipantVideo />
            </div>

            {/* Call controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-zinc-800 bg-opacity-80 flex justify-center gap-4">
              <AudioToggleButton />
              <VideoToggleButton />
              <button
                onClick={handleEndCall}
                className="bg-red-500 text-white p-3 rounded-full hover:bg-red-600 flex items-center justify-center transition-colors"
                title="End call"
                aria-label="End call"
              >
                <PhoneOff size={20} />
              </button>
            </div>

            {/* Participants list (optional) */}
            {showParticipants && (
              <div className="absolute top-4 right-4 bg-zinc-800 bg-opacity-90 rounded-lg p-4 w-80 max-h-[80vh] overflow-y-auto shadow-lg">
                <CallParticipantsList />
              </div>
            )}
          </div>
        </StreamCall>
      </div>
    </div>
  );
}

/**
 * AudioToggleButton
 * 
 * A button component to toggle the microphone (mute/unmute) using Stream.io SDK.
 */
function AudioToggleButton() {
  const call = useCall();
  const { useMicrophoneState } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();

  // Toggle microphone state
  const toggleAudio = async () => {
    try {
      if (isMute) {
        await microphone.enable();
      } else {
        await microphone.disable();
      }
    } catch (err) {
      console.error('Error toggling audio:', err);
    }
  };

  return (
    <button
      onClick={toggleAudio}
      className={`text-white p-3 rounded-full hover:bg-zinc-700 flex items-center justify-center transition-colors ${
        isMute ? 'bg-red-500' : 'bg-zinc-600'
      }`}
      title={isMute ? 'Unmute' : 'Mute'}
      aria-label={isMute ? 'Unmute' : 'Mute'}
    >
      {isMute ? <MicOff size={20} /> : <Mic size={20} />}
    </button>
  );
}

/**
 * VideoToggleButton
 * 
 * A button component to toggle the camera (on/off) using Stream.io SDK.
 */
function VideoToggleButton() {
  const call = useCall();
  const { useCameraState } = useCallStateHooks();
  const { camera, isMute } = useCameraState();

  // Toggle camera state
  const toggleVideo = async () => {
    try {
      if (isMute) {
        await camera.enable();
      } else {
        await camera.disable();
      }
    } catch (err) {
      console.error('Error toggling video:', err);
    }
  };

  return (
    <button
      onClick={toggleVideo}
      className={`text-white p-3 rounded-full hover:bg-zinc-700 flex items-center justify-center transition-colors ${
        isMute ? 'bg-red-500' : 'bg-zinc-600'
      }`}
      title={isMute ? 'Turn on video' : 'Turn off video'}
      aria-label={isMute ? 'Turn on video' : 'Turn off video'}
    >
      {isMute ? <VideoOff size={20} /> : <Video size={20} />}
    </button>
  );
}

/**
 * LocalParticipantVideo
 * 
 * Renders the local participant's video stream or a placeholder if the camera is off.
 */
function LocalParticipantVideo() {
  const { useLocalParticipant } = useCallStateHooks();
  const localParticipant = useLocalParticipant();

  if (!localParticipant) return null;

  return (
    <div className="w-full h-full relative">
      {localParticipant.videoStream ? (
        <video
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          ref={(video) => {
            if (video && localParticipant.videoStream) {
              video.srcObject = localParticipant.videoStream;
            }
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
          <span className="text-white text-sm">Camera Off</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-xs">
        You
      </div>
    </div>
  );
}