const placeholderImage =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#f1f5f9"/>
          <stop offset="1" stop-color="#e2e8f0"/>
        </linearGradient>
      </defs>
      <rect width="600" height="400" fill="url(#g)"/>
      <g fill="none" stroke="#94a3b8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
        <rect x="90" y="70" width="420" height="260" rx="24"/>
        <path d="M160 265l80-80 70 70 70-70 90 90"/>
        <circle cx="220" cy="150" r="22"/>
      </g>
    </svg>`
  );

const getBackendOrigin = () => {
  const raw = import.meta.env.VITE_API_URL;
  if (!raw) return "";
  try {
    return String(raw).replace(/\/?api\/?$/i, "");
  } catch {
    return "";
  }
};

export const getImageUrl = (url) => {
  if (!url) return placeholderImage;
  if (url.startsWith("/uploads/")) {
    const origin = getBackendOrigin();
    return origin ? `${origin}${url}` : url;
  }
  return url;
};

export { placeholderImage };
