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
        try {
            if (mode === modes.LOGIN) {
                await login({ email: form.email, password: form.password });
            } else {
                await register(form);
            }
        }  catch (err) {
            console.error("Auth error:", err.response?.data || err.message || err);
          }
    };

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
                <p className="text-xs uppercase tracking-wide text-accent">Личный кабинет</p>
                <h2 className="text-2xl font-semibold text-night-900">
                    {mode === modes.LOGIN ? "Войти" : "Создать профиль"}
                </h2>
                <p className="text-sm text-night-500">
                    {mode === modes.LOGIN
                        ? "Отслеживайте заказы и сохраняйте любимые товары."
                        : "Зарегистрируйтесь, чтобы получать бонусы и персональные предложения."}
                </p>
            </div>

            {mode === modes.REGISTER && (
                <div>
                    <label className="text-sm font-medium text-night-700">Имя</label>
                    <SecureInput
                        value={form.fullName}
                        onChange={handleChange("fullName")}
                        placeholder="Иван Иванов"
                        required
                    />
                </div>
            )}

            <div>
                <label className="text-sm font-medium text-night-700">Email</label>
                <SecureInput
                    type="email"
                    value={form.email}
                    onChange={handleChange("email")}
                    placeholder="you@nexaos.io"
                    required
                />
            </div>

            <div>
                <label className="text-sm font-medium text-night-700">Пароль</label>
                <SecureInput
                    type="password"
                    value={form.password}
                    onChange={handleChange("password")}
                    minLength={6}
                    placeholder="••••••••"
                    required
                />
            </div>

            {error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            ) : null}

<SecureButton
    onClick={handleSubmit} // ← вызываем напрямую
    disabled={pending}
    className="w-full justify-center"
  >
    {pending ? "Подождите..." : mode === modes.LOGIN ? "Войти" : "Создать"}
  </SecureButton>

            <button
                type="button"
                onClick={() =>
                    setMode((prev) => (prev === modes.LOGIN ? modes.REGISTER : modes.LOGIN))
                }
                className="w-full text-sm font-semibold text-accent underline-offset-4 hover:underline"
            >
                {mode === modes.LOGIN ? "Регистрация" : "Уже есть аккаунт"}
            </button>
        </form>
    );
};

export default AuthModal;

