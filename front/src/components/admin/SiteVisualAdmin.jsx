import { useCallback, useEffect, useMemo, useState } from "react";
import { FaGripVertical, FaPlus, FaSave, FaSpinner, FaTrash } from "react-icons/fa";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import SocialIcon from "../layout/SocialIcon";

const ICON_OPTIONS = [
  { value: "vk", label: "VK" },
  { value: "telegram", label: "Telegram" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ok", label: "Одноклассники" },
  { value: "link", label: "Ссылка" },
];

const makeId = () => `social-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const defaultDraft = () => ({
  logoText: "NeXaos",
  navLinks: [
    { label: "Каталог", url: "/catalog" },
    { label: "Контакты", url: "/contacts" },
    { label: "Отзывы", url: "/reviews" },
  ],
  socialLinks: [],
});

const SiteVisualAdmin = () => {
  const { get, put } = useApi();
  const logger = useLogger();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedDraft, setSavedDraft] = useState(null);
  const [draft, setDraft] = useState(defaultDraft());
  const [dragId, setDragId] = useState(null);
  const [subTab, setSubTab] = useState("header");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get("/site-settings");
      const header = res?.data?.settings?.header || res?.data?.header || {};
      const next = {
        logoText: header.logoText || "NeXaos",
        navLinks: Array.isArray(header.navLinks) && header.navLinks.length
          ? header.navLinks.map((l) => ({ label: l.label || "", url: l.url || "" }))
          : defaultDraft().navLinks,
        socialLinks: Array.isArray(header.socialLinks)
          ? header.socialLinks.map((s, i) => ({
              id: s.id || makeId(),
              label: s.label || "",
              url: s.url || "",
              icon: s.icon || "link",
              sortOrder: Number.isFinite(Number(s.sortOrder)) ? Number(s.sortOrder) : i,
            }))
          : [],
      };
      setDraft(next);
      setSavedDraft(JSON.parse(JSON.stringify(next)));
    } catch (e) {
      logger?.error("Не удалось загрузить настройки визуала", e);
    } finally {
      setLoading(false);
    }
  }, [get, logger]);

  useEffect(() => {
    load();
  }, [load]);

  const isDirty = useMemo(() => {
    if (!savedDraft) return false;
    return JSON.stringify(savedDraft) !== JSON.stringify(draft);
  }, [draft, savedDraft]);

  const sortedSocial = useMemo(
    () => [...draft.socialLinks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [draft.socialLinks]
  );

  const addSocial = () => {
    setDraft((prev) => ({
      ...prev,
      socialLinks: [
        ...prev.socialLinks,
        { id: makeId(), label: "Соцсеть", url: "", icon: "vk", sortOrder: prev.socialLinks.length },
      ],
    }));
  };

  const updateSocial = (id, patch) => {
    setDraft((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const removeSocial = (id) => {
    setDraft((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((item) => item.id !== id),
    }));
  };

  const reorderSocial = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setDraft((prev) => {
      const list = [...prev.socialLinks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const fromIndex = list.findIndex((x) => x.id === fromId);
      const toIndex = list.findIndex((x) => x.id === toId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      return {
        ...prev,
        socialLinks: list.map((item, index) => ({ ...item, sortOrder: index })),
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        settings: {
          header: {
            logoText: draft.logoText,
            navLinks: draft.navLinks,
            socialLinks: sortedSocial.map((item, index) => ({
              id: item.id,
              label: item.label,
              url: item.url,
              icon: item.icon,
              sortOrder: index,
            })),
          },
        },
      };
      const res = await put("/site-settings", payload);
      const header = res?.data?.settings?.header || res?.data?.header || draft;
      const next = {
        logoText: header.logoText || draft.logoText,
        navLinks: header.navLinks || draft.navLinks,
        socialLinks: header.socialLinks || draft.socialLinks,
      };
      setDraft(next);
      setSavedDraft(JSON.parse(JSON.stringify(next)));
      logger?.info("Настройки визуала сохранены");
    } catch (e) {
      logger?.error("Не удалось сохранить настройки визуала", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-16 text-center">
        <FaSpinner className="w-12 h-12 text-accent animate-spin mx-auto" />
        <p className="mt-4 text-night-600">Загрузка визуала сайта…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-night-900">Визуал сайта</h2>
          <p className="text-sm text-night-500 mt-1">Изменения применяются на сайте только после нажатия «Сохранить».</p>
        </div>
        <SecureButton
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="px-5 py-2.5 flex items-center gap-2"
        >
          {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
          Сохранить
        </SecureButton>
      </div>

      <div className="flex gap-2 border-b border-night-100 pb-2">
        <button
          type="button"
          onClick={() => setSubTab("header")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            subTab === "header" ? "bg-accent text-white" : "text-night-600 hover:bg-night-50"
          }`}
        >
          Шапка
        </button>
      </div>

      {subTab === "header" && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-lg font-semibold text-night-900">Превью шапки</h3>
            <div className="rounded-xl border border-night-200 overflow-hidden bg-white shadow-sm">
              <div className="bg-night-900 text-white text-[10px] px-4 py-1.5 text-center">
                Сервис и доставка мебели по всей России
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-night-100">
                <span className="text-lg font-bold text-night-900 tracking-tight">{draft.logoText || "NeXaos"}</span>
                <nav className="hidden sm:flex items-center gap-4 text-xs text-night-600">
                  {draft.navLinks.map((link) => (
                    <span key={`${link.label}-${link.url}`}>{link.label}</span>
                  ))}
                </nav>
                <div className="flex items-center gap-2">
                  {sortedSocial.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-night-200 text-night-700 hover:bg-night-50"
                      title={item.label || item.url}
                    >
                      <SocialIcon icon={item.icon} />
                    </span>
                  ))}
                  <span className="w-9 h-9 rounded-lg border border-night-200 flex items-center justify-center text-night-400 text-xs">🛒</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-night-800">Текст логотипа</span>
              <SecureInput value={draft.logoText} onChange={(v) => setDraft((p) => ({ ...p, logoText: v }))} />
            </label>
          </div>

          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-night-900">Блок соцсетей</h3>
              <SecureButton type="button" variant="outline" onClick={addSocial} className="px-3 py-2 text-xs flex items-center gap-2">
                <FaPlus /> Добавить
              </SecureButton>
            </div>

            {sortedSocial.length === 0 ? (
              <p className="text-sm text-night-500">Нет иконок. Добавьте соцсеть — она появится в шапке справа.</p>
            ) : (
              <ul className="space-y-3">
                {sortedSocial.map((item) => (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={() => setDragId(item.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragId) reorderSocial(dragId, item.id);
                      setDragId(null);
                    }}
                    className="flex flex-wrap items-start gap-3 p-4 rounded-xl border border-night-100 bg-night-50/30"
                  >
                    <button
                      type="button"
                      className="mt-2 text-night-400 cursor-grab active:cursor-grabbing"
                      aria-label="Перетащить"
                    >
                      <FaGripVertical />
                    </button>
                    <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-white border border-night-200 shrink-0">
                      <SocialIcon icon={item.icon} className="w-6 h-6 text-night-800" />
                    </div>
                    <div className="flex-1 grid gap-3 sm:grid-cols-2 min-w-[200px]">
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-night-600">Иконка</span>
                        <select
                          value={item.icon}
                          onChange={(e) => updateSocial(item.id, { icon: e.target.value })}
                          className="w-full px-3 py-2 border border-night-200 rounded-lg text-sm bg-white"
                        >
                          {ICON_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-night-600">Подпись (title)</span>
                        <SecureInput value={item.label} onChange={(v) => updateSocial(item.id, { label: v })} />
                      </label>
                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-xs font-medium text-night-600">Ссылка</span>
                        <SecureInput value={item.url} onChange={(v) => updateSocial(item.id, { url: v })} placeholder="https://..." />
                      </label>
                    </div>
                    <SecureButton
                      type="button"
                      variant="ghost"
                      onClick={() => removeSocial(item.id)}
                      className="text-red-600 hover:bg-red-50 px-2"
                      aria-label="Удалить"
                    >
                      <FaTrash />
                    </SecureButton>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-night-500">Перетащите строку за ⋮⋮, чтобы изменить порядок иконок слева направо.</p>
          </div>

          <div className="glass-card p-6 space-y-3">
            <h3 className="text-lg font-semibold text-night-900">Навигация в шапке</h3>
            {draft.navLinks.map((link, index) => (
              <div key={index} className="grid sm:grid-cols-2 gap-3">
                <SecureInput
                  value={link.label}
                  onChange={(v) =>
                    setDraft((p) => ({
                      ...p,
                      navLinks: p.navLinks.map((l, i) => (i === index ? { ...l, label: v } : l)),
                    }))
                  }
                />
                <SecureInput
                  value={link.url}
                  onChange={(v) =>
                    setDraft((p) => ({
                      ...p,
                      navLinks: p.navLinks.map((l, i) => (i === index ? { ...l, url: v } : l)),
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <SecureButton type="button" onClick={handleSave} disabled={saving || !isDirty} className="px-5 py-2.5 flex items-center gap-2">
              {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
              Сохранить
            </SecureButton>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteVisualAdmin;
