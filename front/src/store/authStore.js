import { create } from "zustand";
import { login as loginRequest, register as registerRequest, refreshAccessToken } from "../services/auth.service";
import { ROLES } from "../utils/constants";

const ACCESS_TOKEN_KEY = "nexaos_access_token";
const USER_KEY = "nexaos_user";
const CACHE_BUSTER_KEY = "nexaos_cache_buster";

const clearPersistedGetCache = () => {
  try {
    const prefix = "nexaos_get_cache:";
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
};

const loadUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};

/** Проверить, истёк ли JWT-токен. */
const isJwtExpired = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp) return true;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
};

/** Очистить stale-данные из localStorage если токен истёк. */
const cleanStaleAuth = () => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token && isJwtExpired(token)) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return true;
  }
  return false;
};

cleanStaleAuth();

const initialAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
const initialUser = loadUser();

const useAuthStore = create((set, get) => ({
  accessToken: initialAccessToken,
  refreshToken: null,
  user: initialUser,
  role: initialUser?.roleName || ROLES.USER,
  pending: false,
  error: null,
  authModalOpen: false,
  redirectAfterAuth: "/",

  requireAuth: (redirectAfterAuth = "/") => {
    set({ authModalOpen: true, redirectAfterAuth });
  },

  closeAuthModal: () => set({ authModalOpen: false }),

  login: async (credentials) => {
    set({ pending: true, error: null });
    try {
      const data = await loginRequest(credentials);
      set({
        accessToken: data.accessToken,
        refreshToken: null,
        user: data.user,
        role: data.user?.roleName || ROLES.USER,
        authModalOpen: false,
      });
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(CACHE_BUSTER_KEY, String(Date.now()));
    } catch (error) {
      set({
        error: error.response?.data?.message || "Не удалось войти",
        pending: false,
      });
      throw error;
    } finally {
      set({ pending: false });
    }
  },

  register: async (payload) => {
    set({ pending: true, error: null });
    try {
      await registerRequest(payload);
      await get().login({ email: payload.email, password: payload.password });
    } catch (error) {
      set({
        error: error.response?.data?.message || "Не удалось зарегистрироваться",
      });
      throw error;
    } finally {
      set({ pending: false });
    }
  },

  refreshAccess: async () => {
    try {
      const data = await refreshAccessToken();
      set({
        accessToken: data.accessToken,
        user: data.user,
        role: data.user?.roleName || ROLES.USER,
      });
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(CACHE_BUSTER_KEY, String(Date.now()));
      return data.accessToken;
    } catch (_error) {
      get().logout();
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.setItem(CACHE_BUSTER_KEY, String(Date.now()));
    clearPersistedGetCache();
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      role: ROLES.USER,
      authModalOpen: false,
      redirectAfterAuth: "/",
    });
    try {
      fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    } catch (_e) {}
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.href = "/";
    }
  },

  get token() {
    return get().accessToken;
  },
}));

export default useAuthStore;

