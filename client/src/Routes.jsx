import { useContext } from "react"
import RegisterandLogInForm from "./RegisterandLogInForm";
import { UserContext } from "./userContext";
import Chat from "./Chat";

export default function Routes() {

    const {username, id} = useContext(UserContext);

    if(username) {
        return <Chat/>;
    }

    return (
        <RegisterandLogInForm/>
    )
}