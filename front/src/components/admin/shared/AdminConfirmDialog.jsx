import SecureButton from "../../ui/SecureButton";

const AdminConfirmDialog = ({ open, title = "Подтверждение", message, confirmLabel = "Удалить", onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white border border-night-200 shadow-2xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-night-900">{title}</h3>
        <p className="text-sm text-night-600">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <SecureButton type="button" variant="outline" onClick={onCancel} className="px-4 py-2">
            Отмена
          </SecureButton>
          <SecureButton type="button" onClick={onConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 border-red-600">
            {confirmLabel}
          </SecureButton>
        </div>
      </div>
    </div>
  );
};

export default AdminConfirmDialog;
