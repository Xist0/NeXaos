import { useCallback, useState } from "react";
import apiClient from "../../../services/apiClient";

const parseRows = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const toApiPath = (apiBase) => {
  if (apiBase.startsWith("/api/")) return apiBase.slice(4);
  if (apiBase === "/api") return "/";
  return apiBase;
};

const omitNullish = (payload) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "number" && Number.isNaN(value)) return false;
      return true;
    })
  );

const formatApiError = (error) => {
  const data = error?.response?.data;
  const details = Array.isArray(data?.details)
    ? data.details.map((d) => d.message || d).join("; ")
    : null;
  return details || data?.message || error?.message || "Ошибка сохранения";
};

export const useAdminCrud = (apiBase) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const path = toApiPath(apiBase);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get(`${path}?limit=500`);
      setItems(parseRows(data));
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [path]);

  const createItem = useCallback(
    async (payload) => {
      try {
        const { data } = await apiClient.post(path, omitNullish(payload));
        return data;
      } catch (error) {
        throw new Error(formatApiError(error));
      }
    },
    [path]
  );

  const updateItem = useCallback(
    async (id, payload) => {
      try {
        const { data } = await apiClient.put(`${path}/${id}`, omitNullish(payload));
        return data;
      } catch (error) {
        throw new Error(formatApiError(error));
      }
    },
    [path]
  );

  const deleteItem = useCallback(
    async (id) => {
      await apiClient.delete(`${path}/${id}`);
    },
    [path]
  );

  return { items, loading, fetchItems, createItem, updateItem, deleteItem, setItems };
};
