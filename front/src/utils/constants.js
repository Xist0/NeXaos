const fallbackApi = import.meta.env.DEV ? "/api" : "http://localhost:5000/api";
export const API_BASE_URL = import.meta.env.VITE_API_URL || fallbackApi;

export const ROLES = {
    ADMIN: "admin",
    MANAGER: "manager",
    USER: "user",
};
