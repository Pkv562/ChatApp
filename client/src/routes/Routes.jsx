import { useContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RegisterandLogInForm from "../components/auth/RegisterandLogInForm";
import { UserContext } from "../components/auth/userContext";
import Chat from "../components/chat/Chat";
import Call from "../components/chat/Call";

export default function RoutesComponent() {
    const { username, loading } = useContext(UserContext);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center text-gray-700">Loading...</div>
            </div>
        );
    }

    return (
        <div className="font-inter">
            <Routes>
                {username ? (
                    <>
                        <Route path="/" element={<Navigate to="/chat" replace />} />
                        <Route path="/chat" element={<Chat />} />
                        <Route path="/call/:callId" element={<Call />} />
                        <Route path="*" element={<Navigate to="/chat" replace />} />
                    </>
                ) : (
                    <>
                        <Route path="/" element={<RegisterandLogInForm />} />
                        <Route path="/login" element={<RegisterandLogInForm />} />
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </>
                )}
            </Routes>
        </div>
    );
}