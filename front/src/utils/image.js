const placeholderImage = "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80";

export const getImageUrl = (url) => {
  if (!url) return placeholderImage;
  if (url.startsWith("/uploads/")) {
    return import.meta.env.DEV ? `http://localhost:5000${url}` : url;
  }
  return url;
};

export { placeholderImage };
