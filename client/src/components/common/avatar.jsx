/**
 * @file avatar.jsx
 * @description A React component that renders a user's avatar based on their username.
 *              Displays the first letter of the username with an optional online status indicator.
 * @purpose Provides a visual representation of users in the chat app, with online/offline status.
 * @dependencies React
 */

import React from "react";

/**
 * @function Avatar
 * @description Renders a circular avatar with the user's initial and an optional online indicator.
 * @param {Object} props - Component props
 * @param {string} props.userId - Unique ID of the user (not used in rendering but included for context)
 * @param {string} props.username - Username to derive the initial
 * @param {string} props.className - Additional CSS classes for styling
 * @param {boolean} props.online - Indicates if the user is online
 * @returns {JSX.Element} The avatar component
 */
const Avatar = ({ userId, username, className, online }) => {
    // Derive the initial from the username (or "?" if username is missing)
    const initial = username ? username.charAt(0).toUpperCase() : "?";
    // Consistent blue background color for avatars
    const baseColor = "#005fff";

    return (
        <div
            className={`relative flex items-center justify-center rounded-full ${className}`}
            style={{ backgroundColor: baseColor, width: "32px", height: "32px" }}
        >
            {/* Display the user's initial */}
            <span className="text-white text-lg">{initial}</span>
            {/* Show online status if applicable */}
            {online && (
                <span
                    className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"
                    style={{ transform: "translate(25%, 25%)" }} // Slightly offset for better positioning
                />
            )}
        </div>
    );
};

export default Avatar;