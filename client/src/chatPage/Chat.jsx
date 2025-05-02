import { useEffect, useRef, useState } from "react"
import Logo from "../widgets/logo";
import axios from 'axios';
import { uniqBy } from 'lodash'; 
import Contact from "../widgets/Contact";

export default function Chat() {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({}); 
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [newMessageText, setNewMessageText] = useState('');
    const [messages, setMessages] = useState([]);
    const [myUserId, setMyUserId] = useState(null);
    const [username, setUsername] = useState(null);
    const [loggedIn, setLoggedIn] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        // Step-by-step implementation:
        // 1. Make API request to get current user profile
        axios.get('/profile').then(res => {
          // 2. If successful, user is logged in - set user data
          setMyUserId(res.data.id);
          setUsername(res.data.username);
          setLoggedIn(true);
      
          // 3. Connect to WebSocket server
          connectToWs();
        }).catch(err => {
          // 4. If failed, user is not logged in
          setLoggedIn(false);
          console.log("Not logged in");
        });
      }, []);      

    function connectToWs() {
        // Step-by-step implementation:
        // 1. Create a new WebSocket connection to the server
        const socket = new WebSocket("ws://localhost:4000");
      
        // 2. Store the socket connection in state
        setWs(socket);
      
        // 3. Register event listener for incoming messages
        socket.addEventListener('message', handleMessage);
      
        // 4. Set up auto-reconnection if connection closes unexpectedly
        socket.addEventListener('close', () =>{
          if (loggedIn) {
            // 4.1. Wait 1 second before attempting to reconnect
            setTimeout(() => {
              console.log('Disconnected. Trying to reconnect');
              connectToWs()
            }, 1000)
          }
        });
      
        // 5. Return cleanup function for React useEffect
        return () => {
          // 5.1. Remove event listeners when component unmounts
          socket.removeEventListener('message', handleMessage);
          socket.close();
        };
      }

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    function scrollToBottom() {
        // Step-by-step implementation:
        // 1. Access the ref to the end of messages div and scroll it into view
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
      

    function showOnlinePeople(peopleArray) {
        // Step-by-step implementation:
        // 1. Initialize an empty object to store online users
        const people = {};
      
        // 2. Loop through each person in the array
        peopleArray.forEach(({userId, username}) => {
          // 2.1. Only process valid entries (with both userId and username)
          if (userId && username) {
            // 2.2. Create a key-value pair with userId as key and username as value
            people[userId] = username;
          }
        });
      
        // 3. Update the state with the formatted online people object
        setOnlinePeople(people);
      }      

    function handleMessage(ev) {
        // Step-by-step implementation:
        // 1. Parse the JSON data from the WebSocket event
        const messageData = JSON.parse(ev.data);
      
        // 2. If the message contains online user information
        if('online' in messageData) {
          // 2.1. Update the list of online people
          showOnlinePeople(messageData.online);
      
          // 2.2. If server sent user's own ID, save it
          if (messageData.you) {
            setMyUserId(messageData.you);
          }
        }
        // 3. If the message is a chat message (contains sender info)
        else if(messageData.sender) {
          // 3.1. Add the new message to the messages array, ensuring no duplicates
          setMessages(prev => uniqBy([...prev, {
            text: messageData.text || '',
            sender: messageData.sender,
            recipient: messageData.recipient,
            _id: messageData._id,
            file: messageData.file || null
          }], '_id'));
      
          // 3.2. Scroll to bottom if message is relevant to current chat
          if (messageData.sender === selectedUserId || messageData.recipient === selectedUserId) {
            scrollToBottom();
          }
        }
      }
      
      function fetchMessages(userId) {
        // Step-by-step implementation:
        // 1. Check if userId is provided and user is logged in
        if(userId && loggedIn) {
          // 2. Make API request to get messages for the selected user
          axios.get('/messages/'+userId).then(res => {
            // 3. Update messages state, merging with existing messages and removing duplicates
            setMessages(prev => {
              return uniqBy([...prev, ...res.data], '_id');
            });
          });
        }
      }

      function sendMessage(ev, file = null) {
        // Step-by-step implementation:
        // 1. Prevent default form submission behavior if event exists
        if(ev) ev.preventDefault();
      
        // 2. Validate that we have message content or file and a selected recipient
        if ((!newMessageText.trim() && !file) || !selectedUserId) return;
      
        // 3. Create an optimistic message object to instantly display in UI
        const optimisticMsg = {
          text: newMessageText,
          sender: myUserId,
          recipient: selectedUserId,
          _id: Date.now(), // Temporary ID until server confirms
          file: file ? file.name : null,
        };
      
        // 4. Add optimistic message to messages state, avoiding duplicates
        setMessages(prev => uniqBy([...prev, optimisticMsg], '_id'));
      
        // 5. Clear the message input field
        setNewMessageText('');
      
        // 6. Send the message data to WebSocket server
        ws.send(JSON.stringify({
          recipient: selectedUserId,
          text: newMessageText,
          file,
        }));
      }
      

    useEffect(() => {
        if (selectedUserId) {
            fetchMessages(selectedUserId);
        }
    }, [selectedUserId, loggedIn]);

    useEffect(() => {
        if (loggedIn) {
          axios.get('/people').then(res => {
            // Step-by-step implementation:
            // 1. Filter out the current user
            // 2. Filter out users who are already online
            const offlinePeopleArray = res.data
              .filter(p => p._id !== myUserId)
              .filter(p => !Object.keys(onlinePeople).includes(p._id));
      
            // 3. Convert array to object with user IDs as keys
            const offlinePeople = {};
            offlinePeopleArray.forEach(p => {
              offlinePeople[p._id] = p;
            });
      
            // 4. Update offline people state
            setOfflinePeople(offlinePeople);
          })
        }
      }, [onlinePeople, myUserId, loggedIn])      

    function logout() {
        // Step-by-step implementation:
        // 1. Make API request to the server to logout
        axios.post('/logout').then(() => {
          // 2. If WebSocket connection exists, close it
          if (ws) {
            ws.close();
          }
      
          // 3. Reset all user-related state variables
          setMyUserId(null);
          setUsername(null);
          setMessages([]);
          setSelectedUserId(null);
          setOnlinePeople({});
          setOfflinePeople({});
      
          // 4. Set loggedIn status to false
          setLoggedIn(false);
        }).catch(err => {
          // 5. Log error if logout fails
          console.error("Logout failed:", err);
        });
      }      

    function sendFile(ev) {
        // Step-by-step implementation:
        // 1. Extract the selected file from the input event
        const file = ev.target.files[0];
      
        // 2. Return early if no file is selected
        if (!file) return;
      
        // 3. Create a FileReader to process the file
        const reader = new FileReader();
      
        // 4. Set up callback for when file is loaded
        reader.onload = () => {
          // 4.1. Create file data object with metadata and content
          const fileData = {
            name: file.name,
            data: reader.result, // Base64 encoded file data
            type: file.type,
            size: file.size
          };
      
          // 4.2. Send the file data via the sendMessage function
          sendMessage(null, fileData);
        };
      
        // 5. Start reading the file as Data URL (base64)
        reader.readAsDataURL(file);
      }      

    const filteredMessages = messages.filter(m => 
        (m.sender === selectedUserId || m.recipient === selectedUserId) &&
        (m.sender === myUserId || m.recipient === myUserId)
    );
    
    const messagesWithoutDupes = uniqBy(filteredMessages, '_id');

    if (!loggedIn) {
        return (
            <div className="flex h-screen items-center justify-center bg-blue-50">
                <div className="text-center">
                    <Logo />
                    <h1 className="text-xl mb-4">You are logged out</h1>
                    <p className="mb-4">Please login to continue chatting</p>
                    <a href="/login" className="bg-blue-500 text-white py-2 px-4 rounded">
                        Go to Login
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen">
            <div className="bg-white-100 w-1/3 overflow-y-auto flex flex-col">
            <div className="flex-grow">
            <Logo />
                {Object.keys(onlinePeople).map(userId => (
                    <Contact 
                    key={userId}
                    id={userId} 
                    username={onlinePeople[userId]} 
                    online={true}
                    onClick={() => setSelectedUserId(userId)}
                    selected={userId === selectedUserId} 
                    />
                ))}
                {Object.keys(offlinePeople).map(userId => (
                    <Contact 
                    key={userId}
                    id={userId} 
                    username={offlinePeople[userId].username}
                    online={false}
                    onClick={() => setSelectedUserId(userId)}
                    selected={userId === selectedUserId} 
                    />
                ))} 
            </div>
            <div className="p-2 text-center flex items-center justify-center">
                <span className="mr-2 text-sm text-grey-600 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-1">
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                </svg>
                    {username}</span>
                <button 
                onClick={logout}
                className="text-sm bg-blue-100 border rounded-sm py-1 px-2 text-gray-500">LogOut</button>
            </div>
            </div>
            <div className="flex flex-col bg-blue-50 w-2/3 p-2">
                {!selectedUserId && (
                    <div className="flex-grow flex items-center justify-center">
                        <div className="text-gray-300">&larr; Select a person from the sidebar</div>
                    </div>
                )}
                
                {!!selectedUserId && (
                    <>
                        <div className="flex-grow overflow-y-auto mb-2">
                            <div className="h-full">
                            {messagesWithoutDupes.map((message, i) => (
                                    <div key={i} className={(message.sender === myUserId) ? 'text-right' : 'text-left'}>
                                        <div className={
                                            "text-left inline-block p-2 my-2 rounded-md text-sm " + 
                                            (message.sender === myUserId ? 'bg-blue-500 text-white' : 'bg-white text-gray-500')
                                        }>
                                            {message.text}
                                            {message.file && (
                                                <div className="flex items-center gap-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                    <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 0 1 5.91 15.66l7.81-7.81a.75.75 0 0 1 1.061 1.06l-7.81 7.81a.75.75 0 0 0 1.054 1.068L18.97 6.84a2.25 2.25 0 0 0 0-3.182Z" clipRule="evenodd" />
                                                    </svg>
                                                    <a target="_blank" className="underline" href={axios.defaults.baseURL + '/uploads/'+message.file}>
                                                        {message.file}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                        
                        <form className="flex gap-2" onSubmit={sendMessage}>
                            <input 
                                type="text" 
                                value={newMessageText}
                                onChange={ev => setNewMessageText(ev.target.value)}
                                placeholder="Type your message" 
                                className="bg-white flex-grow border rounded-sm p-2"
                            />
                            <label type="button" className="bg-blue-300 p-2 text-gray-500 rounded-sm border border border-blue-200 cursor-pointer">
                            <input type="file" className="hidden" onChange={sendFile}/>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                            <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 0 1 5.91 15.66l7.81-7.81a.75.75 0 0 1 1.061 1.06l-7.81 7.81a.75.75 0 0 0 1.054 1.068L18.97 6.84a2.25 2.25 0 0 0 0-3.182Z" clipRule="evenodd" />
                            </svg>
                            </label>
                            <button 
                                type="submit" 
                                className="bg-blue-500 p-2 text-white rounded-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                                </svg>
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}