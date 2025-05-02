export default function Avatar({userId, username, online}) {
    const colors = ['bg-red-200', 'bg-green-200', 
                    'bg-purple-200', 'bg-blue-200', 
                    'bg-yellow-200', 'bg-teal-200']

    const usernameDisplay = username && typeof username === 'string' ? username[0] : '?';

    let colorIndex = 0;
    if (userId) {
        try {
            const userIdBase10 = parseInt(userId, 16);
            colorIndex = userIdBase10 % colors.length;
        } catch (e) {
            colorIndex = 0;
        }
    }
    
    const color = colors[colorIndex];
    
    return (
        <div className={"w-8 h-8 relative rounded-full flex items-center " + color}>
            <div className="text-center w-full opacity-70">{usernameDisplay}</div>
            {online && (
                 <div className="absolute w-3 h-3 bg-green-400 bottom-0 right-0 rounded-full bottom-0 right-0 border border-white"></div> 
            )}
            {!online && (
                 <div className="absolute w-3 h-3 bg-gray-400 bottom-0 right-0 rounded-full bottom-0 right-0 border border-white"></div> 
            )}
        </div>
    )
}