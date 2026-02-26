import { useEffect, useMemo, useRef, useState } from "react";
import SecureButton from "../../ui/SecureButton";
import SecureInput from "../../ui/SecureInput";
import { getImageUrl, getThumbUrl } from "../../../utils/image";
import ColorBadge from "../../ui/ColorBadge";
import PopoverSelect from "../../ui/PopoverSelect";

const LazyImg = ({ src, alt, className, crossOrigin, onError }) => {
  const holderRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) return;
    const el = holderRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setIsVisible(true));
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setIsVisible(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin: "50px", threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [isVisible]);

  return (
    <span ref={holderRef} className={className}>
      {isVisible && (
        <img
          src={src}
          alt={alt}
          className={className}
          crossOrigin={crossOrigin}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onError={onError}
        />
      )}
    </span>
  );
};

const EntityFormFields = ({
  endpoint,
  filterModuleCategoryId,
  currentFields,
  form,
  setForm,
  handleUpload,
  uploadingField,
  availableModuleCategories,
  colors,
  collections,
  availableModuleDescriptions,
  selectedCategoryPrefix,
  sizePresetTabByField,
  setSizePresetTabByField,
  sizePresetsByField,
  setSizePresetsByField,
  getSizePresetStorageKey,
}) => {
  const fieldsToRender = endpoint === "/module-descriptions" && !filterModuleCategoryId ? [] : currentFields;
  const [open, setOpen] = useState({});
  const rootRef = useRef(null);

  const colorsByType = useMemo(() => {
    const list = Array.isArray(colors) ? colors : [];
    return {
      facade: list.filter((c) => c?.type === "facade"),
      corpus: list.filter((c) => c?.type === "corpus"),
      universal: list.filter((c) => !c?.type),
      typed: list.filter((c) => Boolean(c?.type)),
    };
  }, [colors]);

  const getColorFieldRole = (fieldName) => {
    const name = String(fieldName || "");
    if (!name) return null;

    if (name === "primary_color_id") return "primary";
    if (name === "secondary_color_id") return "secondary";

    const lowered = name.toLowerCase();
    if (/(^|_)primary(_|$)/.test(lowered)) return "primary";
    if (/(^|_)secondary(_|$)/.test(lowered)) return "secondary";

    return null;
  };

  const isCheckboxChecked = (value) => {
    if (value === true) return true;
    if (value === false) return false;
    if (value === 1 || value === "1") return true;
    if (value === 0 || value === "0") return false;
    if (value === "true") return true;
    if (value === "false") return false;
    return Boolean(value);
  };

  useEffect(() => {
    const hasAnyOpen = Object.values(open || {}).some(Boolean);
    if (!hasAnyOpen) return;

    const onPointerDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setOpen({});
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef}>
      {(() => {
        const rendered = [];
        for (let i = 0; i < fieldsToRender.length; i += 1) {
          const field = fieldsToRender[i];

          const isColor = field?.type === "color";
          const nextField = i + 1 < fieldsToRender.length ? fieldsToRender[i + 1] : null;
          const nextIsColor = nextField?.type === "color";

          const role = isColor ? (field.colorRole || getColorFieldRole(field.name)) : null;
          const nextRole = nextIsColor ? (nextField.colorRole || getColorFieldRole(nextField.name)) : null;

          const isPrimary = role === "primary";
          const isSecondary = role === "secondary";
          const nextIsPrimary = nextRole === "primary";
          const nextIsSecondary = nextRole === "secondary";

          const canGroupColors =
            isColor &&
            nextIsColor &&
            ((isPrimary && nextIsSecondary) || (isSecondary && nextIsPrimary) || (isPrimary && nextIsPrimary) || (isSecondary && nextIsSecondary));

          const renderSingleField = (fieldToRender) => (
            <label
              key={fieldToRender.name}
              className={
                fieldToRender.type === "checkbox"
                  ? "text-sm text-night-700 flex items-center justify-between gap-4"
                  : "text-sm text-night-700 space-y-1"
              }
            >
              <span className={fieldToRender.type === "checkbox" ? "font-medium text-night-700" : ""}>
                {fieldToRender.label}
              </span>
              {fieldToRender.inputType === "image" ? (
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  handleUpload(fieldToRender.name, file);
                  // сбрасываем выбранный файл, чтобы не оставалось название и можно было выбрать тот же файл снова
                  event.target.value = "";
                }}
                className="block w-full text-xs text-night-600 file:mr-3 file:rounded-full file:border-0 file:bg-night-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-night-800"
              />
              {form[fieldToRender.name] && (
                <img
                  src={getImageUrl(form[fieldToRender.name])}
                  alt={fieldToRender.label}
                  className="h-20 w-20 rounded-md object-cover border border-night-100"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    console.error("Ошибка загрузки изображения:", form[fieldToRender.name]);
                    e.target.style.display = "none";
                  }}
                />
              )}
              {uploadingField === fieldToRender.name && <p className="text-xs text-night-400">Загружаем файл...</p>}
            </div>
          ) : fieldToRender.type === "checkbox" ? (
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  [fieldToRender.name]: !isCheckboxChecked(prev[fieldToRender.name]),
                }))
              }
              className={
                "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent" +
                (isCheckboxChecked(form[fieldToRender.name]) ? " bg-accent" : " bg-night-300")
              }
              aria-pressed={isCheckboxChecked(form[fieldToRender.name])}
              aria-label={fieldToRender.label}
            >
              <span
                className={
                  "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform" +
                  (isCheckboxChecked(form[fieldToRender.name]) ? " translate-x-5" : " translate-x-0.5")
                }
              />
            </button>
          ) : fieldToRender.type === "select" ? (
            <PopoverSelect
              size="md"
              items={fieldToRender.options || []}
              value={form[fieldToRender.name] ?? ""}
              placeholder="Выберите..."
              allowClear={!fieldToRender.required}
              clearLabel="Выберите..."
              searchable={(fieldToRender.options || []).length > 10}
              getKey={(option) => String(option.value)}
              getLabel={(option) => String(option.label ?? option.value ?? "")}
              onChange={(next) => setForm((prev) => ({ ...prev, [fieldToRender.name]: String(next || "") }))}
              buttonClassName="rounded-lg"
              popoverClassName="rounded-lg max-w-xl"
              maxHeightClassName="max-h-80"
            />
          ) : fieldToRender.type === "moduleCategory" ? (
            <PopoverSelect
              size="md"
              items={(availableModuleCategories || []).slice().sort((a, b) => Number(a.id) - Number(b.id))}
              value={form[fieldToRender.name] ?? ""}
              placeholder="Выберите..."
              allowClear={!fieldToRender.required}
              clearLabel="Выберите..."
              searchable={(availableModuleCategories || []).length > 10}
              getKey={(c) => String(c.id)}
              getLabel={(c) => String(c?.name || "")}
              onChange={(next) =>
                setForm((prev) => ({
                  ...prev,
                  [fieldToRender.name]: next ? Number(next) : "",
                }))
              }
              buttonClassName="rounded-lg"
              popoverClassName="rounded-lg max-w-xl"
              maxHeightClassName="max-h-80"
            />
          ) : fieldToRender.type === "color" ? (
            <div className="space-y-2">
              {(() => {
                const selected = colors.find((c) => c.id === Number(form[fieldToRender.name]));
                return (
                  <button
                    type="button"
                    onClick={() =>
                      setOpen((prev) => {
                        const next = {};
                        next[fieldToRender.name] = !prev[fieldToRender.name];
                        return next;
                      })
                    }
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-night-200 bg-white hover:border-accent transition"
                  >
                    <span className="flex items-center gap-2">
                      {selected ? <ColorBadge colorData={selected} /> : <span className="text-xs text-night-500">Выберите цвет</span>}
                    </span>
                    <span className="text-night-400">▾</span>
                  </button>
                );
              })()}
              {(() => {
                const role = fieldToRender.colorRole || getColorFieldRole(fieldToRender.name);
                const isPrimaryField = role === "primary";
                const isSecondaryField = role === "secondary";
                const isOpen = Boolean(open[fieldToRender.name]);
                const mainList = isPrimaryField
                  ? colorsByType.facade
                  : isSecondaryField
                    ? colorsByType.corpus
                    : colorsByType.typed;
                const mainTitle = isPrimaryField ? "Основные цвета" : isSecondaryField ? "Доп. цвета" : "Цвета";
                return !isOpen ? null : (
                  <div className="relative">
                    <div className="absolute z-[1000] top-full mt-1 w-full rounded-xl border border-night-200 bg-white shadow-xl max-h-80 overflow-auto">
                      <div className="p-2 space-y-2">
                        <div className="text-xs font-semibold text-night-500 uppercase tracking-wide px-1">{mainTitle}</div>
                        <div className="space-y-1">
                          {mainList.map((c) => {
                            const isSelected = Number(form[fieldToRender.name]) === Number(c.id);
                            return (
                              <button
                                key={`${fieldToRender.name}-opt-${c.id}`}
                                type="button"
                                onClick={() => {
                                  setForm((prev) => ({ ...prev, [fieldToRender.name]: Number(c.id) }));
                                  setOpen({});
                                }}
                                className={`w-full flex items-center gap-2 p-2 rounded-lg border transition ${
                                  isSelected ? "border-accent bg-accent/5" : "border-night-200 hover:border-accent"
                                }`}
                              >
                                <LazyImg
                                  src={getThumbUrl(c.image_url, { w: 64, h: 64, q: 65, fit: "cover" })}
                                  alt={c.name}
                                  className="h-8 w-8 rounded object-cover border border-night-200 flex-shrink-0"
                                  crossOrigin="anonymous"
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                                <span className="text-xs text-night-700 truncate">{c.name}</span>
                              </button>
                            );
                          })}
                        </div>
                        {colorsByType.universal.length > 0 && (
                          <>
                            <div className="my-2 border-t border-night-200" />
                            <div className="text-xs font-semibold text-night-500 uppercase tracking-wide px-1">Универсальные цвета</div>
                            <div className="space-y-1">
                              {colorsByType.universal.map((c) => {
                                const isSelected = Number(form[fieldToRender.name]) === Number(c.id);
                                return (
                                  <button
                                    key={`${fieldToRender.name}-univ-${c.id}`}
                                    type="button"
                                    onClick={() => {
                                      setForm((prev) => ({ ...prev, [fieldToRender.name]: Number(c.id) }));
                                      setOpen({});
                                    }}
                                    className={`w-full flex items-center gap-2 p-2 rounded-lg border transition ${
                                      isSelected ? "border-accent bg-accent/5" : "border-night-200 hover:border-accent"
                                    }`}
                                  >
                                    <LazyImg
                                      src={getThumbUrl(c.image_url, { w: 64, h: 64, q: 65, fit: "cover" })}
                                      alt={c.name}
                                      className="h-8 w-8 rounded object-cover border border-night-200 flex-shrink-0"
                                      crossOrigin="anonymous"
                                      onError={(e) => {
                                        e.target.style.display = "none";
                                      }}
                                    />
                                    <span className="text-xs text-night-700 truncate">{c.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : fieldToRender.type === "collection" ? (
            <PopoverSelect
              size="md"
              items={(collections || []).slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "ru"))}
              value={form[fieldToRender.name] ?? ""}
              placeholder="Не выбрана"
              allowClear={!fieldToRender.required}
              clearLabel="Не выбрана"
              searchable={(collections || []).length > 8}
              getKey={(c) => String(c.id)}
              getLabel={(c) => String(c?.name || "")}
              onChange={(next) =>
                setForm((prev) => ({
                  ...prev,
                  [fieldToRender.name]: next ? Number(next) : "",
                }))
              }
              buttonClassName="rounded-lg"
              popoverClassName="rounded-lg max-w-xl"
              maxHeightClassName="max-h-80"
            />
          ) : endpoint === "/modules" && fieldToRender.name === "description_id" ? (
            <PopoverSelect
              size="md"
              items={availableModuleDescriptions || []}
              value={form[fieldToRender.name] ?? ""}
              placeholder="Не выбран"
              allowClear
              clearLabel="Не выбран"
              searchable={(availableModuleDescriptions || []).length > 10}
              getKey={(d) => String(d.id)}
              getLabel={(d) => `#${d.id} ${d.base_sku} — ${d.name}`}
              onChange={(next) =>
                setForm((prev) => ({
                  ...prev,
                  [fieldToRender.name]: next ? Number(next) : "",
                }))
              }
              buttonClassName="rounded-lg"
              popoverClassName="rounded-lg max-w-2xl"
              maxHeightClassName="max-h-80"
            />
          ) : (
            (() => {
              const isMmNumberField =
                fieldToRender.type === "number" && typeof fieldToRender.name === "string" && fieldToRender.name.endsWith("_mm");

              if (endpoint === "/module-descriptions" && fieldToRender.name === "base_sku") {
                const current = String(form[fieldToRender.name] ?? "").toUpperCase();
                const prefix = selectedCategoryPrefix ? String(selectedCategoryPrefix).toUpperCase() : "";

                return (
                  <SecureInput
                    type={fieldToRender.type}
                    value={current}
                    onChange={(value) => {
                      const raw = String(value ?? "").toUpperCase();
                      if (!prefix) {
                        setForm((prev) => ({ ...prev, [fieldToRender.name]: raw }));
                        return;
                      }
                      const normalized = raw.startsWith(prefix)
                        ? raw
                        : `${prefix}${raw.replace(/^\s+/, "")}`;
                      setForm((prev) => ({ ...prev, [fieldToRender.name]: normalized }));
                    }}
                    placeholder={prefix ? `${prefix}...` : fieldToRender.placeholder}
                    required={fieldToRender.required}
                  />
                );
              }

              if (!isMmNumberField) {
                return (
                  <SecureInput
                    type={fieldToRender.type}
                    value={form[fieldToRender.name] ?? ""}
                    onChange={(value) => setForm((prev) => ({ ...prev, [fieldToRender.name]: value }))}
                    placeholder={fieldToRender.placeholder}
                    required={fieldToRender.required}
                  />
                );
              }

              const activeTab = sizePresetTabByField[fieldToRender.name] || "input";
              const presets = sizePresetsByField[fieldToRender.name] || [];
              const currentValue = form[fieldToRender.name] ?? "";
              const numericValue = Number(currentValue);
              const canSave = Number.isFinite(numericValue) && numericValue > 0;

              const savePreset = () => {
                if (!canSave) return;
                const next = Array.from(new Set([numericValue, ...presets])).sort((a, b) => a - b);
                setSizePresetsByField((prev) => ({ ...prev, [fieldToRender.name]: next }));
                try {
                  localStorage.setItem(getSizePresetStorageKey(fieldToRender.name), JSON.stringify(next));
                } catch {
                  // ignore
                }
              };

              const removePreset = (valueToRemove) => {
                const next = presets.filter((v) => Number(v) !== Number(valueToRemove));
                setSizePresetsByField((prev) => ({ ...prev, [fieldToRender.name]: next }));
                try {
                  localStorage.setItem(getSizePresetStorageKey(fieldToRender.name), JSON.stringify(next));
                } catch {
                  // ignore
                }
              };

              return (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <SecureButton
                      type="button"
                      variant={activeTab === "input" ? "primary" : "outline"}
                      className="px-3 py-2 text-xs"
                      onClick={() =>
                        setSizePresetTabByField((prev) => ({ ...prev, [fieldToRender.name]: "input" }))
                      }
                    >
                      Ввод
                    </SecureButton>
                    <SecureButton
                      type="button"
                      variant={activeTab === "presets" ? "primary" : "outline"}
                      className="px-3 py-2 text-xs"
                      onClick={() =>
                        setSizePresetTabByField((prev) => ({ ...prev, [fieldToRender.name]: "presets" }))
                      }
                    >
                      Шаблоны
                    </SecureButton>
                  </div>

                  {activeTab === "input" ? (
                    <div className="space-y-2">
                      <SecureInput
                        type={fieldToRender.type}
                        value={currentValue}
                        onChange={(value) => setForm((prev) => ({ ...prev, [fieldToRender.name]: value }))}
                        placeholder={fieldToRender.placeholder}
                        required={fieldToRender.required}
                      />
                      <SecureButton
                        type="button"
                        variant="outline"
                        disabled={!canSave}
                        className="px-3 py-2 text-xs"
                        onClick={savePreset}
                      >
                        Сохранить как шаблон
                      </SecureButton>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <PopoverSelect
                        size="md"
                        items={presets.map((v) => ({ v }))}
                        value={""}
                        placeholder="Выберите размер..."
                        searchable={presets.length > 10}
                        getKey={(it) => String(it.v)}
                        getLabel={(it) => `${it.v} мм`}
                        onChange={(next) => {
                          const v = Number(next);
                          if (!Number.isFinite(v)) return;
                          setForm((prev) => ({ ...prev, [fieldToRender.name]: v }));
                        }}
                        buttonClassName="rounded-lg"
                        popoverClassName="rounded-lg max-w-md"
                        maxHeightClassName="max-h-72"
                      />

                      {presets.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {presets.map((v) => (
                            <div
                              key={`preset-${fieldToRender.name}-${v}`}
                              className="flex items-center gap-1 border border-night-200 rounded-lg px-2 py-1 bg-white"
                            >
                              <button
                                type="button"
                                className="text-xs text-night-900"
                                onClick={() => setForm((prev) => ({ ...prev, [fieldToRender.name]: Number(v) }))}
                              >
                                {v} мм
                              </button>
                              <button
                                type="button"
                                className="text-xs text-red-600"
                                onClick={() => removePreset(v)}
                                aria-label="Удалить шаблон"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          )}
            </label>
          );

          if (canGroupColors) {
            const left = isPrimary && nextIsSecondary ? field : nextField;
            const right = isPrimary && nextIsSecondary ? nextField : field;

            rendered.push(
              <div key={`color-group-${left.name}-${right.name}`} className="space-y-3">
                <div className="relative py-2">
                  <div className="border-t border-night-200" />
                  <span className="absolute -top-2 left-3 px-2 text-xs text-night-500 bg-white/70">Выбор цвета</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderSingleField(left)}
                  {renderSingleField(right)}
                </div>
              </div>
            );
            i += 1;
            continue;
          }

          rendered.push(renderSingleField(field));
        }
        return rendered;
      })()}
    </div>
  );
};

export default EntityFormFields;
