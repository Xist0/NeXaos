import { useEffect, useMemo, useState } from "react";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import PhoneInput from "../ui/PhoneInput";
import PopoverSelect from "../ui/PopoverSelect";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";

const roleLabel = (roleName) => {
  const n = String(roleName || "").toLowerCase();
  if (n === "admin") return "Администратор";
  if (n === "manager") return "Менеджер";
  if (n === "user") return "Пользователь";
  return roleName || "—";
};

const normalizeEmail = (value) => String(value || "").trim();

const isValidEmail = (value) => {
  const v = normalizeEmail(value);
  if (!v) return false;
  const at = v.indexOf("@");
  const dot = v.lastIndexOf(".");
  return at > 0 && dot > at + 1 && dot < v.length - 1;
};

const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  let d = digits;
  if (d.startsWith("8")) d = "7" + d.slice(1);
  // Если ввели 11 цифр, но первая не 7/8 (например 9XXXXXXXXXX),
  // считаем что это номер без кода страны и принудительно ставим 7 + последние 10 цифр.
  if (d.length === 11 && !d.startsWith("7")) {
    d = "7" + d.slice(1);
  }
  // Если ввели 10 цифр, добавляем код страны 7.
  if (d.length === 10) {
    d = "7" + d;
  }
  // Если начинается не с 7 (и длина не 10/11) — всё равно фиксируем ведущую 7.
  if (d.length > 0 && !d.startsWith("7")) {
    d = "7" + d;
  }
  d = d.slice(0, 11);
  return d.length ? `+${d}` : "";
};

const formatPhoneDisplay = (value) => {
  const digitsRaw = String(value || "").replace(/\D/g, "");
  if (!digitsRaw) return "—";
  let d = digitsRaw;
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 11 && !d.startsWith("7")) d = "7" + d.slice(1);
  if (d.length === 10) d = "7" + d;
  if (d.length < 11) return `+${d}`;
  d = d.slice(0, 11);
  return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
};

const isValidRuPhone = (value) => {
  const normalized = normalizePhone(value);
  const d = String(normalized || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("7");
};

const StaffUsersAdmin = () => {
  const { get, post, put, del } = useApi();
  const logger = useLogger();
  const [roles, setRoles] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    roleId: "",
    password: "",
    passwordConfirm: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [changePassword, setChangePassword] = useState(false);

  const roleOptions = useMemo(() => {
    return (Array.isArray(roles) ? roles : [])
      .filter((r) => String(r?.name || "").toLowerCase() !== "user")
      .map((r) => ({ value: String(r.id), label: roleLabel(r.name) }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [roles]);

  const rolesById = useMemo(() => {
    const map = new Map();
    (Array.isArray(roles) ? roles : []).forEach((r) => {
      map.set(String(r.id), r);
    });
    return map;
  }, [roles]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [rolesResp, usersResp] = await Promise.all([get("/roles"), get("/users")]);
      setRoles(Array.isArray(rolesResp?.data) ? rolesResp.data : []);
      setItems(Array.isArray(usersResp?.data) ? usersResp.data : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  const visibleItems = useMemo(() => {
    return (Array.isArray(items) ? items : []).filter((u) => {
      const roleRow = rolesById.get(String(u?.role_id || ""));
      const name = String(roleRow?.name || "").toLowerCase();
      return name === "admin" || name === "manager";
    });
  }, [items, rolesById]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({ firstName: "", lastName: "", phone: "", email: "", roleId: "", password: "", passwordConfirm: "" });
    setChangePassword(false);
  };

  const startEdit = (u) => {
    const full = String(u?.full_name || "").trim();
    const parts = full ? full.split(/\s+/) : [];
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");

    setEditingId(u.id);
    setChangePassword(false);
    setForm({
      firstName,
      lastName,
      phone: normalizePhone(u?.phone || ""),
      email: String(u?.email || ""),
      roleId: u?.role_id != null ? String(u.role_id) : "",
      password: "",
      passwordConfirm: "",
    });
  };

  const buildPayload = () => {
    const fullName = [form.firstName, form.lastName].map((s) => String(s || "").trim()).filter(Boolean).join(" ");
    const payload = {
      email: normalizeEmail(form.email),
      full_name: fullName,
      phone: normalizePhone(form.phone),
      role_id: form.roleId ? Number(form.roleId) : undefined,
      is_active: true,
    };

    if (!editingId) {
      payload.password = String(form.password || "");
    } else if (changePassword && form.password) {
      payload.password = String(form.password || "");
    }

    return payload;
  };

  const formErrors = useMemo(() => {
    const errors = {};
    if (!isValidEmail(form.email)) errors.email = "Email должен содержать @ и .";
    if (!isValidRuPhone(form.phone)) errors.phone = "Введите номер в формате +7 xxx xxx-xx-xx";
    if (!form.roleId) errors.roleId = "Выберите роль";

    if (!editingId) {
      if (!String(form.password || "")) errors.password = "Введите пароль";
      if (String(form.password || "").length < 6) errors.password = "Пароль минимум 6 символов";
      if (String(form.passwordConfirm || "") !== String(form.password || "")) errors.passwordConfirm = "Пароли не совпадают";
    } else if (changePassword) {
      if (!String(form.password || "")) errors.password = "Введите пароль";
      if (String(form.password || "").length < 6) errors.password = "Пароль минимум 6 символов";
      if (String(form.passwordConfirm || "") !== String(form.password || "")) errors.passwordConfirm = "Пароли не совпадают";
    }

    return errors;
  }, [changePassword, editingId, form.email, form.password, form.passwordConfirm, form.phone, form.roleId]);

  const canSave = Object.keys(formErrors).length === 0;

  const save = async () => {
    if (saving) return;
    if (!canSave) {
      setError("Проверьте правильность email/телефона и пароля");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload();
      if (editingId) {
        await put(`/users/${editingId}`, payload);
        logger.info("Пользователь обновлён");
      } else {
        await post("/users", payload);
        logger.info("Пользователь создан");
      }
      resetForm();
      await load();
    } catch (e) {
      const msg = e?.response?.data?.message || "Не удалось сохранить пользователя";
      const details = e?.response?.data?.details;
      const detailsText = Array.isArray(details)
        ? details
            .map((d) => d?.message || d)
            .filter(Boolean)
            .join("; ")
        : "";
      setError(detailsText ? `${msg}: ${detailsText}` : msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!id) return;
    setSaving(true);
    setError("");
    try {
      await del(`/users/${id}`);
      logger.info("Пользователь удалён");
      if (String(editingId) === String(id)) resetForm();
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Не удалось удалить пользователя");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-card p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-night-900">Пользователи</h2>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 space-y-6">
        <div className="rounded-2xl border border-night-100 bg-white/60 p-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SecureInput
                label="Имя"
                value={form.firstName}
                onChange={(v) => setForm((p) => ({ ...p, firstName: v }))}
              />
              <SecureInput
                label="Фамилия"
                value={form.lastName}
                onChange={(v) => setForm((p) => ({ ...p, lastName: v }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <div className="text-sm font-semibold text-night-700 mb-2">Номер телефона</div>
                <PhoneInput
                  value={form.phone}
                  onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                  placeholder="+7 (000) - 000 - 00 -00"
                  className={formErrors.phone ? "border border-red-300" : ""}
                  required
                />
                {formErrors.phone ? <div className="mt-1 text-xs text-red-600">{formErrors.phone}</div> : null}
              </div>
              <SecureInput
                label="Email"
                value={form.email}
                onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                className={formErrors.email ? "border border-red-300" : ""}
              />
              <div>
                <div className="text-sm font-semibold text-night-700 mb-2">Должность (роль)</div>
                <PopoverSelect
                  size="md"
                  items={roleOptions}
                  value={form.roleId}
                  placeholder="Выберите..."
                  allowClear={false}
                  searchable={roleOptions.length > 10}
                  getKey={(o) => String(o.value)}
                  getLabel={(o) => String(o.label)}
                  onChange={(next) => setForm((p) => ({ ...p, roleId: String(next || "") }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {editingId && !changePassword ? (
                <div className="sm:col-span-2">
                  <SecureButton
                    type="button"
                    disabled={saving}
                    onClick={() => setChangePassword(true)}
                    className="px-4 py-2 bg-yellow-100 text-yellow-900 border border-yellow-200 hover:bg-yellow-200"
                  >
                    Сменить пароль
                  </SecureButton>
                </div>
              ) : (
                <>
                  <div>
                    <SecureInput
                      label={editingId ? "Новый пароль" : "Пароль"}
                      value={form.password}
                      onChange={(v) => setForm((p) => ({ ...p, password: v }))}
                      type={showPassword ? "text" : "password"}
                      className={formErrors.password ? "border border-red-300" : ""}
                    />
                    {formErrors.password ? <div className="mt-1 text-xs text-red-600">{formErrors.password}</div> : null}
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-night-600 hover:text-night-900"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? "Скрыть пароль" : "Показать пароль"}
                    </button>
                  </div>

                  <div>
                    <SecureInput
                      label="Подтверждение пароля"
                      value={form.passwordConfirm}
                      onChange={(v) => setForm((p) => ({ ...p, passwordConfirm: v }))}
                      type={showPassword ? "text" : "password"}
                      className={formErrors.passwordConfirm ? "border border-red-300" : ""}
                    />
                    {formErrors.passwordConfirm ? (
                      <div className="mt-1 text-xs text-red-600">{formErrors.passwordConfirm}</div>
                    ) : null}

                    {editingId && (
                      <button
                        type="button"
                        className="mt-2 text-xs font-semibold text-night-600 hover:text-night-900"
                        onClick={() => {
                          setChangePassword(false);
                          setForm((p) => ({ ...p, password: "", passwordConfirm: "" }));
                        }}
                      >
                        Не менять пароль
                      </button>
                    )}
                  </div>
                </>
              )}
              <div className="flex gap-2 sm:justify-end items-end">
                <SecureButton
                  type="button"
                  disabled={saving}
                  onClick={save}
                  className="px-4 py-2"
                >
                  {editingId ? "Сохранить" : "Создать"}
                </SecureButton>
                {editingId && (
                  <SecureButton
                    type="button"
                    variant="ghost"
                    disabled={saving}
                    onClick={resetForm}
                    className="px-4 py-2"
                  >
                    Отмена
                  </SecureButton>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-left text-sm">
            <thead>
              <tr className="text-night-400">
                <th className="py-3 pr-4 w-20">ID</th>
                <th className="py-3 pr-4">Сотрудник</th>
                <th className="py-3 pr-4 w-56">Телефон</th>
                <th className="py-3 pr-4 w-44">Должность</th>
                <th className="py-3 pr-4 w-40 text-center">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((u) => {
                const roleRow = rolesById.get(String(u?.role_id || ""));
                return (
                  <tr key={u.id} className="border-t border-night-100 text-night-900">
                    <td className="py-3 pr-4 font-semibold whitespace-nowrap text-xs">#{u.id}</td>
                    <td className="py-3 pr-4">
                      <div className="min-w-0">
                        <div className="font-semibold break-words">{u.full_name || "—"}</div>
                        <div className="text-xs text-night-500 break-words">{u.email || ""}</div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{formatPhoneDisplay(u.phone)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{roleLabel(roleRow?.name)}</td>
                    <td className="py-3 pr-4 text-center">
                      <div className="flex justify-center gap-2">
                        <SecureButton
                          variant="outline"
                          className="h-10 px-4 py-2 text-xs"
                          onClick={() => startEdit(u)}
                          disabled={saving}
                        >
                          Изменить
                        </SecureButton>
                        <SecureButton
                          variant="ghost"
                          className="h-10 px-4 py-2 text-xs border border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => remove(u.id)}
                          disabled={saving}
                        >
                          Удалить
                        </SecureButton>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!visibleItems.length && !loading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-night-400">Нет записей</td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-night-400">Загрузка…</td>
                </tr>
              )}
              </tbody>
            </table>
        </div>
      </div>
    </section>
  );
};

export default StaffUsersAdmin;
