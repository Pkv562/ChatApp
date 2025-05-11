// Contact.jsx
import React from "react";
import Avatar from "./Avatar";

const Contact = ({ id, username, online, onClick, selected }) => {
    return (
        <div
            onClick={onClick}
            className={`flex items-center p-2 cursor-pointer hover:bg-gray-100 ${selected ? "bg-gray-200" : ""}`}
        >
            <Avatar userId={id} username={username} online={online} className="mr-3" />
            <span className="text-black">{username}</span>
        </div>
    );
};

export default Contact;