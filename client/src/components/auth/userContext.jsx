/**
 * @file userContext.jsx
 * @description Defines a React Context for managing user authentication state across the application.
 *              Fetches and stores the logged-in user's profile data (username and ID) on app load.
 * @purpose Centralizes user state management, making it accessible to all components via context.
 * @dependencies React, Axios
 */

import { createContext, useState, useEffect } from "react";
import axios from "axios";

// Create a context for user data
export const UserContext = createContext({});

/**
 * @function UserContextProvider
 * @description A provider component that wraps the app to provide user context.
 *              Fetches user profile data on mount and manages loading state.
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components that consume the context
 * @returns {JSX.Element} The context provider wrapping child components
 */
export function UserContextProvider({ children }) {
    // State for user data
    const [username, setUsername] = useState(null); // Stores the logged-in username
    const [id, setId] = useState(null); // Stores the user's unique ID
    const [loading, setLoading] = useState(true); // Tracks profile fetch status

    /**
     * @effect Fetches user profile data when the component mounts.
     * @description Uses Axios to make a GET request to the /api/profile endpoint.
     *              Updates context with user data or clears it on failure.
     */
    useEffect(() => {
        // Step 1: Initiate profile fetch
        axios
            .get("/api/profile", { withCredentials: true }) // Include cookies for authentication
            .then((response) => {
                // Step 2: Update state with fetched data
                setUsername(response.data.username);
                setId(response.data.id);
                console.log("Profile fetched successfully:", response.data); // Debugging
            })
            .catch((err) => {
                // Step 3: Handle fetch errors (e.g., unauthenticated user)
                console.error("Profile fetch error:", err.response?.status, err.message);
                setUsername(null);
                setId(null); // Clear user data if fetch fails
            })
            .finally(() => {
                // Step 4: Mark loading as complete
                setLoading(false); // Why: Allows components to render based on auth status
            });
    }, []); // Empty dependency array ensures this runs only once on mount

    // Provide user data and setters to child components
    return (
        <UserContext.Provider
            value={{
                username,
                setUsername,
                id,
                setId,
                loading,
            }}
        >
            {children}
        </UserContext.Provider>
    );
}