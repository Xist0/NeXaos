import {

  PRODUCT_CHARACTERISTIC_FIELDS,

  PRODUCT_CHARACTERISTIC_EDITOR_SECTIONS,

} from "../../constants/productCharacteristics";

import { parseCharacteristicField } from "../../utils/characteristics";

import CharacteristicCard from "../ui/CharacteristicCard";

import FormSection from "../ui/FormSection";

import ProductColorCharacteristicsBlock from "./ProductColorCharacteristicsBlock";



const ProductCharacteristicsEditor = ({

  value,

  onChange,

  templatesByField = {},

  catalogSections = null,

  fieldLabels = {},

  colors = [],

  primaryColorId = "",

  secondaryColorId = "",

  onPrimaryColorChange,

  onSecondaryColorChange,

  colorPickerRef,

  showColorSection = true,

}) => {

  const form = value && typeof value === "object" ? value : {};

  const useCatalog = Array.isArray(catalogSections) && catalogSections.length > 0;



  const renderField = (fieldKey, labelOverride) => {

    const def = PRODUCT_CHARACTERISTIC_FIELDS[fieldKey];

    const label = labelOverride || def?.label || fieldLabels[fieldKey] || fieldKey;

    const parsed = parseCharacteristicField(form[fieldKey]);



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

        ? catalogSections.map((section) => (

            <FormSection key={section.id} title={section.title}>

              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start">

                {section.fields.map((field) => renderField(field.key, field.label))}

              </div>

            </FormSection>

          ))

        : PRODUCT_CHARACTERISTIC_EDITOR_SECTIONS.filter((section) => section.id === "general").map((section) => (

            <FormSection key={section.id} title={section.title}>

              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start">

                {section.rows.flatMap((rowKeys) => rowKeys.map((fieldKey) => renderField(fieldKey)).filter(Boolean))}

              </div>

            </FormSection>

          ))}



      {showColorSection ? (

        <ProductColorCharacteristicsBlock

          value={form}

          onChange={onChange}

          colors={colors}

          primaryColorId={primaryColorId}

          secondaryColorId={secondaryColorId}

          onPrimaryColorChange={onPrimaryColorChange}

          onSecondaryColorChange={onSecondaryColorChange}

          colorPickerRef={colorPickerRef}

        />

      ) : null}



      {!useCatalog

        ? PRODUCT_CHARACTERISTIC_EDITOR_SECTIONS.filter((section) => section.id !== "general").map((section) => (

            <FormSection key={section.id} title={section.title}>

              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start">

                {section.rows.flatMap((rowKeys) => rowKeys.map((fieldKey) => renderField(fieldKey)).filter(Boolean))}

              </div>

            </FormSection>

          ))

        : null}

    </div>

  );

};



export default ProductCharacteristicsEditor;


