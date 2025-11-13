export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/['"""'']/g, "") // Remove quotes
    .replace(/[^\w\u0E00-\u0E7F\s-]/g, "") // Keep alphanumeric, Thai chars, spaces, hyphens
    .replace(/[\s_]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .slice(0, 96) // Limit to 96 characters
}
