export function buildUnsplashQuery(category: string, title: string): string {
  // Extract keywords from title (simple approach: take first few words, remove common words)
  const commonWords = [
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "up",
    "about",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "over",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "both",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "can",
    "will",
    "just",
    "should",
    "now",
  ]

  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !commonWords.includes(word))
    .slice(0, 3)

  // Combine category with keywords
  const query = [category, ...words].join(" ")
  return query
}

export function buildUnsplashUrl(query: string): string {
  return `https://source.unsplash.com/1600x900/?${encodeURIComponent(query)}`
}
