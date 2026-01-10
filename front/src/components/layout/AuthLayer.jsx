import AuthModal from "../modals/AuthModal";
import useAuth from "../../hooks/useAuth";

const AuthLayer = () => {
    const { authModalOpen, closeAuthModal } = useAuth();

    if (!authModalOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div 
                className="fixed inset-0 sm:inset-auto sm:relative w-full h-full sm:w-auto sm:h-auto bg-white sm:bg-transparent"
            >
                <div className="w-full max-w-md mx-auto h-full flex flex-col justify-center p-4 sm:p-0">
                    <div className="bg-white sm:glass-card rounded-xl shadow-lg w-full p-6 sm:p-8 relative">
                        <button
                            aria-label="Закрыть"
                            className="absolute right-4 top-4 text-night-400 hover:text-night-700 transition-colors"
                            onClick={closeAuthModal}
                        >
                            ✕
                        </button>
                        <AuthModal />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthLayer;
