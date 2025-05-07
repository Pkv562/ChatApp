import Avatar from "./avatar";

export default function Contact({ id, username, onClick, selected, online }) {
  return (
    <div
      onClick={() => onClick(id)}
      key={id}
      className={`cursor-pointer m-2 rounded-lg transition-colors ${
        selected ? "bg-zinc-800" : "hover:bg-zinc-700"
      }`}
    >
      <div className="flex items-center gap-2 py-2 px-4">
        <Avatar online={online} username={username} userId={id} />
        <span className="text-zinc-200">{username}</span>
      </div>
    </div>
  );
}
