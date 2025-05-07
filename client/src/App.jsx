import { StreamVideo } from "@stream-io/video-react-sdk";
import RegisterandLogInForm from "./RegisterandLogInForm";
import axios from "axios";
import { UserContextProvider } from "./userContext";
import Routes from "./Routes";

function App() {
    axios.defaults.baseURL = "/api";
    axios.defaults.withCredentials = true;

    return (
        <UserContextProvider>
            <Routes />
        </UserContextProvider>
    );
}

export default App;