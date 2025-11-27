import apiClient from "./apiClient";

export const fetchCart = async () => {
  const { data } = await apiClient.get("/cart");
  return data;
};

export const syncCart = async (items) => {
  const { data } = await apiClient.post("/cart/sync", { items });
  return data;
};

export const updateRemoteCart = async (items) => {
  const { data } = await apiClient.put("/cart", { items });
  return data;
};

export const clearRemoteCart = async () => {
  const { data } = await apiClient.delete("/cart");
  return data;
};

