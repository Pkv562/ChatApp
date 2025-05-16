/**
 * @file RegisterandLogInForm.jsx
 * @description A React component that handles user registration and login functionality.
 *              Renders a form allowing użytkowników to either register a new account or log in to an existing one.
 *              Integrates with the UserContext to manage user state and uses Axios for API requests.
 * @purpose Provides a unified UI for authentication, enabling users to access the chat application.
 * @dependencies React, Axios, React Router, UserContext, Logo component
 */

import { useContext, useState } from "react";
import { UserContext } from "./userContext";
import axios from "axios";
import Logo from "../common/logo";
import { useNavigate } from "react-router-dom";

export default function RegisterandLogInForm() {
    // State to store form inputs
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    // Toggles between "register" and "login" modes
    const [isLoginOrRegister, setIsLoginOrRegister] = useState("register");
    // Access UserContext to update logged-in user information
    const { setUsername: setLoggedInUsername, setId } = useContext(UserContext);
    // State to display error messages
    const [error, setError] = useState("");
    // Navigation hook for redirecting after successful authentication
    const navigate = useNavigate();

    /**
     * @function handleSubmit
     * @description Handles form submission for both registration and login.
     *              Validates inputs, sends API requests, and updates user context on success.
     * @param {Event} ev - The form submission event
     * @returns {void}
     */
    async function handleSubmit(ev) {
        ev.preventDefault(); // Prevent default form submission behavior
        setError(""); // Clear any previous error messages

        // Step 1: Validate form inputs
        if (!username || !password) {
            setError("Username and password are required.");
            return;
        }

        // Step 2: Determine API endpoint based on form mode
        const url = isLoginOrRegister === "register" ? "register" : "login";

        // Step 3: Send API request to authenticate or register
        try {
            const { data } = await axios.post(`/api/${url}`, { username, password }, {
                withCredentials: true, // Include cookies for session management
            });

            // Step 4: Update UserContext with authenticated user data
            setLoggedInUsername(data.username);
            setId(data.id);

            // Step 5: Redirect to the chat page
            navigate("/"); // Why: Successful authentication grants access to the main app
        } catch (err) {
            // Step 6: Handle errors from the API
            const errorMessage = err.response?.data?.error || err.response?.data || "Operation failed. Please try again.";
            setError(errorMessage); // Display error to the user
        }
    }

    return (
        <div className="bg-white h-screen flex items-center justify-center">
            {/* Centered container for the form */}
            <div className="w-80 mx-auto text-center">
                {/* Display application logo */}
                <Logo />
                {/* Authentication form */}
                <form className="mt-8" onSubmit={handleSubmit}>
                    {/* Username input field */}
                    <input
                        value={username}
                        onChange={(ev) => setUsername(ev.target.value)}
                        type="text"
                        placeholder="Username"
                        className="block w-full rounded-lg p-4 mb-4 bg-gray-100 text-black border-2 border-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-400"
                    />
                    {/* Password input field */}
                    <input
                        value={password}
                        onChange={(ev) => setPassword(ev.target.value)}
                        type="password"
                        placeholder="Password"
                        className="block w-full rounded-lg p-4 mb-4 bg-gray-100 text-black border-2 border-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-400"
                    />
                    {/* Display error message if present */}
                    {error && (
                        <div className="text-red-600 text-sm mb-4">{error}</div>
                    )}
                    {/* Submit button with dynamic label */}
                    <button className="bg-blue-500 text-white w-full rounded-lg p-4 hover:bg-blue-600 transition-colors">
                        {isLoginOrRegister === "register" ? "Register" : "Login"}
                    </button>
                    {/* Toggle between login and register modes */}
                    <div className="text-gray-700 mt-4">
                        {isLoginOrRegister === "register" ? "Already a member?" : "Need an account?"}
                        <button
                            type="button"
                            onClick={() => setIsLoginOrRegister(isLoginOrRegister === "register" ? "login" : "register")}
                            className="text-blue-600 hover:text-blue-700 underline ml-2"
                        >
                            {isLoginOrRegister === "register" ? "Login here" : "Register here"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}