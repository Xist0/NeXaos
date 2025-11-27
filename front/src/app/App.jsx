import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import ErrorBoundary from "../components/feedback/ErrorBoundary";
import AuthGate from "../components/layout/AuthGate";
import ToastStack from "../components/feedback/ToastStack";

const App = () => (
  <ErrorBoundary>
    <AuthGate>
      <RouterProvider router={router} />
      <ToastStack />
    </AuthGate>
  </ErrorBoundary>
);

export default App;

