import { useEffect } from "react";
import useAuth from "../../hooks/useAuth";
import AuthModal from "../modals/AuthModal";

const AuthGate = ({ children }) => {
  const { token, authModalOpen, initializeFromSession, requireAuth } = useAuth();

  useEffect(() => {
    initializeFromSession();
  }, [initializeFromSession]);

  useEffect(() => {
    if (!token) {
      requireAuth();
    }
  }, [token, requireAuth]);

  return (
    <>
      {children}
      {!token && authModalOpen && (
        <div className="auth-backdrop">
          <div className="glass-panel auth-card">
            <AuthModal />
          </div>
        </div>
      )}
    </>
  );
};

export default AuthGate;

