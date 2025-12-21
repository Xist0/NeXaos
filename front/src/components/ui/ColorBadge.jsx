import { resolveColor } from "../../utils/colors";

const ColorBadge = ({ value, labelPrefix, colorData }) => {
  // Если передан объект colorData (из базы данных), используем его
  if (colorData && colorData.name) {
    const getImageUrl = (url) => {
      if (!url) return null;
      if (url.startsWith('/uploads/')) {
        if (import.meta.env.DEV) {
          return `http://localhost:5000${url}`;
        }
        return url;
      }
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      return url;
    };

    const imageUrl = getImageUrl(colorData.image_url);

    return (
      <span className="inline-flex items-center gap-2 text-sm">
        {labelPrefix && (
          <span className="text-night-500">{labelPrefix}</span>
        )}
        <span className="inline-flex items-center gap-2">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={colorData.name}
              className="h-5 w-5 rounded object-cover border border-night-200"
              crossOrigin="anonymous"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <span
              className="h-5 w-5 rounded-full border border-night-200 bg-night-100"
            />
          )}
          <span className="font-medium text-night-900">{colorData.name}</span>
        </span>
      </span>
    );
  }

  // Старая логика для текстовых значений
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
