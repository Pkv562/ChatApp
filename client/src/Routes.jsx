import { useContext } from "react";
import { Routes, Route } from "react-router-dom";
import RegisterandLogInForm from "./RegisterandLogInForm";
import { UserContext } from "./userContext";
import Chat from "./Chat";
import Call from "./Call";

export default function RoutesComponent() {
    const { username } = useContext(UserContext);

    return (
        <Routes>
            {username ? (
                <>
                    <Route path="/" element={<Chat />} />
                    <Route path="/call/:callId" element={<Call />} />
                </>
            ) : (
                <>
                    <Route path="/" element={<RegisterandLogInForm />} />
                    <Route path="/login" element={<RegisterandLogInForm />} />
                </>
            )}
        </Routes>
    );
}