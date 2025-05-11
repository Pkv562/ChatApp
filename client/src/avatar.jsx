import React from "react";

const Avatar = ({ userId, username, className, online }) => {
    const initial = username ? username.charAt(0).toUpperCase() : "?";
    const baseColor = "#005fff"; // Consistent blue background

    return (
        <div
            className={`flex items-center justify-center rounded-full ${className}`}
            style={{ backgroundColor: baseColor, width: "32px", height: "32px" }}
        >
            <span className="text-white text-lg">{initial}</span>
        </div>
    );
};

export default Avatar;