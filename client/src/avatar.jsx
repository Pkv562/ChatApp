import { Zap } from 'lucide-react';

export default function Avatar({userId, username, online}) {
    const colors = ['bg-red-500', 'bg-green-500', 
                    'bg-purple-500', 'bg-pink-500', 
                    'bg-yellow-500', 'bg-teal-500']

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
        <div className={"w-10 h-10 relative rounded-full flex items-center " + color}>
            <div className="flex items-center justify-center w-full opacity-100 text-white"> <Zap /> </div>
            {online && (
                <div className="absolute w-3 h-3 bg-lime-400 bottom-0 right-0 rounded-full bottom-0 right-0"></div> 
            )}
            {!online && (
                <div className="absolute w-3 h-3 border-2 border-zinc-600 bg-zinc-800 bottom-0 right-0 rounded-full ring-2 ring-zinc-800"></div>
            )}
        </div>
    )
}