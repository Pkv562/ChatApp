/**
 * @file Contact.jsx
 * @description A React component that renders a contact entry in the chat app's contact list.
 *              Displays the user's avatar, username, and online status, with click handling.
 * @purpose Represents an individual contact for user selection in the chat interface.
 * @dependencies React, Avatar component
 */

import Avatar from "../common/avatar";
import React from "react";

/**
 * @function Contact
 * @description Renders a clickable contact entry with avatar, username, and online status.
 * @param {Object} props - Component props
 * @param {string} props.id - Unique ID of the contact
 * @param {string} props.username - Username of the contact
 * @param {boolean} props.online - Indicates if the contact is online
 * @param {Function} props.onClick - Handler for when the contact is clicked
 * @param {boolean} props.selected - Indicates if the contact is currently selected
 * @returns {JSX.Element} The contact component
 */
const Contact = ({ id, username, online, onClick, selected }) => {
    return (
        <div
            onClick={onClick}
            className={`flex items-center p-2 cursor-pointer hover:bg-gray-100 ${
                selected ? "bg-gray-200" : ""
            }`}
        >
            {/* User avatar with online status */}
            <Avatar userId={id} username={username} online={online} className="mr-3" />
            {/* Username display */}
            <span className="text-black">{username}</span>
        </div>
    );
};

export default Contact;