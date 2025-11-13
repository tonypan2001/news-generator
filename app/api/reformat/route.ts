import type { NextRequest } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function firstSentences(text: string, maxSentences = 2): string {
  const parts = text.split(/(?<=[。.!?\u0E2F\u0E46])\s+|\n+/).filter(Boolean)
  return parts.slice(0, maxSentences).join(" ")
}

function toParagraphs(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n\n+|\n-\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function basicSEOReformat(input: { title?: string; excerpt?: string; content: string }) {
  const title = (input.title || firstSentences(input.content, 1)).slice(0, 80)
  const meta = (input.excerpt || input.content).replace(/\s+/g, " ").slice(0, 180)
  const sentences = input.content.replace(/\s+/g, " ").split(/(?<=[。.!?\u0E2F\u0E46])\s+/).filter(Boolean)
  const bullets = sentences.slice(0, 5)
  const paras = toParagraphs(input.content)

  const body = [
    `# ${title}`,
    "",
    meta,
    "",
    "## ภาพรวม",
    firstSentences(input.content, 3),
    "",
    "## ประเด็นสำคัญ",
    ...bullets.map((b) => `- ${b}`),
    "",
    "## รายละเอียด",
    ...paras,
    "",
    "## สรุป",
    firstSentences(input.content, 1),
  ].join("\n")

  return { title, excerpt: meta, content: body }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any))
    const { title, excerpt, content } = (body || {}) as {
      title?: string
      excerpt?: string
      content?: string
      category?: string
    }

    if (!content || !content.trim()) {
      return Response.json({ error: "Missing content to reformat." }, { status: 400 })
    }

    let outTitle = title || ""
    let outExcerpt = excerpt || (content ? content.slice(0, 180) : "")
    let outContent = content
    let usedAI = false

    if (process.env.OPENAI_API_KEY && process.env.DISABLE_AI !== "true") {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an expert Thai SEO editor. Reformat the article into an SEO-friendly blog post in Thai. Use a clear H1 title, 160-180 char meta description (excerpt), and structured Markdown with H2 sections, bullet points for key takeaways, and concise paragraphs. Do not invent facts.",
            },
            {
              role: "user",
              content: `Title: ${title || ""}\nExcerpt: ${excerpt || ""}\n\nArticle:\n${content}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.6,
        })
        const data = JSON.parse(completion.choices[0].message.content || "{}") as {
          title?: string
          excerpt?: string
          content?: string
        }
        if (data.title || data.excerpt || data.content) {
          outTitle = data.title || outTitle
          outExcerpt = data.excerpt || outExcerpt
          outContent = data.content || outContent
          usedAI = true
        }
      } catch (e) {
        // fall back to heuristic below
      }
    }

    if (!usedAI) {
      const basic = basicSEOReformat({ title, excerpt, content })
      outTitle = basic.title
      outExcerpt = basic.excerpt
      outContent = basic.content
    }

    return Response.json({ title: outTitle, excerpt: outExcerpt, content: outContent, isReformatted: true, usedAI })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return Response.json({ error: message }, { status: 500 })
  }
}

