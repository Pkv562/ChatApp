/**
 * @file logo.jsx
 * @description A simple React component that renders the application's logo.
 *              Displays an icon and text for branding the chat application.
 * @purpose Provides a reusable logo for consistent branding across the app.
 * @dependencies React, lucide-react
 */

import { MessageSquareDot } from "lucide-react";

export default function Logo() {
    return (
        <div className="p-4 text-sm text-gray-500 font-medium flex items-center gap-1 m-3">
            {/* Icon representing direct messaging */}
            <MessageSquareDot className="w-4" />
            {/* Branding text */}
            <span>Direct Messages</span>
        </div>
    );
}