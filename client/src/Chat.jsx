import { useEffect, useRef, useState } from "react"
import Avatar from "./avatar";
import Logo from "./logo";

export default function Chat() {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [newMessageText, setNewMessageText] = useState('');
    const [messages, setMessages] = useState([]);
    const [myUserId, setMyUserId] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const socket = new WebSocket("ws://localhost:4000");
        setWs(socket);
      
        socket.addEventListener('message', handleMessage);
      
        return () => {
          socket.removeEventListener('message', handleMessage);
          socket.close(); 
        };
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    function scrollToBottom() {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    function showOnlinePeople(peopleArray) {
        const people = {};
        peopleArray.forEach(({userId, username}) => {
            if (userId && username) { 
                people[userId] = username;
            }
        });
        setOnlinePeople(people);
    }

    function handleMessage(ev) {
        const messageData = JSON.parse(ev.data);
        if('online' in messageData) {
            showOnlinePeople(messageData.online);
            if (messageData.you) {
                setMyUserId(messageData.you);  
            }
        } else {
            setMessages(prev => ([...prev, {
                text: messageData.text,
                sender: messageData.sender,
                recipient: myUserId
            }]));
        }
    }

    function sendMessage(ev) {
        ev.preventDefault();
        if (!newMessageText.trim() || !selectedUserId) return;
        
        ws.send(JSON.stringify({
            recipient: selectedUserId,
            text: newMessageText,
        }));
        
        setMessages(prev => ([...prev, {
            text: newMessageText, 
            sender: myUserId,
            recipient: selectedUserId,
            id: Date.now(),
        }]));
        
        setNewMessageText('');
    }

    return (
        <div className="flex h-screen">
            <div className="bg-white-100 w-1/3 overflow-y-auto">
                <Logo />
                {Object.keys(onlinePeople).map(userId => (
                    <div 
                        onClick={() => setSelectedUserId(userId)} 
                        key={userId} 
                        className={"border-b border-gray-100 flex items-center gap-2 cursor-pointer " + (userId === selectedUserId ? 'bg-blue-50' : '')}
                    >
                        {userId === selectedUserId && (
                            <div className="w-1 bg-blue-500 h-12 rounded-r-md"></div>
                        )}
                        <div className="flex gap-2 py-2 pl-4 items-center">
                            <Avatar username={onlinePeople[userId]} userId={userId} />
                            <span className="text-gray-800">{onlinePeople[userId]}</span>
                        </div>
                    </div>
                ))}
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
                                {messages.filter(m => 
                                    m.sender === selectedUserId || 
                                    m.recipient === selectedUserId
                                ).map((message, i) => (
                                    <div key={i} className={(message.sender === myUserId) ? 'text-right' : 'text-left'}>
                                        <div className={
                                            "text-left inline-block p-2 my-2 rounded-md text-sm " + 
                                            (message.sender === myUserId ? 'bg-blue-500 text-white' : 'bg-white text-gray-500')
                                        }>
                                            {message.text}
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