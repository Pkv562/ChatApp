/**
 * @file App.jsx
 * @description The main application component for the chat app.
 *              Configures Axios defaults and wraps the app with user context and routing.
 * @purpose Serves as the top-level component, setting up global configurations and providers.
 * @dependencies React, Axios, UserContextProvider, Routes, StreamVideo (commented out)
 */

import { StreamVideo } from "@stream-io/video-react-sdk";
import axios from "axios";
import { UserContextProvider } from "./components/auth/userContext";
import Routes from "./routes/Routes";

function App() {
    // Configure Axios defaults for API requests
    axios.defaults.baseURL = "/api"; // Base URL for all API calls
    axios.defaults.withCredentials = true; // Include cookies for authentication

    return (
        <UserContextProvider> {/* Provides user authentication state */}
            <Routes /> {/* Handles client-side routing */}
        </UserContextProvider>
    );
}

export default App;