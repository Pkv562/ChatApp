import { useContext, useState } from "react";
import { UserContext } from "./userContext";
import axios from "axios";
import Logo from "./logo";
import { useNavigate } from "react-router-dom";

export default function RegisterandLogInForm() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoginOrRegister, setIsLoginOrRegister] = useState("register");
    const { setUsername: setLoggedInUsername, setId } = useContext(UserContext);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    async function handleSubmit(ev) {
        ev.preventDefault();
        setError("");

        if (!username || !password) {
            setError("Username and password are required.");
            return;
        }

        const url = isLoginOrRegister === "register" ? "register" : "login";
        try {
            const { data } = await axios.post(`/api/${url}`, { username, password }, {
                withCredentials: true,
            });
            setLoggedInUsername(data.username);
            setId(data.id);
            navigate("/"); // Redirect to chat page after successful login/register
        } catch (err) {
            const errorMessage = err.response?.data?.error || err.response?.data || "Operation failed. Please try again.";
            setError(errorMessage);
        }
    }

    return (
        <div className="bg-white h-screen flex items-center justify-center">
            <div className="w-80 mx-auto text-center">
                <Logo />
                <form className="mt-8" onSubmit={handleSubmit}>
                    <input
                        value={username}
                        onChange={(ev) => setUsername(ev.target.value)}
                        type="text"
                        placeholder="Username"
                        className="block w-full rounded-lg p-4 mb-4 bg-gray-100 text-black border-2 border-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-400"
                    />
                    <input
                        value={password}
                        onChange={(ev) => setPassword(ev.target.value)}
                        type="password"
                        placeholder="Password"
                        className="block w-full rounded-lg p-4 mb-4 bg-gray-100 text-black border-2 border-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-400"
                    />
                    {error && (
                        <div className="text-red-600 text-sm mb-4">{error}</div>
                    )}
                    <button className="bg-blue-500 text-white w-full rounded-lg p-4 hover:bg-blue-600 transition-colors">
                        {isLoginOrRegister === "register" ? "Register" : "Login"}
                    </button>
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