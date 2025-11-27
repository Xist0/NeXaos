import apiClient from "./apiClient";

export const login = async (credentials) => {
  const { data } = await apiClient.post("/auth/login", credentials);
  return data;
};

export const register = async (payload) => {
  const { data } = await apiClient.post("/users", payload);
  return data;
};

export const fetchProfile = async () => {
  const { data } = await apiClient.get("/auth/me");
  return data.user;
};

