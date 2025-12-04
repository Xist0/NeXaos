import apiClient from "./apiClient";

export const login = async (credentials) => {
  const { data } = await apiClient.post("/auth/login", credentials);
  return data;
};

export const register = async (payload) => {
  const { data } = await apiClient.post("/auth/register", payload);
  return data;
};

export const refreshAccessToken = async (refreshToken) => {
  const { data } = await apiClient.post("/auth/refresh", { refreshToken });
  return data;
};

export const fetchProfile = async () => {
  const { data } = await apiClient.get("/auth/me");
  return data.user;
};
