import { useContext, useState } from "react";
import {UserContext} from "./userContext";
import axios from "axios";

export default function RegisterandLogInForm() {

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoginOrRegister, setIsLoginOrRegister] = useState('register');
    const {setUsername:setLoggedInUsername, setId} = useContext(UserContext);
    const [error, setError] = useState('');

    async function handleSubmit(ev) {
      ev.preventDefault();
      setError(''); 
      const url = isLoginOrRegister === 'register' ? 'register' : 'login';
      try {
        const { data } = await axios.post(url, { username, password });
        console.log("Registered:", data);
        setLoggedInUsername(username);
        setId(data.id);
      } catch (err) {
        console.error("Registration failed:", err);
        setError(err.response?.data || 'Registration failed. Please try again.');
      }
    }
      

    return (
        <div className="bg-blue-50 h-screen flex items-center">
            <form className="w-64 mx-auto mb-12" onSubmit={handleSubmit}>
                <input value={username} 
                    onChange={ev => setUsername(ev.target.value)} 
                    type="text" placeholder="username" 
                    className="block w-full rounded-sm p-2 mb-2 border"/>
                <input value={password} 
                    onChange={ev => setPassword(ev.target.value)} 
                    type="password" placeholder="password" 
                    className="block w-full rounded-sm p-2 mb-2 border"/>
                <button className="bg-blue-500 text-white block w-full rounded-sm p-2">
                  {isLoginOrRegister === 'register' ? 'Register' : 'Login'}
                </button>
                <div className="text-center mt-2">
                  Already a member?
                  {isLoginOrRegister === 'register' && (
                    <button onClick={() => setIsLoginOrRegister('login')}>
                    Login here
                  </button>
                  )}
                  {isLoginOrRegister === 'login' && (
                    <button onClick={() => setIsLoginOrRegister('register')}>
                    Register here
                  </button>
                  )}
                </div>
            </form>
        </div>
    );
}