import { useRef } from "react";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import FormSelect from "../ui/FormSelect";
import EditableSelect from "../ui/EditableSelect";
import SmallButton from "./ui/SmallButton";

const ProductParametersBlock = ({
  productParameterItems,
  productParameterCategoryItems,
  referenceData,
  selectedParameters,
  selectedParameterCategories,
  parameterTemplatesById,
  ensureParameterTemplatesLoaded,
  addParameter,
  updateParameterValue,
  updateParameterQty,
  removeParameter,
  addParameterCategory,
  removeParameterCategory,
  templatesOverlayOpen = false,
  setTemplatesOverlayOpen,
  allTemplatesLoading = false,
  allTemplates = [],
  openTemplatesOverlay,
  applyTemplateToParameter,
  templatesPopoverRef,
  showGlobalTemplates = false,
}) => (
  <>
    <div className="space-y-3 border-t border-night-200 pt-6">
      <div className="text-sm font-semibold text-night-900">Параметры</div>
      <div className="relative flex flex-wrap items-center gap-2">
        <div className="min-w-0 w-56">
          <FormSelect
            size="sm"
            items={productParameterItems}
            value={""}
            placeholder="Параметр…"
            getKey={(p) => String(p.id)}
            getLabel={(p) => `#${p.id} ${p.name}`}
            onChange={(next) => {
              const v = String(next || "");
              if (!v) return;
              addParameter(v);
            }}
          />
        </div>
        {showGlobalTemplates ? (
          <SmallButton
            variant="outline"
            className="whitespace-nowrap rounded-2xl"
            onClick={() => {
              if (templatesOverlayOpen) {
                setTemplatesOverlayOpen?.(false);
                return;
              }
              void openTemplatesOverlay?.();
            }}
          >
            Шаблоны параметров
          </SmallButton>
        ) : null}

        {showGlobalTemplates && templatesOverlayOpen ? (
          <div ref={templatesPopoverRef} className="absolute left-0 top-full mt-2 z-50 w-full max-w-xl">
            <div className="border border-night-200 rounded-lg bg-white shadow-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-night-100 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-night-700">Выберите шаблон</div>
                <SmallButton onClick={() => setTemplatesOverlayOpen(false)}>
                  Закрыть
                </SmallButton>
              </div>
              {allTemplatesLoading ? <div className="px-3 py-3 text-sm text-night-600">Загрузка…</div> : null}
              {!allTemplatesLoading && allTemplates.length === 0 ? (
                <div className="px-3 py-3 text-sm text-night-600">Шаблоны не найдены</div>
              ) : null}
              {!allTemplatesLoading && allTemplates.length > 0 ? (
                <div className="max-h-64 overflow-auto">
                  {allTemplates
                    .slice()
                    .sort((a, b) => {
                      const pa = referenceData.productParameters.find((x) => Number(x?.id) === Number(a?.parameter_id));
                      const pb = referenceData.productParameters.find((x) => Number(x?.id) === Number(b?.parameter_id));
                      const n = String(pa?.name || "").localeCompare(String(pb?.name || ""), "ru");
                      if (n !== 0) return n;
                      return String(a?.value || "").localeCompare(String(b?.value || ""), "ru");
                    })
                    .map((t) => {
                      const pid = Number(t?.parameter_id);
                      const full = referenceData.productParameters.find((x) => Number(x?.id) === pid);
                      const labelValue = String(t?.value || "").trim();
                      const labelQty = Number(t?.quantity);
                      const qty = Number.isFinite(labelQty) && labelQty > 0 ? labelQty : 1;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-night-50 transition-colors border-b border-night-100 last:border-b-0"
                          onClick={() => {
                            applyTemplateToParameter({ parameterId: pid, template: t });
                            setTemplatesOverlayOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-night-900 truncate">{full?.name || `#${pid}`}</div>
                            </div>
                            <div className="text-xs text-night-700 truncate max-w-[12rem]">{labelValue || "—"}</div>
                            <div className="text-xs text-night-500 shrink-0">×{qty}</div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {selectedParameters.length > 0 ? (
        <div className="space-y-2">
          {selectedParameters.map((p, idx) => {
            const full = referenceData.productParameters.find((x) => Number(x.id) === Number(p.parameterId));
            const templates = parameterTemplatesById[String(p.parameterId)] || null;
            if (templates === null) {
              void ensureParameterTemplatesLoaded(p.parameterId);
            }
            return (
              <div
                key={`${p.parameterId}-${idx}`}
                className="flex items-center gap-3 border border-night-200 rounded-lg p-3 bg-white"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-night-900 truncate">{full?.name || `#${p.parameterId}`}</div>
                  <div className="text-xs text-night-500">ID: {p.parameterId}</div>
                </div>
                <div className="flex items-center gap-2">
                  <EditableSelect
                    value={String(p.value)}
                    onChange={(v) => updateParameterValue(idx, v)}
                    suggestions={[]}
                    placeholder="Значение"
                    className="w-32"
                  />
                  <SecureInput
                    type="number"
                    value={String(p.quantity)}
                    onChange={(v) => updateParameterQty(idx, v)}
                    className="w-20 h-10"
                  />
                  <FormSelect
                    size="sm"
                    items={Array.isArray(templates) ? templates : []}
                    value={""}
                    placeholder="Шаблон…"
                    getKey={(t) => String(t.id)}
                    getLabel={(t) => {
                      const labelValue = String(t?.value || "").trim();
                      const labelQty = Number(t?.quantity);
                      const qtySuffix = Number.isFinite(labelQty) && labelQty > 1 ? ` (${labelQty})` : "";
                      return labelValue ? `${labelValue}${qtySuffix}` : `Количество${qtySuffix}`;
                    }}
                    onChange={(next) => {
                      const templateId = Number(next);
                      if (!Number.isFinite(templateId) || templateId <= 0) return;
                      const list = parameterTemplatesById[String(p.parameterId)] || [];
                      const t = list.find((x) => Number(x.id) === templateId);
                      if (!t) return;
                      applyTemplateToParameter({ parameterId: p.parameterId, template: t });
                    }}
                    buttonClassName="h-10 border border-night-200 bg-white text-night-900 text-xs"
                    maxHeightClassName="max-h-64"
                  />
                  <SmallButton onClick={() => removeParameter(idx)} title="Удалить параметр">
                    ×
                  </SmallButton>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-night-500">Параметры не выбраны</div>
      )}
    </div>

    <div className="space-y-3">
      <div className="text-xs font-semibold text-night-700">Категории параметров изделий</div>
      <FormSelect
        items={productParameterCategoryItems}
        value={""}
        placeholder="Категория…"
        getKey={(c) => String(c.id)}
        getLabel={(c) => String(c?.name || "")}
        onChange={(next) => {
          const v = String(next || "");
          if (!v) return;
          addParameterCategory(v);
        }}
      />
      {(selectedParameterCategories || []).length > 0 ? (
        <div className="space-y-2">
          {selectedParameterCategories.map((id, idx) => {
            const full = (referenceData.productParameterCategories || []).find((x) => Number(x.id) === Number(id));
            return (
              <div
                key={`${id}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-3 border border-night-200 rounded-lg p-3 bg-white"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-night-900 truncate">{full?.name || `#${id}`}</div>
                  <div className="text-xs text-night-500">ID: {id}</div>
                </div>
                <SmallButton onClick={() => removeParameterCategory(idx)}>
                  Удалить
                </SmallButton>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-night-500">Категории не выбраны</div>
      )}
    </div>
  </>
);

export default ProductParametersBlock;