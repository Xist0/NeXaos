const fallbackApi = "/api";
const envApi = import.meta.env.VITE_API_URL;

export const API_BASE_URL = import.meta.env.DEV ? fallbackApi : (envApi || fallbackApi);

export const ROLES = {
    ADMIN: "admin",
    MANAGER: "manager",
    USER: "user",
};
