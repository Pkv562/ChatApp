/**
 * @file CallButton.jsx
 * @description A React component that renders a button to initiate a video call.
 *              Displays a video icon and handles disabled states.
 * @purpose Provides a reusable UI element for starting video calls in the chat app.
 * @dependencies React, lucide-react
 */

import { Video } from "lucide-react";

/**
 * @function CallButton
 * @description Renders a button with a video icon for starting a video call.
 * @param {Object} props - Component props
 * @param {Function} props.onClick - Handler for button click events
 * @param {boolean} props.disabled - Disables the button when true
 * @returns {JSX.Element} The call button component
 */
export default function CallButton({ onClick, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`p-2 rounded-lg transition-colors ${
                disabled
                    ? "text-zinc-600 cursor-not-allowed"
                    : "text-zinc-400 hover:bg-zinc-700 hover:text-white"
            }`}
            title="Start Video Call" // Accessibility tooltip
        >
            {/* Video call icon */}
            <Video className="w-5 h-5" />
        </button>
    );
}