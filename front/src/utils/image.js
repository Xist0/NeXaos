const placeholderImage = "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80";

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
