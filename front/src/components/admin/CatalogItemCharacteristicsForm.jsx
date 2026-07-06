import clsx from "clsx";
import { useMemo, useState } from "react";
import {
  CATALOG_ITEM_FORM_SECTIONS,
  DRAWERS_DETAIL_FIELD_KEY,
  isColorField,
  resolveFieldLabel,
} from "../../constants/catalogFormLayout";
import {
  colorDisplayValue,
  MATERIAL_SELECT_SOURCE_TYPES,
  PRODUCT_CHARACTERISTIC_FIELDS,
  resolveColorId,
} from "../../constants/productCharacteristics";
import { parseCharacteristicField } from "../../utils/characteristics";
import { formatCurrency } from "../../utils/format";
import CharacteristicCard from "../ui/CharacteristicCard";
import MultiTagSelect from "../ui/MultiTagSelect";
import ColorSelectDropdown from "../ui/ColorSelectDropdown";
import MaterialSelectField from "../ui/MaterialSelectField";
import DrawerSelectField from "../ui/DrawerSelectField";
import HingeSelectField from "../ui/HingeSelectField";
import FormSection from "../ui/FormSection";
import DrawerTypesMultiSelect from "./DrawerTypesMultiSelect";
import CatalogCalculationResults from "./CatalogCalculationResults";
import ModuleHardwareMatrixTable from "./kitchens/modules/ModuleHardwareMatrixTable";

const HARDWARE_CATEGORY_FIELDS = {
  lift_mechanism: "Подъемные механизмы",
};

const OTHER_MATERIALS_FIELDS = [
  { key: "supports_type", label: "Тип опор" },
  { key: "hangers_type", label: "Тип навесов" },
  { key: "lift_mechanism", label: "Подъёмный механизм" },
  { key: "drawers_detail", label: "Вид и кол-во ящиков" },
  { key: "hinges_detail", label: "Вид и кол-во Петель" },
];

/** Semi-transparent price badge shown next to fields that have a calculated breakdown value. */
const BreakdownPriceBadge = ({ amount }) => {
  if (!Number(amount) || Number(amount) <= 0) return null;
  return (
    <span className="ml-2 px-2 py-0.5 rounded-md text-xs font-medium bg-accent/15 text-accent/70 whitespace-nowrap select-none">
      {formatCurrency(Number(amount))}
    </span>
  );
};

const HARDWARE_SELECT_FIELD_KEYS = new Set(Object.keys(HARDWARE_CATEGORY_FIELDS));
const DRAWER_SELECT_FIELD_KEY = "drawers_detail";
const DRAWER_CATEGORY = "Выдвижные системы";
const HINGE_DETAIL_FIELD_KEY = "hinges_detail";
const HINGE_CATEGORY = "Петли";
const DIMENSION_FIELD_KEYS = new Set(["width_mm", "height_mm_char", "depth_mm_char"]);

const getColorDropdownProps = (colorRole) => {
  if (colorRole === "facade") {
    return { showFacade: true, showCorpus: false, showUniversal: true };
  }
  if (colorRole === "corpus") {
    return { showFacade: false, showCorpus: true, showUniversal: true };
  }
  return { showFacade: true, showCorpus: true, showUniversal: true };
};

const CatalogItemCharacteristicsForm = ({
  value,
  onChange,
  templatesByField = {},
  fieldLabels = {},
  colors = [],
  hardwareItems = [],
  hardwareMatrix = {},
  onHardwareMatrixChange,
  fasteningItems = [],
  materialsBySourceType = {},
  post,
  onPriceCalculated,
  onAreasCalculated,
  onFieldBreakdown,
  fieldBreakdown = {},
}) => {
  const form = value && typeof value === "object" ? value : {};

  const [hardwareCalcResult, setHardwareCalcResult] = useState({ rows: [], total: 0 });

  const updateField = (fieldKey, patch) => {
    const current = parseCharacteristicField(form[fieldKey]);
    onChange({
      ...form,
      [fieldKey]: { ...current, ...patch },
    });
  };

  const hardwareByCategory = useMemo(() => {
    const map = new Map();
    for (const item of hardwareItems) {
      const cat = String(item.category || "").trim();
      if (!cat) continue;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(item);
    }
    return map;
  }, [hardwareItems]);

  const getHardwareForField = (fieldKey) => {
    const category = HARDWARE_CATEGORY_FIELDS[fieldKey];
    if (!category) return [];
    return hardwareByCategory.get(category) || [];
  };

  const getMaterialItemsForField = (fieldKey) => {
    const def = PRODUCT_CHARACTERISTIC_FIELDS[fieldKey];
    if (!def?.selectType) return [];
    const sourceType = def.selectType;
    const allItems = materialsBySourceType[sourceType] || [];
    if (def.categoryFilter) {
      const filterLower = String(def.categoryFilter).trim().toLowerCase();
      return allItems.filter((item) => String(item.category || "").trim().toLowerCase() === filterLower);
    }
    return allItems;
  };

  const drawerHardwareItems = useMemo(() => {
    return hardwareByCategory.get(DRAWER_CATEGORY) || [];
  }, [hardwareByCategory]);

  const hingeHardwareItems = useMemo(() => {
    return hardwareByCategory.get(HINGE_CATEGORY) || [];
  }, [hardwareByCategory]);

  const renderColorField = (fieldKey) => {
    const def = PRODUCT_CHARACTERISTIC_FIELDS[fieldKey];
    if (!def) return null;

    const parsed = parseCharacteristicField(form[fieldKey]);
    const dropdownProps = getColorDropdownProps(def.colorRole);
    const selectedId = resolveColorId(colors, parsed.value);

    return (
      <div
        key={fieldKey}
        className={clsx(
          "rounded-xl border p-3 space-y-2 min-w-0 overflow-visible",
          parsed.visible ? "border-night-100 bg-white" : "border-night-100/60 bg-night-50/60"
        )}
      >
        <div className="flex items-center justify-between gap-2 min-h-[20px]">
          <div className="text-xs font-semibold text-night-800 leading-snug flex items-center">
            {resolveFieldLabel(fieldKey, fieldLabels)}
            <BreakdownPriceBadge amount={fieldBreakdown[fieldKey]} />
          </div>
          <button
            type="button"
            onClick={() => updateField(fieldKey, { visible: !parsed.visible })}
            className={clsx(
              "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent",
              parsed.visible ? "bg-accent" : "bg-night-300"
            )}
            aria-pressed={parsed.visible}
          >
            <span
              className={clsx(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                parsed.visible ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
        <div className={parsed.visible ? "min-w-0" : "opacity-50 pointer-events-none min-w-0"}>
          <ColorSelectDropdown
            colors={colors}
            value={selectedId}
            onChange={(id) => {
              const color = colors.find((c) => Number(c.id) === Number(id));
              updateField(fieldKey, { value: color ? colorDisplayValue(color) : "" });
            }}
            placeholder="Выберите цвет"
            disabled={!parsed.visible}
            {...dropdownProps}
            selectedClassName={
              def.colorRole === "corpus" ? "border-green-500 bg-green-50" : "border-accent bg-accent/5"
            }
          />
        </div>
      </div>
    );
  };

  const renderField = (fieldKey) => {
    if (isColorField(fieldKey)) return renderColorField(fieldKey);

    if (HARDWARE_SELECT_FIELD_KEYS.has(fieldKey)) {
      const parsed = parseCharacteristicField(form[fieldKey]);
      const bp = fieldBreakdown[fieldKey];
      return (
        <MaterialSelectField
          key={fieldKey}
          label={resolveFieldLabel(fieldKey, fieldLabels)}
          value={parsed.value}
          onChange={(v) => updateField(fieldKey, { value: v })}
          onVisibilityChange={(nextVisible) => updateField(fieldKey, { visible: nextVisible })}
          visible={parsed.visible}
          items={getHardwareForField(fieldKey)}
          priceKey="price_per_unit"
          priceLabel="за ед."
          extra={bp ? <BreakdownPriceBadge amount={bp} /> : null}
        />
      );
    }

    // Material-select fields (sheet, linear, sheet_all, sheet_countertop, hardware with categoryFilter)
    const fieldDef = PRODUCT_CHARACTERISTIC_FIELDS[fieldKey];
    if (fieldDef?.selectType) {
      const parsed = parseCharacteristicField(form[fieldKey]);
      const bp = fieldBreakdown[fieldKey];
      const items = getMaterialItemsForField(fieldKey);
      const priceKey = fieldDef.priceKey || "price_per_m2";
      const priceLabel = priceKey === "price_per_unit" ? "за ед." : "за м²";
      return (
        <MaterialSelectField
          key={fieldKey}
          label={resolveFieldLabel(fieldKey, fieldLabels)}
          value={parsed.value}
          onChange={(v) => updateField(fieldKey, { value: v })}
          onVisibilityChange={(nextVisible) => updateField(fieldKey, { visible: nextVisible })}
          visible={parsed.visible}
          items={items}
          priceKey={priceKey}
          priceLabel={priceLabel}
          extra={bp ? <BreakdownPriceBadge amount={bp} /> : null}
        />
      );
    }

    if (fieldKey === DRAWER_SELECT_FIELD_KEY && drawerHardwareItems.length > 0) {
      const parsed = parseCharacteristicField(form[fieldKey]);
      const bp = fieldBreakdown[fieldKey];
      return (
        <DrawerSelectField
          key={fieldKey}
          label={resolveFieldLabel(fieldKey, fieldLabels)}
          value={parsed.value}
          onChange={(v) => updateField(fieldKey, { value: v })}
          onVisibilityChange={(nextVisible) => updateField(fieldKey, { visible: nextVisible })}
          visible={parsed.visible}
          items={drawerHardwareItems}
          extra={bp ? <BreakdownPriceBadge amount={bp} /> : null}
        />
      );
    }

    if (fieldKey === HINGE_DETAIL_FIELD_KEY && hingeHardwareItems.length > 0) {
      const parsed = parseCharacteristicField(form[fieldKey]);
      const bp = fieldBreakdown[fieldKey];
      return (
        <HingeSelectField
          key={fieldKey}
          label={resolveFieldLabel(fieldKey, fieldLabels)}
          value={parsed.value}
          onChange={(v) => updateField(fieldKey, { value: v })}
          onVisibilityChange={(nextVisible) => updateField(fieldKey, { visible: nextVisible })}
          visible={parsed.visible}
          items={hingeHardwareItems}
          extra={bp ? <BreakdownPriceBadge amount={bp} /> : null}
        />
      );
    }

    if (fieldKey === DRAWERS_DETAIL_FIELD_KEY) {
      const parsed = parseCharacteristicField(form[fieldKey]);
      return (
        <DrawerTypesMultiSelect
          key={fieldKey}
          label={resolveFieldLabel(fieldKey, fieldLabels)}
          value={parsed.value}
          onChange={(v) => updateField(fieldKey, { value: v })}
          suggestions={templatesByField[fieldKey] || []}
          visible={parsed.visible}
          onVisibilityChange={(nextVisible) => updateField(fieldKey, { visible: nextVisible })}
        />
      );
    }

    if (DIMENSION_FIELD_KEYS.has(fieldKey)) {
      const parsed = parseCharacteristicField(form[fieldKey]);
      const rawNumber = String(parsed.value ?? "").trim();
      return (
        <div
          key={fieldKey}
          className={clsx(
            "rounded-xl border p-3 space-y-2 min-w-0",
            parsed.visible ? "border-night-100 bg-white" : "border-night-100/60 bg-night-50/60"
          )}
        >
          <div className="flex items-center justify-between gap-2 min-h-[20px]">
            <div className="text-xs font-semibold text-night-800 leading-snug">{resolveFieldLabel(fieldKey, fieldLabels)}</div>
            <button
              type="button"
              onClick={() => updateField(fieldKey, { visible: !parsed.visible })}
              className={clsx(
                "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent",
                parsed.visible ? "bg-accent" : "bg-night-300"
              )}
              aria-pressed={parsed.visible}
            >
              <span
                className={clsx(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  parsed.visible ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
          <input
            type="number"
            min={0}
            step={1}
            value={rawNumber === "" ? "" : Number(rawNumber) || ""}
            onChange={(e) => updateField(fieldKey, { value: e.target.value })}
            disabled={!parsed.visible}
            className={clsx(
              "w-full h-10 px-3 py-2 border border-night-200 bg-white text-sm text-night-900 rounded-xl",
              "focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-night-50"
            )}
          />
        </div>
      );
    }

    // Multi-select fields — множественный выбор из suggestions (теги)
    if (fieldDef?.fieldType === "multi_select") {
      const parsed = parseCharacteristicField(form[fieldKey]);
      const bp = fieldBreakdown[fieldKey];
      return (
        <div
          key={fieldKey}
          className={clsx(
            "rounded-xl border p-3 space-y-2 min-w-0 overflow-visible",
            parsed.visible ? "border-night-100 bg-white" : "border-night-100/60 bg-night-50/60"
          )}
        >
          <div className="flex items-center justify-between gap-2 min-h-[20px]">
            <div className="text-xs font-semibold text-night-800 leading-snug flex items-center">
              {resolveFieldLabel(fieldKey, fieldLabels)}
              {bp ? <BreakdownPriceBadge amount={bp} /> : null}
            </div>
            <button
              type="button"
              onClick={() => updateField(fieldKey, { visible: !parsed.visible })}
              className={clsx(
                "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent",
                parsed.visible ? "bg-accent" : "bg-night-300"
              )}
              aria-pressed={parsed.visible}
            >
              <span
                className={clsx(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  parsed.visible ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
          <MultiTagSelect
            value={parsed.value}
            onChange={(v) => updateField(fieldKey, { value: v })}
            suggestions={templatesByField[fieldKey] || []}
            disabled={!parsed.visible}
            placeholder="Выберите типы..."
          />
        </div>
      );
    }

    const parsed = parseCharacteristicField(form[fieldKey]);
    const bp = fieldBreakdown[fieldKey];
    return (
      <CharacteristicCard
        key={fieldKey}
        label={resolveFieldLabel(fieldKey, fieldLabels)}
        value={parsed.value}
        onChange={(v) => updateField(fieldKey, { value: v })}
        visible={parsed.visible}
        onVisibilityChange={(nextVisible) => updateField(fieldKey, { visible: nextVisible })}
        suggestions={templatesByField[fieldKey] || []}
        extra={bp ? <BreakdownPriceBadge amount={bp} /> : null}
      />
    );
  };

  const readChar = (key) => {
    const parsed = parseCharacteristicField(form[key]);
    const n = Number(String(parsed.value ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const calcPayload = {
    width_mm: readChar("width_mm"),
    height_mm: readChar("height_mm_char"),
    depth_mm: readChar("depth_mm_char"),
    front_count: readChar("front_count"),
    characteristics: Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, parseCharacteristicField(v).value])
    ),
    hardwareMatrix: hardwareMatrix || {},
  };

  const hasDimensions = calcPayload.width_mm > 0 && calcPayload.height_mm > 0 && calcPayload.depth_mm > 0;

  const handleAreasCalculated = (areas) => {
    if (!areas) return;
    const patches = {};
    if (areas.corpusArea != null) patches.s_corpus = { value: String(Number(areas.corpusArea).toFixed(4)), visible: true };
    if (areas.corpusPerimeter != null) patches.p_corpus = { value: String(Number(areas.corpusPerimeter).toFixed(4)), visible: true };
    if (areas.drawersArea != null) patches.s_drawers = { value: String(Number(areas.drawersArea).toFixed(4)), visible: true };
    if (areas.drawersPerimeter != null) patches.p_drawers = { value: String(Number(areas.drawersPerimeter).toFixed(4)), visible: true };
    if (areas.facadeArea != null) patches.s_facade = { value: String(Number(areas.facadeArea).toFixed(4)), visible: true };
    if (areas.facadePerimeter != null) patches.p_facade = { value: String(Number(areas.facadePerimeter).toFixed(4)), visible: true };
    if (Object.keys(patches).length > 0) {
      onChange({ ...form, ...patches });
    }
    onAreasCalculated?.(areas);
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-night-500">
        Заполните параметры по разделам. Варианты списков настраиваются в «Параметры каталога».
        Цвета и материалы — из существующих справочников.
      </p>

      {CATALOG_ITEM_FORM_SECTIONS.map((section) => {
        if (section.id === "other_materials") {
          return (
            <FormSection key="other_materials" title="Прочие материалы">
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-start">
                {OTHER_MATERIALS_FIELDS.map((f) => renderField(f.key))}
              </div>
            </FormSection>
          );
        }
        return (
          <FormSection key={section.id} title={section.title}>
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 items-start">
              {section.columns.map((columnKeys, colIdx) => (
                <div key={colIdx} className="space-y-3 min-w-0">
                  {columnKeys.map((fieldKey) => renderField(fieldKey))}
                </div>
              ))}
            </div>
          </FormSection>
        );
      })}

      {fasteningItems.length > 0 ? (
        <ModuleHardwareMatrixTable
          items={fasteningItems}
          matrix={hardwareMatrix}
          onChange={onHardwareMatrixChange}
          calculatedRows={hardwareCalcResult.rows || []}
          total={hardwareCalcResult.total ?? 0}
        />
      ) : null}

      {post && hasDimensions ? (
        <CatalogCalculationResults post={post} payload={calcPayload} onPriceCalculated={onPriceCalculated} onAreasCalculated={handleAreasCalculated} onFieldBreakdown={onFieldBreakdown} onHardwareCalculated={setHardwareCalcResult} />
      ) : post ? (
        <p className="text-xs text-night-400 pt-4 border-t border-night-200">
          Укажите габариты (ширина, высота, глубина) для автоматического расчёта стоимости.
        </p>
      ) : null}
    </div>
  );
};

export default CatalogItemCharacteristicsForm;
