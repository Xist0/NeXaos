import { useEffect, useMemo, useRef, useState } from "react";
import SecureButton from "../../ui/SecureButton";
import SecureInput from "../../ui/SecureInput";
import { getImageUrl } from "../../../utils/image";
import FormField from "../../ui/FormField";
import FormSelect from "../../ui/FormSelect";
import ColorSelectDropdown from "../../ui/ColorSelectDropdown";

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

  return (
    <div className="space-y-4">
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

          const renderSingleField = (fieldToRender) => {
            const fRole = fieldToRender.colorRole || getColorFieldRole(fieldToRender.name);
            const isPrimaryField = fRole === "primary";
            const isSecondaryField = fRole === "secondary";

            if (fieldToRender.type === "checkbox") {
              return (
                <div key={fieldToRender.name} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        [fieldToRender.name]: !isCheckboxChecked(prev[fieldToRender.name]),
                      }))
                    }
                    className={
                      "relative inline-flex h-4 w-8 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent" +
                      (isCheckboxChecked(form[fieldToRender.name]) ? " bg-accent" : " bg-night-300")
                    }
                    aria-pressed={isCheckboxChecked(form[fieldToRender.name])}
                    title={fieldToRender.label}
                  >
                    <span
                      className={
                        "inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform" +
                        (isCheckboxChecked(form[fieldToRender.name]) ? " translate-x-4" : " translate-x-0.5")
                      }
                    />
                  </button>
                  <span className="text-sm text-night-700 font-medium">{fieldToRender.label}</span>
                </div>
              );
            }

            if (fieldToRender.inputType === "image") {
              return (
                <FormField key={fieldToRender.name} label={fieldToRender.label}>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        handleUpload(fieldToRender.name, file);
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
                </FormField>
              );
            }

            if (fieldToRender.type === "color") {
              const colorProps = {
                showFacade: isPrimaryField,
                showCorpus: isSecondaryField,
                facadeTitle: isPrimaryField ? "Основные цвета" : "Цвета",
                corpusTitle: isSecondaryField ? "Доп. цвета" : "Цвета",
                selectedClassName: isSecondaryField ? "border-green-500 bg-green-50" : "border-accent bg-accent/5",
              };
              return (
                <FormField key={fieldToRender.name} label={fieldToRender.label}>
                  <ColorSelectDropdown
                    colors={colors}
                    value={form[fieldToRender.name]}
                    onChange={(id) => setForm((prev) => ({ ...prev, [fieldToRender.name]: Number(id) || "" }))}
                    placeholder="Выберите цвет"
                    {...colorProps}
                  />
                </FormField>
              );
            }

            if (fieldToRender.type === "select") {
              return (
                <FormField key={fieldToRender.name} label={fieldToRender.label}>
                  <FormSelect
                    items={fieldToRender.options || []}
                    value={form[fieldToRender.name] ?? ""}
                    placeholder="Выберите..."
                    allowClear={!fieldToRender.required}
                    clearLabel="Выберите..."
                    getKey={(option) => String(option.value)}
                    getLabel={(option) => String(option.label ?? option.value ?? "")}
                    onChange={(next) => setForm((prev) => ({ ...prev, [fieldToRender.name]: String(next || "") }))}
                  />
                </FormField>
              );
            }

            if (fieldToRender.type === "moduleCategory") {
              return (
                <FormField key={fieldToRender.name} label={fieldToRender.label}>
                  <FormSelect
                    items={(availableModuleCategories || []).slice().sort((a, b) => Number(a.id) - Number(b.id))}
                    value={form[fieldToRender.name] ?? ""}
                    placeholder="Выберите..."
                    allowClear={!fieldToRender.required}
                    clearLabel="Выберите..."
                    getKey={(c) => String(c.id)}
                    getLabel={(c) => String(c?.name || "")}
                    onChange={(next) =>
                      setForm((prev) => ({
                        ...prev,
                        [fieldToRender.name]: next ? Number(next) : "",
                      }))
                    }
                  />
                </FormField>
              );
            }

            if (fieldToRender.type === "collection") {
              return (
                <FormField key={fieldToRender.name} label={fieldToRender.label}>
                  <FormSelect
                    items={(collections || []).slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "ru"))}
                    value={form[fieldToRender.name] ?? ""}
                    placeholder="Не выбрана"
                    allowClear={!fieldToRender.required}
                    clearLabel="Не выбрана"
                    getKey={(c) => String(c.id)}
                    getLabel={(c) => String(c?.name || "")}
                    onChange={(next) =>
                      setForm((prev) => ({
                        ...prev,
                        [fieldToRender.name]: next ? Number(next) : "",
                      }))
                    }
                  />
                </FormField>
              );
            }

            if (endpoint === "/modules" && fieldToRender.name === "description_id") {
              return (
                <FormField key={fieldToRender.name} label={fieldToRender.label}>
                  <FormSelect
                    items={availableModuleDescriptions || []}
                    value={form[fieldToRender.name] ?? ""}
                    placeholder="Не выбран"
                    allowClear
                    clearLabel="Не выбран"
                    getKey={(d) => String(d.id)}
                    getLabel={(d) => `#${d.id} ${d.base_sku} — ${d.name}`}
                    onChange={(next) =>
                      setForm((prev) => ({
                        ...prev,
                        [fieldToRender.name]: next ? Number(next) : "",
                      }))
                    }
                    popoverClassName="max-w-2xl"
                  />
                </FormField>
              );
            }

            // Number/Text fields with special _mm handling
            const isMmNumberField =
              fieldToRender.type === "number" && typeof fieldToRender.name === "string" && fieldToRender.name.endsWith("_mm");

            if (endpoint === "/module-descriptions" && fieldToRender.name === "base_sku") {
              const current = String(form[fieldToRender.name] ?? "").toUpperCase();
              const prefix = selectedCategoryPrefix ? String(selectedCategoryPrefix).toUpperCase() : "";

              return (
                <FormField key={fieldToRender.name} label={fieldToRender.label}>
                  <SecureInput
                    type={fieldToRender.type}
                    value={current}
                    onChange={(value) => {
                      const raw = String(value ?? "").toUpperCase();
                      if (!prefix) {
                        setForm((prev) => ({ ...prev, [fieldToRender.name]: raw }));
                        return;
                      }
                      const normalized = raw.startsWith(prefix) ? raw : `${prefix}${raw.replace(/^\s+/, "")}`;
                      setForm((prev) => ({ ...prev, [fieldToRender.name]: normalized }));
                    }}
                    placeholder={prefix ? `${prefix}...` : fieldToRender.placeholder}
                    required={fieldToRender.required}
                  />
                </FormField>
              );
            }

            if (!isMmNumberField) {
              const isDescriptionField = fieldToRender.name === "description";
              if (isDescriptionField) {
                return (
                  <FormField key={fieldToRender.name} label={fieldToRender.label}>
                    <textarea
                      className="secure-input w-full min-h-[80px] p-3 rounded-xl border border-night-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none resize-y"
                      value={form[fieldToRender.name] ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, [fieldToRender.name]: e.target.value }))}
                      placeholder={fieldToRender.placeholder}
                      required={fieldToRender.required}
                    />
                  </FormField>
                );
              }
              return (
                <FormField key={fieldToRender.name} label={fieldToRender.label}>
                  <SecureInput
                    type={fieldToRender.type}
                    value={form[fieldToRender.name] ?? ""}
                    onChange={(value) => setForm((prev) => ({ ...prev, [fieldToRender.name]: value }))}
                    placeholder={fieldToRender.placeholder}
                    required={fieldToRender.required}
                  />
                </FormField>
              );
            }

            // _mm number fields with presets
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
              <FormField key={fieldToRender.name} label={fieldToRender.label}>
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      {activeTab === "input" ? (
                        <SecureInput
                          type={fieldToRender.type}
                          value={currentValue}
                          onChange={(value) => setForm((prev) => ({ ...prev, [fieldToRender.name]: value }))}
                          placeholder={fieldToRender.placeholder}
                          required={fieldToRender.required}
                        />
                      ) : (
                        <FormSelect
                          items={presets.map((v) => ({ v }))}
                          value={""}
                          placeholder="Выберите размер..."
                          getKey={(it) => String(it.v)}
                          getLabel={(it) => `${it.v} мм`}
                          onChange={(next) => {
                            const v = Number(next);
                            if (!Number.isFinite(v)) return;
                            setForm((prev) => ({ ...prev, [fieldToRender.name]: v }));
                          }}
                          popoverClassName="max-w-md"
                          maxHeightClassName="max-h-72"
                        />
                      )}
                    </div>
                    <div className="flex gap-1">
                      <SecureButton
                        type="button"
                        variant={activeTab === "input" ? "primary" : "outline"}
                        className="px-3 py-2 text-xs h-10"
                        onClick={() =>
                          setSizePresetTabByField((prev) => ({ ...prev, [fieldToRender.name]: "input" }))
                        }
                        title="Ручной ввод"
                      >
                        Ввод
                      </SecureButton>
                      <SecureButton
                        type="button"
                        variant={activeTab === "presets" ? "primary" : "outline"}
                        className="px-3 py-2 text-xs h-10"
                        onClick={() =>
                          setSizePresetTabByField((prev) => ({ ...prev, [fieldToRender.name]: "presets" }))
                        }
                        title="Выбрать из шаблонов"
                      >
                        Шаблоны
                      </SecureButton>
                      {activeTab === "input" && (
                        <SecureButton
                          type="button"
                          variant="outline"
                          disabled={!canSave}
                          className="px-3 py-2 text-xs h-10"
                          onClick={savePreset}
                          title="Сохранить текущее значение как шаблон"
                        >
                          +
                        </SecureButton>
                      )}
                    </div>
                  </div>

                  {activeTab === "presets" && presets.length > 0 && (
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
              </FormField>
            );
          };

          if (canGroupColors) {
            const left = isPrimary && nextIsSecondary ? field : nextField;
            const right = isPrimary && nextIsSecondary ? nextField : field;

            rendered.push(
              <div key={`color-group-${left.name}-${right.name}`} className="border-t border-night-200 pt-4">
                <ColorSelectDropdown
                  colors={colors}
                  value={form[left.name]}
                  onChange={(id) => setForm((prev) => ({ ...prev, [left.name]: Number(id) || "" }))}
                  label={left.label}
                  showFacade={getColorFieldRole(left.name) === "primary"}
                  showCorpus={getColorFieldRole(left.name) === "secondary"}
                  selectedClassName={getColorFieldRole(left.name) === "secondary" ? "border-green-500 bg-green-50" : "border-accent bg-accent/5"}
                />
              </div>
            );

            rendered.push(
              <div key={`color-group-${right.name}`} className="border-t border-night-200 pt-4">
                <ColorSelectDropdown
                  colors={colors}
                  value={form[right.name]}
                  onChange={(id) => setForm((prev) => ({ ...prev, [right.name]: Number(id) || "" }))}
                  label={right.label}
                  showFacade={getColorFieldRole(right.name) === "primary"}
                  showCorpus={getColorFieldRole(right.name) === "secondary"}
                  selectedClassName={getColorFieldRole(right.name) === "secondary" ? "border-green-500 bg-green-50" : "border-accent bg-accent/5"}
                />
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