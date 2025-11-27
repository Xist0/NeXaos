import AuthModal from "../modals/AuthModal";
import useAuth from "../../hooks/useAuth";

const AuthLayer = () => {
    const { authModalOpen, closeAuthModal } = useAuth();

    if (!authModalOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur">
            <div className="shop-container h-full flex items-center justify-center">
                <div className="glass-card w-full max-w-md p-8 relative">
                    <button
                        aria-label="Закрыть"
                        className="absolute right-4 top-4 text-night-400 hover:text-night-700"
                        onClick={closeAuthModal}
                    >
                        ✕
                    </button>
                    <AuthModal />
                </div>
            </div>
        </div>
    );
};

export default AuthLayer;

