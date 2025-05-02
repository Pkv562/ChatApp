import { useContext } from "react"
import RegisterandLogInForm from "../landingPages/RegisterandLogInForm";
import { UserContext } from "./userContext";
import Chat from "../chatPage/Chat";

export default function Routes() {

    const {username, id} = useContext(UserContext);

    if(username) {
        return <Chat/>;
    }

    return (
        <RegisterandLogInForm/>
    )
}