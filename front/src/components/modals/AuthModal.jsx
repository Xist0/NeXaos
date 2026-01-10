import { useState } from "react";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import PhoneInput from "../ui/PhoneInput";
import useAuth from "../../hooks/useAuth";
import useLogger from "../../hooks/useLogger";

const modes = { LOGIN: "login", REGISTER: "register" };

const AuthModal = () => {
    const { login, register, pending, error } = useAuth();
    const logger = useLogger();
    const [mode, setMode] = useState(modes.LOGIN);
    const [form, setForm] = useState({ email: "", password: "", fullName: "", phone: "" });

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
            const message = err.response?.data?.message || "Не удалось выполнить авторизацию. Попробуйте ещё раз.";
            logger.error(message);
        }
    };

    return (
        <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            <div className="text-center sm:text-left">
                <p className="text-xs uppercase tracking-wide text-accent">Личный кабинет</p>
                <h2 className="text-2xl sm:text-3xl font-semibold text-night-900">
                    {mode === modes.LOGIN ? "Войти" : "Создать профиль"}
                </h2>
                <p className="text-sm text-night-500 mt-1">
                    {mode === modes.LOGIN
                        ? "Отслеживайте заказы и сохраняйте любимые товары."
                        : "Зарегистрируйтесь, чтобы получать бонусы и персональные предложения."}
                </p>
            </div>

            <div className="space-y-4">
                {mode === modes.REGISTER && (
                    <>
                        <div>
                            <label className="text-sm font-medium text-night-700">Имя</label>
                            <SecureInput value={form.fullName} onChange={handleChange("fullName")} placeholder="Иван Иванов" required className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-night-700">Телефон</label>
                            <PhoneInput value={form.phone} onChange={handleChange("phone")} placeholder="+7 (000) - 000 - 00 -00" required className="mt-1" />
                        </div>
                    </>
                )}

                <div>
                    <label className="text-sm font-medium text-night-700">Email</label>
                    <SecureInput type="email" value={form.email} onChange={handleChange("email")} placeholder="you@nexaos.io" required className="mt-1" />
                </div>

                <div>
                    <label className="text-sm font-medium text-night-700">Пароль</label>
                    <SecureInput type="password" value={form.password} onChange={handleChange("password")} minLength={6} placeholder="••••••••" required className="mt-1" />
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="pt-2 space-y-3">
                <SecureButton type="submit" disabled={pending} className="w-full justify-center text-base py-3">
                    {pending ? "Подождите..." : mode === modes.LOGIN ? "Войти" : "Создать"}
                </SecureButton>

                <button type="button" onClick={() => setMode(prev => prev === modes.LOGIN ? modes.REGISTER : modes.LOGIN)} className="w-full text-sm font-semibold text-accent-dark hover:underline">
                    {mode === modes.LOGIN ? "Регистрация" : "Уже есть аккаунт"}
                </button>
            </div>
        </form>
    );
};

export default AuthModal;
