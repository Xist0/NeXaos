import {
    PRODUCT_CHARACTERISTIC_FIELDS,
    PRODUCT_CHARACTERISTIC_EDITOR_SECTIONS,
    PRODUCT_CHARACTERISTIC_DIMENSIONS_SECTION,
} from "../../constants/productCharacteristics";
import { parseCharacteristicField } from "../../utils/characteristics";
import CharacteristicCard from "../ui/CharacteristicCard";
import MaterialSelectField from "../ui/MaterialSelectField";
import DrawerSelectField from "../ui/DrawerSelectField";
import HingeSelectField from "../ui/HingeSelectField";
import FormSection from "../ui/FormSection";
import { formatCurrency } from "../../utils/format";

const PRICE_LABELS = {
    price_per_m2: "за м²",
    price_per_unit: "за ед.",
    price_per_sheet: "за лист",
    edge_price_per_m: "за м",
};

const DIMENSION_FIELD_KEYS = ["width_mm", "height_mm_char", "depth_mm_char"];

const OTHER_MATERIALS_KEYS = ["supports_type", "hangers_type", "lift_mechanism", "drawers_detail", "hinges_detail"];
const OTHER_MATERIALS_SECTION_TITLES = ["Прочие материалы", "Прочее"];

/** Semi-transparent price badge shown next to fields that have a calculated breakdown value. */
const BreakdownPriceBadge = ({ amount }) => {
  if (!Number(amount) || Number(amount) <= 0)
  return null;
  return (
    <span className="ml-2 px-2 py-0.5 rounded-md text-xs font-medium bg-accent/15 text-accent/70 whitespace-nowrap select-none">
      {formatCurrency(Number(amount))}
    </span>
  );
};

const ProductCharacteristicsEditor = ({
    value,
    onChange,
    templatesByField = {},
    catalogSections = null,
    fieldLabels = {},
    materialsBySourceType = {},
    fieldBreakdown = {},
}) => {
    const form = value && typeof value === "object" ? value : {};
    const useCatalog = Array.isArray(catalogSections) && catalogSections.length > 0;
    const hardwareItems = materialsBySourceType.hardware || [];

    const isOtherMaterialsSection = (section) => {
      if (section.id === "other_materials") return true;
      const title = String(section.title || "").trim();
      if (OTHER_MATERIALS_SECTION_TITLES.includes(title)) return true;
      if (section.fields?.some((f) => OTHER_MATERIALS_KEYS.includes(f.key))) return true;
      return false;
    };

    const renderField = (fieldKey, labelOverride) => {
        const def = PRODUCT_CHARACTERISTIC_FIELDS[fieldKey];
        const label = labelOverride || def?.label || fieldLabels[fieldKey] || fieldKey;
        const parsed = parseCharacteristicField(form[fieldKey]);
        const breakdownPrice =
            fieldBreakdown[fieldKey] ??
            (fieldKey === "drawers_type" ? fieldBreakdown.hinges_type : undefined) ??
            (fieldKey === "hinges_detail" ? fieldBreakdown.hinges_detail : undefined);

        // ReadOnly fields — disabled display
        if (def?.readOnly) {
            return (
                <CharacteristicCard
                    key={fieldKey}
                    label={label}
                    value={parsed.value}
                    onChange={() => {}}
                    visible={parsed.visible}
                    onVisibilityChange={(nextVisible) => {
                        const current = parseCharacteristicField(form[fieldKey]);
                        onChange({
                            ...form,
                            [fieldKey]: { ...current, visible: nextVisible },
                        });
                    }}
                    disabled={true}
                    suggestions={[]}
                    extra={breakdownPrice ? <BreakdownPriceBadge amount={breakdownPrice} /> : null}
                />
            );
        }

        // Drawer select — специальный тип для ящиков
        if (def?.fieldType === "drawer_select") {
            const drawerItems = def?.categoryFilter
                ? hardwareItems.filter((i) => String(i.category || "").trim().toLowerCase() === String(def.categoryFilter).trim().toLowerCase())
                : hardwareItems;
            if (drawerItems.length === 0) {
                // Нет фурнитуры данной категории — fallback на CharacteristicCard
                return (
                    <CharacteristicCard
                        key={fieldKey}
                        label={label}
                        value={parsed.value}
                        onChange={(v) => {
                            const current = parseCharacteristicField(form[fieldKey]);
                            onChange({ ...form, [fieldKey]: { ...current, value: v } });
                        }}
                        visible={parsed.visible}
                        onVisibilityChange={(nextVisible) => {
                            const current = parseCharacteristicField(form[fieldKey]);
                            onChange({ ...form, [fieldKey]: { ...current, visible: nextVisible } });
                        }}
                        suggestions={templatesByField[fieldKey] || []}
                        extra={breakdownPrice ? <BreakdownPriceBadge amount={breakdownPrice} /> : null}
                    />
                );
            }
            return (
                <DrawerSelectField
                    key={fieldKey}
                    label={label}
                    value={parsed.value}
                    onChange={(v) => {
                        const current = parseCharacteristicField(form[fieldKey]);
                        onChange({
                            ...form,
                            [fieldKey]: { ...current, value: v },
                        });
                    }}
                    visible={parsed.visible}
                    onVisibilityChange={(nextVisible) => {
                        const current = parseCharacteristicField(form[fieldKey]);
                        onChange({
                            ...form,
                            [fieldKey]: { ...current, visible: nextVisible },
                        });
                    }}
                    items={drawerItems}
                    extra={breakdownPrice ? <BreakdownPriceBadge amount={breakdownPrice} /> : null}
                />
            );
        }

        // Hinge select — специальный тип для петель (hardware-items-based multi-select с кол-во)
        if (def?.fieldType === "hinge_select") {
            const hingeItems = def?.categoryFilter
                ? hardwareItems.filter((i) => String(i.category || "").trim().toLowerCase() === String(def.categoryFilter).trim().toLowerCase())
                : hardwareItems;
            if (hingeItems.length === 0) {
                // Нет фурнитуры данной категории — fallback на CharacteristicCard
                return (
                    <CharacteristicCard
                        key={fieldKey}
                        label={label}
                        value={parsed.value}
                        onChange={(v) => {
                            const current = parseCharacteristicField(form[fieldKey]);
                            onChange({ ...form, [fieldKey]: { ...current, value: v } });
                        }}
                        visible={parsed.visible}
                        onVisibilityChange={(nextVisible) => {
                            const current = parseCharacteristicField(form[fieldKey]);
                            onChange({ ...form, [fieldKey]: { ...current, visible: nextVisible } });
                        }}
                        suggestions={templatesByField[fieldKey] || []}
                        extra={breakdownPrice ? <BreakdownPriceBadge amount={breakdownPrice} /> : null}
                    />
                );
            }
            return (
                <HingeSelectField
                    key={fieldKey}
                    label={label}
                    value={parsed.value}
                    onChange={(v) => {
                        const current = parseCharacteristicField(form[fieldKey]);
                        onChange({
                            ...form,
                            [fieldKey]: { ...current, value: v },
                        });
                    }}
                    visible={parsed.visible}
                    onVisibilityChange={(nextVisible) => {
                        const current = parseCharacteristicField(form[fieldKey]);
                        onChange({
                            ...form,
                            [fieldKey]: { ...current, visible: nextVisible },
                        });
                    }}
                    items={hingeItems}
                    extra={breakdownPrice ? <BreakdownPriceBadge amount={breakdownPrice} /> : null}
                />
            );
        }

        // Material/Hardware select — выпадающий список из базы
        const fieldDef = PRODUCT_CHARACTERISTIC_FIELDS[fieldKey];
        if (fieldDef?.selectType) {
            const sourceType = fieldDef.selectType;
            // When categoryFilterFrom is active and resolved, use the broader source type
            // so items from excluded categories (like Пиломатериал) can appear when filtered by category
            const effectiveSourceType = fieldDef.categoryFilterFromSourceType || sourceType;
            let items = materialsBySourceType[effectiveSourceType] || [];

            // Статический фильтр по категории (например, "Пленка под фрезу")
            if (fieldDef?.categoryFilter) {
                const filterLower = String(fieldDef.categoryFilter).trim().toLowerCase();
                items = items.filter((i) => String(i.category || "").trim().toLowerCase() === filterLower);
            }

            // Динамический фильтр по значению другого поля (например, categoryFilterFrom: "material_corpus")
            if (fieldDef?.categoryFilterFrom) {
                const sourceFieldValue = parseCharacteristicField(form[fieldDef.categoryFilterFrom]).value;
                if (sourceFieldValue) {
                    // Look up the selected item to get its category, not compare name vs category
                    const sourceFieldDef = PRODUCT_CHARACTERISTIC_FIELDS[fieldDef.categoryFilterFrom];
                    const sourceItems = materialsBySourceType[sourceFieldDef?.selectType] || [];
                    const sourceItem = sourceItems.find((i) => String(i.name || "").trim() === String(sourceFieldValue).trim());
                    const filterCategory = sourceItem?.category || sourceFieldValue;
                    items = items.filter((i) => String(i.category || "").trim() === String(filterCategory).trim());
                } else {
                    // No source field selected — fall back to the narrower selectType (sheet_pure etc.)
                    items = materialsBySourceType[sourceType] || [];
                }
            }

            const priceKey = fieldDef.priceKey || "price_per_m2";
            const priceLabel = PRICE_LABELS[priceKey] || "за м²";
            // Для sheet_category — не показываем цену (это просто категория)
            const isCategorySelect = sourceType === "sheet_category";

            return (
                <MaterialSelectField
                    key={fieldKey}
                    label={label}
                    value={parsed.value}
                    onChange={(v, item) => {
                        const current = parseCharacteristicField(form[fieldKey]);
                        const nextForm = { ...form, [fieldKey]: { ...current, value: v } };

                        // При смене материала — очистить зависимый цвет, если он не принадлежит новой категории
                        if (fieldDef?.categoryFilterFromKey) {
                            const depKey = fieldDef.categoryFilterFromKey;
                            const depDef = PRODUCT_CHARACTERISTIC_FIELDS[depKey];
                            if (depDef?.categoryFilterFrom === fieldKey) {
                                const depValue = parseCharacteristicField(form[depKey]).value;
                                const selectedCategory = item?.category || v;
                                const depItems = materialsBySourceType[depDef.selectType] || [];
                                const belongs = depItems.some((i) => String(i.name || "").trim() === String(depValue).trim() && String(i.category || "").trim() === String(selectedCategory).trim());
                                if (!belongs) {
                                    nextForm[depKey] = { ...parseCharacteristicField(form[depKey]), value: "" };
                                }
                            }
                        }

                        onChange(nextForm);
                    }}
                    visible={parsed.visible}
                    onVisibilityChange={(nextVisible) => {
                        const current = parseCharacteristicField(form[fieldKey]);
                        onChange({ ...form, [fieldKey]: { ...current, visible: nextVisible } });
                    }}
                    items={items}
                    priceKey={isCategorySelect ? null : priceKey}
                    priceLabel={isCategorySelect ? null : priceLabel}
                    extra={breakdownPrice ? <BreakdownPriceBadge amount={breakdownPrice} /> : null}
                />
            );
        }

        // Default — dimension fields rendered as number inputs
        if (DIMENSION_FIELD_KEYS.includes(fieldKey)) {
            return (
                <div
                    key={fieldKey}
                    className={`rounded-xl border p-3 space-y-2 min-w-0 ${
                        parsed.visible ? "border-night-100 bg-white" : "border-night-100/60 bg-night-50/60"
                    }`}
                >
                    <div className="flex items-center justify-between gap-2 min-h-[20px]">
                        <div className="text-xs font-semibold text-night-800 leading-snug">{label}</div>
                        <button
                            type="button"
                            onClick={() => {
                                const current = parseCharacteristicField(form[fieldKey]);
                                onChange({ ...form, [fieldKey]: { ...current, visible: !parsed.visible } });
                            }}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${
                                parsed.visible ? "bg-accent" : "bg-night-300"
                            }`}
                            aria-pressed={parsed.visible}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                    parsed.visible ? "translate-x-4" : "translate-x-0.5"
                                }`}
                            />
                        </button>
                    </div>
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={String(parsed.value ?? "").trim() === "" ? "" : Number(parsed.value) || ""}
                        onChange={(e) => {
                            const current = parseCharacteristicField(form[fieldKey]);
                            onChange({ ...form, [fieldKey]: { ...current, value: e.target.value } });
                        }}
                        disabled={!parsed.visible}
                        className={`w-full h-10 px-3 py-2 border border-night-200 bg-white text-sm text-night-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-night-50`}
                    />
                </div>
            );
        }

        // Default — обычный текстовый ввод с подсказками
        return (
            <CharacteristicCard
                key={fieldKey}
                label={label}
                value={parsed.value}
                onChange={(v) => {
                    const current = parseCharacteristicField(form[fieldKey]);
                    onChange({
                        ...form,
                        [fieldKey]: { ...current, value: v },
                    });
                }}
                visible={parsed.visible}
                onVisibilityChange={(nextVisible) => {
                    const current = parseCharacteristicField(form[fieldKey]);
                    onChange({
                        ...form,
                        [fieldKey]: { ...current, visible: nextVisible },
                    });
                }}
                suggestions={templatesByField[fieldKey] || []}
                extra={breakdownPrice ? <BreakdownPriceBadge amount={breakdownPrice} /> : null}
            />
        );
    };

    return (
        <div className="space-y-8">
            <p className="text-sm text-night-500">
                Заполните характеристики по категориям. Варианты подставляются из раздела «Параметры каталога».
                Пункты с выключенным переключателем не показываются на странице товара.
            </p>

            {useCatalog
                ? catalogSections.map((section) => {
                    const isOther = isOtherMaterialsSection(section);
                    const cols = isOther ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
                    return (
                      <FormSection key={section.id} title={section.title}>
                          <div className={`grid gap-3 ${cols} items-start`}>
                              {section.fields.map((field) => renderField(field.key, field.label))}
                          </div>
                      </FormSection>
                    );
                })
                : PRODUCT_CHARACTERISTIC_EDITOR_SECTIONS.map((section) => {
                    if (section.id === "extra") return null;
                    return (
                      <FormSection key={section.id} title={section.title}>
                          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start">
                              {section.rows.flatMap((rowKeys) => rowKeys.map((fieldKey) => renderField(fieldKey)).filter(Boolean))}
                          </div>
                      </FormSection>
                    );
                })}

            <FormSection title="Габариты">
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 items-start">
                    {DIMENSION_FIELD_KEYS.map((fieldKey) => renderField(fieldKey))}
                </div>
            </FormSection>

            {PRODUCT_CHARACTERISTIC_EDITOR_SECTIONS.filter((s) => s.id === "extra").map((section) => (
                <FormSection key={section.id} title={section.title}>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start">
                        {section.rows.flatMap((rowKeys) => rowKeys.map((fieldKey) => renderField(fieldKey)).filter(Boolean))}
                    </div>
                </FormSection>
            ))}
        </div>
    );
};

export default ProductCharacteristicsEditor;
