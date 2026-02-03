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

const redirectIfOnProtectedRoute = () => {
  if (typeof window === "undefined") return;
  window.location.replace("/");
};

const loadUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};

const initialUser = loadUser();

const useAuthStore = create((set, get) => ({
  accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
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

  refreshToken: async () => {
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
    } catch (error) {
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
    });
    redirectIfOnProtectedRoute();
  },

  get token() {
    return get().accessToken;
  },
}));

export default useAuthStore;

