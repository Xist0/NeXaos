import { resolveColor } from "../../utils/colors";

const ColorBadge = ({ value, labelPrefix }) => {
  const resolved = resolveColor(value);
  if (!resolved) return null;

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      {labelPrefix && (
        <span className="text-night-500">{labelPrefix}</span>
      )}
      <span className="inline-flex items-center gap-2">
        <span
          className="h-4 w-4 rounded-full border border-night-200"
          style={{ backgroundColor: resolved.hex }}
        />
        <span className="font-medium text-night-900">{resolved.label}</span>
      </span>
    </span>
  );
};

export default ColorBadge;




