import { createContext, useState, useEffect } from "react";
import axios from "axios";

export const UserContext = createContext({});

export function UserContextProvider({ children }) {
  const [username, setUsername] = useState(null);
  const [id, setId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/profile')
      .then(response => {
        setUsername(response.data.username);
        setId(response.data.id);
      })
      .catch(err => {
        console.log("Not logged in or session expired");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <UserContext.Provider value={{ 
      username, 
      setUsername, 
      id, 
      setId, 
      loading 
    }}>
      {children}
    </UserContext.Provider>
  );
}