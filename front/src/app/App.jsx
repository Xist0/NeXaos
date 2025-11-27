import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import ErrorBoundary from "../components/feedback/ErrorBoundary";
import AuthLayer from "../components/layout/AuthLayer";
import ToastStack from "../components/feedback/ToastStack";

const App = () => (
  <ErrorBoundary>
    <RouterProvider router={router} />
    <AuthLayer />
    <ToastStack />
  </ErrorBoundary>
);

export default App;

