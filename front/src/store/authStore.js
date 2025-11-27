import { create } from "zustand";
import { login as loginRequest, register as registerRequest } from "../services/auth.service";
import { ROLES } from "../utils/constants";

const TOKEN_KEY = "nexaos_token";
const USER_KEY = "nexaos_user";

const loadUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};

const initialUser = loadUser();

const useAuthStore = create((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: initialUser,
  role: initialUser?.roleName || ROLES.USER,
  pending: false,
  error: null,
  authModalOpen: !localStorage.getItem(TOKEN_KEY),
  redirectAfterAuth: "/",

  initializeFromSession: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ authModalOpen: true });
    }
  },

  requireAuth: (redirectAfterAuth = "/") => {
    set({ authModalOpen: true, redirectAfterAuth });
  },

  closeAuthModal: () => set({ authModalOpen: false }),

  login: async (credentials) => {
    set({ pending: true, error: null });
    try {
      const data = await loginRequest(credentials);
      set({
        token: data.token,
        user: data.user,
        role: data.user?.roleName || ROLES.USER,
        authModalOpen: false,
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
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

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({
      token: null,
      user: null,
      role: ROLES.USER,
      authModalOpen: true,
    });
  },
}));

export default useAuthStore;

