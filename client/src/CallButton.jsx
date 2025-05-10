import { Video } from "lucide-react";

export default function CallButton({ onClick, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`p-2 rounded-lg transition-colors ${
                disabled
                    ? "text-zinc-600 cursor-not-allowed"
                    : "text-zinc-400 hover:bg-zinc-700 hover:text-white"
            }`}
            title="Start Video Call"
        >
            <Video className="w-5 h-5" />
        </button>
    );
}