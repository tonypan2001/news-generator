import type { NextRequest } from "next/server"
import OpenAI from "openai"
import { RSS_SOURCES } from "@/lib/rss-sources"
import { slugify } from "@/lib/slugify"
import { isThai } from "@/lib/lang"
import { buildUnsplashQuery, buildUnsplashUrl } from "@/lib/unsplash"
import type { Category, Region, NormalizedNews } from "@/lib/types"

// Simple in-memory backoff to avoid hammering the AI when quota is exhausted
let LAST_AI_ERROR_AT = 0
function aiAvailable() {
  if (!process.env.OPENAI_API_KEY) return false
  if (process.env.DISABLE_AI === "true") return false
  const cooldownMs = Number(process.env.AI_COOLDOWN_MS || 5 * 60 * 1000)
  return Date.now() - LAST_AI_ERROR_AT > cooldownMs
}

// Lightweight translation fallbacks (non-OpenAI)
async function libreTranslate(q: string): Promise<string | undefined> {
  try {
    const base = process.env.LIBRE_TRANSLATE_URL || "https://libretranslate.com"
    const res = await fetch(`${base.replace(/\/$/, "")}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ q, source: "auto", target: "th", format: "text" }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return undefined
    const data = (await res.json()) as { translatedText?: string }
    return data?.translatedText?.trim() || undefined
  } catch {
    return undefined
  }
}

async function gtxTranslate(q: string): Promise<string | undefined> {
  try {
    const params = new URLSearchParams({ client: "gtx", sl: "auto", tl: "th", dt: "t", q })
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return undefined
    const json = (await res.json()) as any
    const chunks: string[] = (json?.[0] || []).map((c: any) => c?.[0] || "")
    const translated = chunks.join("").trim()
    return translated || undefined
  } catch {
    return undefined
  }
}

async function translateField(q?: string): Promise<string | undefined> {
  if (!q || !q.trim()) return undefined
  const viaLibre = await libreTranslate(q)
  if (viaLibre) return viaLibre
  const viaGtx = await gtxTranslate(q)
  if (viaGtx) return viaGtx
  return undefined
}
function flagAIError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  if (/429|insufficient_quota|rate limit/i.test(msg)) {
    LAST_AI_ERROR_AT = Date.now()
  }
}

// Fetch and extract full article text for better content generation
function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractMainFromHtml(html: string): string {
  const pick = (re: RegExp) => html.match(re)?.[0]
  const article = pick(/<article[\s\S]*?<\/article>/i)
  if (article) return stripTags(article)
  const main = pick(/<main[\s\S]*?<\/main>/i)
  if (main) return stripTags(main)
  const contentDiv = pick(/<div[^>]+(id|class)=["'][^"']*(article|content|post|entry)[^"']*["'][\s\S]*?<\/div>/i)
  if (contentDiv) return stripTags(contentDiv)
  const body = pick(/<body[\s\S]*?<\/body>/i)
  return stripTags(body || html)
}

function toParagraphs(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  let sentences = normalized.split(/(?<=[.!?\u0E2F\u0E46])\s+/).filter(Boolean)
  if (sentences.length < 3) {
    const chunks: string[] = []
    for (let i = 0; i < normalized.length; i += 140) chunks.push(normalized.slice(i, i + 140))
    sentences = chunks
  }
  const paras: string[] = []
  for (let i = 0; i < sentences.length; i += 2) paras.push(sentences.slice(i, i + 2).join(" "))
  return paras.join("\n\n")
}

function formatContentForReadability(text: string): string {
  const normalized = (text || "").replace(/\r\n?/g, "\n").trim()
  if (!normalized) return ""
  // If content already has paragraph breaks, respect them; otherwise, create paragraphs
  const hasBlankLines = /\n\s*\n/.test(normalized)
  const base = hasBlankLines ? normalized : toParagraphs(normalized)
  // Normalize paragraphs to be separated by two blank lines for extra spacing
  const parts = base.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean)
  const doubled = parts.join("\n\n\n")
  // Add leading space before first paragraph
  return "\n\n" + doubled
}

// Build plain-text structured article for Sanity/portable text
function splitSentences(text: string): string[] {
  return (text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?\u0E2F\u0E46])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function chunkSentences(sentences: string[], per = 2): string[] {
  const paras: string[] = []
  for (let i = 0; i < sentences.length; i += per) {
    paras.push(sentences.slice(i, i + per).join(" "))
  }
  return paras
}

function buildStructuredArticle(title: string, excerpt: string, body: string, sources: string[]): string {
  const sents = splitSentences(body)
  const intro = sents.slice(0, 3).join(" ")
  const summary13 = sents.slice(0, 13).join(" ")
  const afterIntro = sents.slice(3)
  const keyPoints = afterIntro.slice(0, 6)
  const details = afterIntro.slice(6)
  const detailParas = chunkSentences(details, 2)
  const conclusion = (sents.slice(-2).join(" ") || intro).trim()

  const lines: string[] = []
  lines.push("Title", "", (title || "").trim(), "")
  lines.push("Excerpt", "", (summary13 || excerpt || "").trim(), "")
  lines.push("Introduction", "", intro.trim(), "")
  lines.push("Main Sections", "")
  if (keyPoints.length) {
    lines.push("Key Points", "")
    for (const k of keyPoints) lines.push(`- ${k}`)
    lines.push("")
  }
  if (detailParas.length) {
    lines.push("Details", "")
    for (const p of detailParas) lines.push(p, "")
  }
  lines.push("Conclusion", "", conclusion, "")
  lines.push("Sources", "")
  if (sources && sources.length) {
    for (const src of sources) lines.push(`- ${src}`)
  } else {
    lines.push("No external sources provided.")
  }
  return lines.join("\n")
}

async function fetchArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PulseDailyBot/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return ""
    const html = await res.text()
    const text = extractMainFromHtml(html)
    return text.slice(0, 8000)
  } catch {
    return ""
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function parseRSS(
  url: string,
): Promise<Array<{ title: string; link: string; pubDate: Date; description: string }>> {
  try {
    console.log("[v0] Fetching RSS:", url)
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PulseDailyBot/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      console.error("[v0] RSS fetch failed:", response.status, url)
      return []
    }

    const xml = await response.text()

    // Check if we got valid XML
    if (!xml.includes("<rss") && !xml.includes("<feed") && !xml.includes("<?xml")) {
      console.error("[v0] Response is not valid XML:", url)
      return []
    }

    // Decode HTML entities helper
    const decodeEntities = (text: string) => {
      return text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
    }

    // Parse items from XML (supports both RSS and Atom)
    const items: Array<{ title: string; link: string; pubDate: Date; description: string }> = []

    // Match item or entry tags
    const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi
    const itemMatches = xml.matchAll(itemRegex)

    for (const match of itemMatches) {
      const itemXml = match[1]

      // Extract title
      const titleMatch = itemXml.match(
        /<title(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i,
      )
      let title = titleMatch ? titleMatch[1].trim() : ""
      title = decodeEntities(title)
        .replace(/<[^>]+>/g, "")
        .trim()

      // Extract link handling both Atom (<link href="..." />) and RSS (<link>text</link>)
      let link = ""

      // 1) Atom-style or RSS-style with href attribute, supports self-closing
      const linkHref = itemXml.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>(?:\s*<\/link>)?/i)
      if (linkHref?.[1]) {
        link = decodeEntities(linkHref[1].trim())
      }

      // 2) Fallback: link text content inside <link>...</link>
      if (!link) {
        const linkText = itemXml.match(
          /<link\b[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i,
        )
        link = linkText?.[1] ? decodeEntities(linkText[1].trim()) : ""
      }

      // 3) Fallback: GUID marked as permalink
      if (!link) {
        const guidPermalink = itemXml.match(
          /<guid\b[^>]*isPermaLink=["']true["'][^>]*>([^<]+)<\/guid>/i,
        )
        link = guidPermalink?.[1] ? decodeEntities(guidPermalink[1].trim()) : ""
      }

      // Extract pubDate or published
      const dateMatch = itemXml.match(
        /<(?:pubDate|published|dc:date|updated)(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:pubDate|published|dc:date|updated)>/i,
      )
      const dateStr = dateMatch ? dateMatch[1].trim() : ""
      let pubDate = new Date()
      if (dateStr) {
        try {
          pubDate = new Date(dateStr)
          if (isNaN(pubDate.getTime())) {
            pubDate = new Date()
          }
        } catch {
          pubDate = new Date()
        }
      }

      // Extract description or summary
      const descMatch = itemXml.match(
        /<(?:description|summary|content:encoded|content)(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content:encoded|content)>/i,
      )
      let description = descMatch ? descMatch[1].trim() : ""
      // Strip HTML tags and decode entities
      description = decodeEntities(description)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500)

      // Keep even short titles; upstream feeds can be terse
      if (title && link) {
        items.push({ title, link, pubDate, description })
      }
    }

    console.log("[v0] Parsed", items.length, "items from", url)
    return items
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] RSS parse error:", url, errorMsg)
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] === Generator API called ===")

    if (!process.env.OPENAI_API_KEY) {
      console.error("[v0] Missing OPENAI_API_KEY")
      return Response.json(
        { error: "OpenAI API key is not configured. Please add OPENAI_API_KEY to your environment variables." },
        { status: 500 },
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category") as Category
    const region = searchParams.get("region") as Region
    const count = Number.parseInt(searchParams.get("count") || "5")
    // Auto-translate and reformat are now always enabled post-generation

    console.log("[v0] Request params:", { category, region, count })

    if (!category || !region) {
      return Response.json({ error: "Missing category or region" }, { status: 400 })
    }

    if (count < 3 || count > 10) {
      return Response.json({ error: "Count must be between 3 and 10" }, { status: 400 })
    }

    // Get RSS feeds for the category and region
    const feeds = RSS_SOURCES[region]?.[category]
    console.log("[v0] Found feeds:", feeds?.length || 0)

    if (!feeds || feeds.length === 0) {
      return Response.json({ error: "No feeds found for this category/region" }, { status: 404 })
    }

    console.log("[v0] Fetching feeds...")
    const feedResults = await Promise.allSettled(feeds.map((feed) => parseRSS(feed.url)))

    const successfulFeeds = feedResults.filter((r) => r.status === "fulfilled" && r.value.length > 0).length
    console.log("[v0] Feed results:", successfulFeeds, "feeds with items out of", feeds.length)

    // Collect candidate items
    const candidates: Array<{
      title: string
      link: string
      pubDate: Date
      hostname: string
      description: string
    }> = []

    for (const result of feedResults) {
      if (result.status === "fulfilled") {
        for (const item of result.value) {
          try {
            const url = new URL(item.link)
            candidates.push({
              title: item.title,
              link: item.link,
              pubDate: item.pubDate,
              hostname: url.hostname,
              description: item.description,
            })
          } catch (e) {
            console.error("[v0] Invalid URL:", item.link)
          }
        }
      }
    }

    if (candidates.length === 0) {
      console.error("[v0] No candidates found from any feeds")
      return Response.json(
        {
          error:
            "Unable to fetch articles from RSS feeds. This may be due to feed availability or network issues. Please try again later or contact support.",
          details: `Tried ${feeds.length} feeds, got ${successfulFeeds} successful responses with 0 items total.`,
        },
        { status: 503 },
      )
    }

    console.log("[v0] Total candidates:", candidates.length)

    // Sort by recency
    candidates.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())

    // Pick diverse items (max 2 per hostname)
    const selected: typeof candidates = []
    const hostnameCount = new Map<string, number>()

    for (const candidate of candidates) {
      const currentCount = hostnameCount.get(candidate.hostname) || 0
      if (currentCount < 2) {
        selected.push(candidate)
        hostnameCount.set(candidate.hostname, currentCount + 1)
      }

      if (selected.length >= count * 2) break
    }

    console.log("[v0] Selected candidates:", selected.length)

    const results: NormalizedNews[] = []

    for (let i = 0; i < Math.min(count, selected.length); i++) {
      const item = selected[i]
      console.log(`[v0] Processing ${i + 1}/${count}: "${item.title.substring(0, 50)}..."`)

      try {
        // Check if content is in Thai and decide if we should translate
        const contentIsThai = isThai(item.title + " " + item.description)
        const shouldTranslate = true
        console.log(
          `[v0] Content is Thai: ${contentIsThai} | auto-translate enabled: ${shouldTranslate}`,
        )

        let finalTitle = item.title
        let finalExcerpt = item.description.slice(0, 220)
        let finalContent = ""
        let isTranslated = false

        // Try to fetch the full article body for richer content
        const articleText = await fetchArticleText(item.link)
        const baseText = articleText || item.description

        if (shouldTranslate && aiAvailable()) {
          console.log("[v0] Translating to Thai...")
          try {
            const completion = await openai.chat.completions.create({
              model: process.env.OPENAI_MODEL || "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a Thai news editor. Translate, reorganize, and polish international news into clear Thai suitable for reading on the web. Keep proper nouns in original form where appropriate. Return JSON with title (concise), excerpt (160-220 chars), and content as 3-6 short paragraphs separated by blank lines. Improve clarity, remove redundancy, and maintain factual accuracy. Do not invent facts.",
                },
                {
                  role: "user",
                  content: `Translate and reformat to Thai with well-spaced paragraphs.\n\nTitle: ${item.title}\nDescription: ${item.description}\n\nContent:\n${baseText}`,
                },
              ],
              response_format: { type: "json_object" },
              temperature: 0.7,
            })

            const result = JSON.parse(completion.choices[0].message.content || "{}")
            finalTitle = result.title || item.title
            finalExcerpt = result.excerpt || item.description.slice(0, 220)
            finalContent = buildStructuredArticle(
              result.title || item.title,
              result.excerpt || item.description.slice(0, 220),
              formatContentForReadability(result.content || toParagraphs(baseText)),
              [item.link],
            )
            isTranslated = true
            console.log("[v0] Translation complete")
          } catch (aiError) {
            if (process.env.SUPPRESS_AI_WARNINGS !== "true") {
              console.warn("[v0] AI translation failed, falling back:", aiError)
            }
            flagAIError(aiError)
            // Fallback: try non-OpenAI translation providers
            const [tTitle, tExcerpt, tContent] = await Promise.all([
              translateField(item.title),
              translateField(baseText.slice(0, 220)),
              translateField(baseText),
            ])
            if (tTitle || tExcerpt || tContent) {
              finalTitle = tTitle || item.title
              const rawContent = tContent || baseText
              // Space content into short paragraphs
              finalContent = buildStructuredArticle(
                tTitle || item.title,
                tExcerpt || (rawContent || "").slice(0, 220),
                formatContentForReadability(rawContent),
                [item.link],
              )
              finalExcerpt = tExcerpt || (rawContent || "").slice(0, 220)
              isTranslated = true
            } else {
              // Last resort: keep original English but spaced
              finalTitle = item.title
              finalExcerpt = item.description.slice(0, 220)
              finalContent = buildStructuredArticle(
                item.title,
                item.description.slice(0, 220),
                formatContentForReadability(baseText),
                [item.link],
              )
              isTranslated = false
            }
          }
        } else {
          // AI not available: try translation fallbacks; else lightly reflow
          const [tTitle, tExcerpt, tContent] = await Promise.all([
            translateField(item.title),
            translateField(baseText.slice(0, 220)),
            translateField(baseText),
          ])
          if (tTitle || tExcerpt || tContent) {
            finalTitle = tTitle || item.title
            const rawContent = tContent || baseText
            finalContent = buildStructuredArticle(
              tTitle || item.title,
              tExcerpt || (rawContent || "").slice(0, 220),
              formatContentForReadability(rawContent),
              [item.link],
            )
            finalExcerpt = tExcerpt || finalContent.slice(0, 220)
            isTranslated = true
          } else {
            const raw = baseText || ""
            finalExcerpt = raw.slice(0, 220)
            finalContent = buildStructuredArticle(
              item.title,
              finalExcerpt,
              formatContentForReadability(raw),
              [item.link],
            )
          }
        }

        // Build Unsplash cover
        const query = buildUnsplashQuery(category, finalTitle)
        const cover = buildUnsplashUrl(query)

        // Create normalized news object
        const news: NormalizedNews = {
          Title: finalTitle,
          Slug: slugify(finalTitle),
          Excerpt: finalExcerpt,
          Category: category,
          Cover: cover,
          Sources: [item.link],
          Content: finalContent,
          isTranslated,
          coverNote: `Unsplash license image (query: ${query})`,
        }

        results.push(news)
        console.log(`[v0] Item ${i + 1} complete`)
      } catch (error) {
        console.error(`[v0] Error processing item ${i + 1}:`, error)
        // Skip this item and continue
      }
    }

    if (results.length === 0) {
      console.warn("[v0] No AI-generated results, constructing fallback items from feed content")
      const fallback: NormalizedNews[] = selected.slice(0, Math.min(count, selected.length)).map((item) => {
        const query = buildUnsplashQuery(category, item.title)
        return {
          Title: item.title,
          Slug: slugify(item.title),
          Excerpt: item.description.slice(0, 220),
          Category: category,
          Cover: buildUnsplashUrl(query),
          Sources: [item.link],
          Content: item.description,
          isTranslated: false,
          coverNote: `Unsplash license image (query: ${query})`,
        }
      })

      if (fallback.length > 0) {
        console.warn("[v0] Returning", fallback.length, "fallback results")
        return Response.json(fallback)
      }

      return Response.json({ error: "Failed to process any articles. Please try again." }, { status: 500 })
    }

    console.log("[v0] Returning", results.length, "results")
    return Response.json(results)
  } catch (error) {
    console.error("[v0] Fatal API Error:", error)
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    console.error("[v0] Error details:", errorMessage)
    return Response.json({ error: errorMessage }, { status: 500 })
  }
}
