import { useState } from "react";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import useAuth from "../../hooks/useAuth";

const modes = {
  LOGIN: "login",
  REGISTER: "register",
};

const AuthModal = () => {
  const { login, register, pending, error } = useAuth();
  const [mode, setMode] = useState(modes.LOGIN);
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });

  const handleChange = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === modes.LOGIN) {
      await login({ email: form.email, password: form.password });
    } else {
      await register(form);
    }
  };

  return (
    <form className="grid" style={{ gap: "1rem" }} onSubmit={handleSubmit}>
      <h2 style={{ margin: 0 }}>NeXaos доступ</h2>
      <p style={{ margin: 0, opacity: 0.7 }}>
        {mode === modes.LOGIN
          ? "Авторизуйтесь для доступа к модулям."
          : "Создайте профиль для работы с системой."}
      </p>
      {mode === modes.REGISTER && (
        <label>
          <span>Имя</span>
          <SecureInput
            value={form.fullName}
            onChange={handleChange("fullName")}
            placeholder="Иван Иванов"
            required
          />
        </label>
      )}
      <label>
        <span>Email</span>
        <SecureInput
          type="email"
          value={form.email}
          onChange={handleChange("email")}
          placeholder="you@nexaos.io"
          required
        />
      </label>
      <label>
        <span>Пароль</span>
        <SecureInput
          type="password"
          value={form.password}
          onChange={handleChange("password")}
          minLength={6}
          placeholder="••••••••"
          required
        />
      </label>
      {error ? (
        <div style={{ color: "#fca5a5", fontSize: "0.9rem" }}>{error}</div>
      ) : null}
      <SecureButton type="submit" disabled={pending}>
        {pending ? "Подождите..." : mode === modes.LOGIN ? "Войти" : "Создать"}
      </SecureButton>
      <button
        type="button"
        onClick={() =>
          setMode((prev) => (prev === modes.LOGIN ? modes.REGISTER : modes.LOGIN))
        }
        className="secure-button"
        style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "#fff",
        }}
      >
        {mode === modes.LOGIN ? "Регистрация" : "Уже есть аккаунт"}
      </button>
    </form>
  );
};

export default AuthModal;

