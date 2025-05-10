import { MessageSquareDot } from "lucide-react";

export default function Logo() {
    return (
        <div className="p-4 text-sm text-zinc-400 font-bold flex items-center gap-1 m-3">
            <MessageSquareDot className="w-4" />
            Direct Messages
        </div>
    )
}