import SecureButton from "../../ui/SecureButton";
import SecureInput from "../../ui/SecureInput";
import { getImageUrl } from "../../../utils/image";

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
  availableModuleDescriptions,
  selectedCategoryPrefix,
  sizePresetTabByField,
  setSizePresetTabByField,
  sizePresetsByField,
  setSizePresetsByField,
  getSizePresetStorageKey,
}) => {
  const fieldsToRender = endpoint === "/module-descriptions" && !filterModuleCategoryId ? [] : currentFields;

  return (
    <>
      {fieldsToRender.map((field) => (
        <label key={field.name} className="text-sm text-night-700 space-y-1">
          <span>{field.label}</span>
          {field.inputType === "image" ? (
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleUpload(field.name, event.target.files?.[0] || null)}
                className="block w-full text-xs text-night-600 file:mr-3 file:rounded-full file:border-0 file:bg-night-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-night-800"
              />
              {form[field.name] && (
                <img
                  src={getImageUrl(form[field.name])}
                  alt={field.label}
                  className="h-20 w-20 rounded-md object-cover border border-night-100"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    console.error("Ошибка загрузки изображения:", form[field.name]);
                    e.target.style.display = "none";
                  }}
                />
              )}
              {uploadingField === field.name && <p className="text-xs text-night-400">Загружаем файл...</p>}
            </div>
          ) : field.type === "select" ? (
            <select
              value={form[field.name] ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
              className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              required={field.required}
            >
              <option value="">Выберите...</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : field.type === "moduleCategory" ? (
            <select
              value={form[field.name] ?? ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  [field.name]: e.target.value ? Number(e.target.value) : "",
                }))
              }
              className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              required={field.required}
            >
              <option value="">Выберите...</option>
              {availableModuleCategories
                .slice()
                .sort((a, b) => Number(a.id) - Number(b.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          ) : field.type === "color" ? (
            <div className="space-y-2">
              <select
                value={form[field.name] ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [field.name]: e.target.value ? Number(e.target.value) : "",
                  }))
                }
                className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                required={field.required}
              >
                <option value="">Выберите цвет...</option>
                {colors.map((color) => (
                  <option key={color.id} value={color.id}>
                    {color.name}
                  </option>
                ))}
              </select>
              {form[field.name] &&
                (() => {
                  const selectedColor = colors.find((c) => c.id === Number(form[field.name]));
                  if (selectedColor && selectedColor.image_url) {
                    const imageUrl = getImageUrl(selectedColor.image_url);
                    return (
                      <div className="flex items-center gap-3 p-2 border border-night-200 rounded-lg bg-night-50">
                        <img
                          src={imageUrl}
                          alt={selectedColor.name}
                          className="h-12 w-12 rounded object-cover border border-night-200"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium text-night-900">{selectedColor.name}</p>
                          {selectedColor.sku && (
                            <p className="text-xs text-night-500">Артикул: {selectedColor.sku}</p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
            </div>
          ) : endpoint === "/modules" && field.name === "description_id" ? (
            <select
              value={form[field.name] ?? ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  [field.name]: e.target.value ? Number(e.target.value) : "",
                }))
              }
              className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              <option value="">Не выбран</option>
              {availableModuleDescriptions.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.id} {d.base_sku} — {d.name}
                </option>
              ))}
            </select>
          ) : (
            (() => {
              const isMmNumberField =
                field.type === "number" && typeof field.name === "string" && field.name.endsWith("_mm");

              if (endpoint === "/module-descriptions" && field.name === "base_sku") {
                const current = String(form[field.name] ?? "").toUpperCase();
                const prefix = selectedCategoryPrefix ? String(selectedCategoryPrefix).toUpperCase() : "";

                return (
                  <SecureInput
                    type={field.type}
                    value={current}
                    onChange={(value) => {
                      const raw = String(value ?? "").toUpperCase();
                      if (!prefix) {
                        setForm((prev) => ({ ...prev, [field.name]: raw }));
                        return;
                      }
                      const normalized = raw.startsWith(prefix)
                        ? raw
                        : `${prefix}${raw.replace(/^\s+/, "")}`;
                      setForm((prev) => ({ ...prev, [field.name]: normalized }));
                    }}
                    placeholder={prefix ? `${prefix}...` : field.placeholder}
                    required={field.required}
                  />
                );
              }

              if (!isMmNumberField) {
                return (
                  <SecureInput
                    type={field.type}
                    value={form[field.name] ?? ""}
                    onChange={(value) => setForm((prev) => ({ ...prev, [field.name]: value }))}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                );
              }

              const activeTab = sizePresetTabByField[field.name] || "input";
              const presets = sizePresetsByField[field.name] || [];
              const currentValue = form[field.name] ?? "";
              const numericValue = Number(currentValue);
              const canSave = Number.isFinite(numericValue) && numericValue > 0;

              const savePreset = () => {
                if (!canSave) return;
                const next = Array.from(new Set([numericValue, ...presets])).sort((a, b) => a - b);
                setSizePresetsByField((prev) => ({ ...prev, [field.name]: next }));
                try {
                  localStorage.setItem(getSizePresetStorageKey(field.name), JSON.stringify(next));
                } catch {
                  // ignore
                }
              };

              const removePreset = (valueToRemove) => {
                const next = presets.filter((v) => Number(v) !== Number(valueToRemove));
                setSizePresetsByField((prev) => ({ ...prev, [field.name]: next }));
                try {
                  localStorage.setItem(getSizePresetStorageKey(field.name), JSON.stringify(next));
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
                        setSizePresetTabByField((prev) => ({ ...prev, [field.name]: "input" }))
                      }
                    >
                      Ввод
                    </SecureButton>
                    <SecureButton
                      type="button"
                      variant={activeTab === "presets" ? "primary" : "outline"}
                      className="px-3 py-2 text-xs"
                      onClick={() =>
                        setSizePresetTabByField((prev) => ({ ...prev, [field.name]: "presets" }))
                      }
                    >
                      Шаблоны
                    </SecureButton>
                  </div>

                  {activeTab === "input" ? (
                    <div className="space-y-2">
                      <SecureInput
                        type={field.type}
                        value={currentValue}
                        onChange={(value) => setForm((prev) => ({ ...prev, [field.name]: value }))}
                        placeholder={field.placeholder}
                        required={field.required}
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
                      <select
                        value={""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          setForm((prev) => ({ ...prev, [field.name]: Number(v) }));
                        }}
                        className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                      >
                        <option value="">Выберите размер...</option>
                        {presets.map((v) => (
                          <option key={v} value={v}>
                            {v} мм
                          </option>
                        ))}
                      </select>

                      {presets.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {presets.map((v) => (
                            <div
                              key={`preset-${field.name}-${v}`}
                              className="flex items-center gap-1 border border-night-200 rounded-lg px-2 py-1 bg-white"
                            >
                              <button
                                type="button"
                                className="text-xs text-night-900"
                                onClick={() => setForm((prev) => ({ ...prev, [field.name]: Number(v) }))}
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
      ))}
    </>
  );
};

export default EntityFormFields;
