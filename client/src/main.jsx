/**
 * @file main.jsx
 * @description The entry point for the React application.
 *              Sets up the React root, routing, and renders the main App component.
 * @purpose Initializes the application with necessary providers and strict mode.
 * @dependencies React, React DOM, React Router, App component, global CSS
 */

import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./assets/styles/index.css";

// Create the React root and render the application
createRoot(document.getElementById("root")).render(
    <StrictMode> {/* Enables additional checks for development */}
        <BrowserRouter> {/* Provides routing capabilities */}
            <App /> {/* Main application component */}
        </BrowserRouter>
    </StrictMode>
);