import type { NextRequest } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function stripTags(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function pick(firstNonEmpty: Array<string | undefined | null>): string | undefined {
  for (const v of firstNonEmpty) {
    if (v && v.trim()) return v.trim()
  }
  return undefined
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any))
    let { url, title, description, content } = body as {
      url?: string
      title?: string
      description?: string
      content?: string
    }

    if (!url && !title && !content && !description) {
      return Response.json({ error: "Provide either url or some text (title/description/content)." }, { status: 400 })
    }

    // If URL provided, attempt to fetch and extract basics
    if (url) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; PulseDailyBot/1.0)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(15000),
        })
        if (res.ok) {
          const html = await res.text()
          const getMeta = (regex: RegExp) => html.match(regex)?.[1]?.trim()

          const ogTitle = getMeta(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            getMeta(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i)
          const metaTitle = getMeta(/<meta[^>]+name=["']title["'][^>]*content=["']([^"']+)["'][^>]*>/i)
          const docTitle = getMeta(/<title[^>]*>([\s\S]*?)<\/title>/i)

          const ogDesc = getMeta(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            getMeta(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:description["'][^>]*>/i)
          const metaDesc = getMeta(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)

          const articleHtml = html.match(/<article[\s\S]*?<\/article>/i)?.[0] || html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html.match(/<body[\s\S]*?<\/body>/i)?.[0]
          const text = articleHtml ? stripTags(articleHtml) : stripTags(html)

          title = pick([title, ogTitle, metaTitle, docTitle])
          description = pick([description, ogDesc, metaDesc])
          content = pick([content, text])
        }
      } catch (e) {
        // Ignore fetch errors; we may still have manual text
      }
    }

    const sourceText = [title, description, content].filter(Boolean).join("\n\n").slice(0, 8000)
    if (!sourceText) {
      return Response.json({ error: "Could not extract any text to translate." }, { status: 422 })
    }

    const useOpenAI = !!process.env.OPENAI_API_KEY
    let resultTitle = title || ""
    let resultExcerpt = description || (content ? content.slice(0, 220) : "")
    let resultContent = content || ""
    let usedAI = false

    if (useOpenAI) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a Thai news editor. Translate international news into Thai. Keep proper nouns in original language where appropriate. Return JSON with title, excerpt (160-220 chars), and content (3-6 short paragraphs).",
            },
            {
              role: "user",
              content: `Translate this to Thai preserving factuality and tone.\n\n${sourceText}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        })
        const data = JSON.parse(completion.choices[0].message.content || "{}")
        resultTitle = data.title || resultTitle
        resultExcerpt = data.excerpt || resultExcerpt
        resultContent = data.content || resultContent
        usedAI = true
      } catch (e) {
        // Fallback to other providers below
      }
    }
    // Helper fallbacks: translate specific fields (title, excerpt, content)
    async function libreTranslate(q: string): Promise<string | undefined> {
      const libreUrl = process.env.LIBRE_TRANSLATE_URL || "https://libretranslate.com"
      const res = await fetch(`${libreUrl.replace(/\/$/, '')}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ q, source: "auto", target: "th", format: "text" }),
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) return undefined
      const data = (await res.json()) as { translatedText?: string }
      return data?.translatedText?.trim() || undefined
    }

    async function gtxTranslate(q: string): Promise<string | undefined> {
      const params = new URLSearchParams({ client: "gtx", sl: "auto", tl: "th", dt: "t", q })
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) return undefined
      const json = (await res.json()) as any
      const chunks: string[] = (json?.[0] || []).map((c: any) => (c?.[0] || ""))
      const translated = chunks.join("").trim()
      return translated || undefined
    }

    async function translateField(q: string | undefined): Promise<string | undefined> {
      if (!q || !q.trim()) return undefined
      // Try Libre first, then gtx
      try {
        const viaLibre = await libreTranslate(q)
        if (viaLibre) return viaLibre
      } catch {}
      try {
        const viaGtx = await gtxTranslate(q)
        if (viaGtx) return viaGtx
      } catch {}
      return undefined
    }

    // If still not translated via OpenAI, translate fields individually via fallbacks
    if (!usedAI) {
      const [tTitle, tExcerpt, tContent] = await Promise.all([
        translateField(title),
        translateField(description || (content ? content.slice(0, 220) : undefined)),
        translateField(content || sourceText),
      ])

      if (tTitle || tExcerpt || tContent) {
        if (tTitle) resultTitle = tTitle
        if (tExcerpt) resultExcerpt = tExcerpt
        if (tContent) resultContent = tContent
        // Derive missing pieces from content if needed
        if (!resultTitle && resultContent) {
          resultTitle = resultContent.split(/\n|[。.!?]\s/)[0]?.slice(0, 120) || ""
        }
        if (!resultExcerpt && resultContent) {
          resultExcerpt = resultContent.slice(0, 200)
        }
        usedAI = true
      }
    }

    return Response.json({
      title: resultTitle,
      excerpt: resultExcerpt,
      content: resultContent,
      source: url || null,
      isTranslated: usedAI,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return Response.json({ error: message }, { status: 500 })
  }
}
