import apiClient from "./apiClient";

export const login = async (credentials) => {
    try {
        const { data } = await apiClient.post("/auth/login", credentials);
        return data;
    } catch (err) {
        console.error("Login API error:", err);
        throw err;
    }
};

export const register = async (payload) => {
    const { data } = await apiClient.post("/auth/register", payload);
    return data;
};

export const fetchProfile = async () => {
    const { data } = await apiClient.get("/auth/me");
    return data.user;
};
