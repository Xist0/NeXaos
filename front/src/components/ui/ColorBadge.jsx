import { resolveColor } from "../../utils/colors";
import { getThumbUrl } from "../../utils/image";

const ColorBadge = ({ value, labelPrefix, colorData }) => {
  // Если передан объект colorData (из базы данных), используем его
  if (colorData && colorData.name) {
    const imageUrl = colorData.image_url
      ? getThumbUrl(colorData.image_url, { w: 48, h: 48, q: 70, fit: "inside" })
      : null;

    return (
      <span className="inline-flex items-center gap-2 text-sm min-w-0">
        {labelPrefix && (
          <span className="text-night-500">{labelPrefix}</span>
        )}
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="h-5 w-5 flex-shrink-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={colorData.name}
                className="h-5 w-5 rounded object-cover border border-night-200"
                crossOrigin="anonymous"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <span
                className="h-5 w-5 rounded-full border border-night-200 bg-night-100"
              />
            )}
          </span>
          <span className="font-medium text-night-900 truncate max-w-[180px]">{colorData.name}</span>
        </span>
      </span>
    );
  }

  // Старая логика для текстовых значений
  const resolved = resolveColor(value);
  if (!resolved) return null;

  return (
    <span className="inline-flex items-center gap-2 text-sm min-w-0">
      {labelPrefix && (
        <span className="text-night-500">{labelPrefix}</span>
      )}
      <span className="inline-flex items-center gap-2 min-w-0">
        <span className="h-4 w-4 flex-shrink-0">
          <span
            className="h-4 w-4 rounded-full border border-night-200 block"
            style={{ backgroundColor: resolved.hex }}
          />
        </span>
        <span className="font-medium text-night-900 truncate max-w-[180px]">{resolved.label}</span>
      </span>
    </span>
  );
};

export default ColorBadge;
