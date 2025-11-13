export type Category = "Hot" | "Drama" | "Business" | "Tech" | "Entertainment" | "Lifestyle"
export type Region = "th" | "intl"

export type NormalizedNews = {
  Title: string
  Slug: string
  Excerpt: string
  Category: Category
  Cover: string
  Sources: string[]
  Content: string
  isTranslated: boolean
  coverNote?: string
}

export type RSSFeed = {
  url: string
  name: string
}

export type RSSMap = {
  [region in Region]: {
    [category in Category]: RSSFeed[]
  }
}
