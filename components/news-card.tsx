"use client"

import { Copy, Check } from "lucide-react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import type { NormalizedNews } from "@/lib/types"

type NewsCardProps = {
  news: NormalizedNews
  index: number
}

export function NewsCard({ news, index }: NewsCardProps) {
  const { toast } = useToast()
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [data] = useState<NormalizedNews>(news)

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      toast({
        description: `Copied ${fieldName}!`,
      })
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast({
        variant: "destructive",
        description: "Failed to copy",
      })
    }
  }

  const copyAllAsJSON = async () => {
    try {
      const json = JSON.stringify(data, null, 2)
      await navigator.clipboard.writeText(json)
      toast({
        description: "Copied entire news as JSON!",
      })
    } catch {
      toast({
        variant: "destructive",
        description: "Failed to copy JSON",
      })
    }
  }

  // Build a Sanity-friendly formatted article from current card content
  const buildPortableTextExport = (): string => {
    const title = (data.Title || "").trim()
    const sources = (data.Sources || [])
    const raw = (data.Content || "").replace(/\r\n?/g, "\n").trim()

    // Basic cleanup: remove obvious non-editorial junk if present
    const junkPatterns = [
      /\b(skip\s+advertisement|advertisement|sponsored|sponsored\s+content)\b/gi,
      /\b(home|news|follow|share)\b/gi,
      /\b(subscribe|sign\s*up|register)\b/gi,
      /\b(recommended|trending|related\s+posts?)\b/gi,
    ]
    let cleaned = raw
    for (const re of junkPatterns) cleaned = cleaned.replace(re, "")
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim()

    // Sentence splitting (supports Thai and English punctuation)
    const sentences = cleaned
      .split(/(?<=[.!?\u0E2F\u0E46])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean)

    // Excerpt: 13 short sentences
    const excerptSentences = sentences.slice(0, 13)
    const excerpt = excerptSentences.join(" ")

    // Introduction: first 2-3 sentences
    const intro = sentences.slice(0, 3).join(" ")

    // Key bullets: take next 5 distinct sentences (if available)
    const bulletStart = 3
    const bullets = sentences.slice(bulletStart, bulletStart + 6)

    // Paragraphize remaining content into short paragraphs (2 sentences per paragraph)
    const remaining = sentences.slice(bulletStart + bullets.length)
    const paragraphs: string[] = []
    for (let i = 0; i < remaining.length; i += 2) {
      paragraphs.push(remaining.slice(i, i + 2).join(" "))
    }

    // Compose output with plain-text section titles and required blank lines
    const lines: string[] = []
    lines.push("Title", "", title, "")
    lines.push("Excerpt", "", excerpt, "")
    lines.push("Introduction", "", intro, "")
    lines.push("Main Sections", "")
    if (bullets.length > 0) {
      lines.push("Key Points", "")
      for (const b of bullets) lines.push(`- ${b}`)
      lines.push("")
    }
    if (paragraphs.length > 0) {
      lines.push("Details", "")
      for (const p of paragraphs) {
        lines.push(p, "")
      }
    }
    // Conclusion: last 1-2 sentences from the end
    const conclusion = sentences.slice(-2).join(" ") || intro
    lines.push("Conclusion", "", conclusion, "")

    // Sources
    lines.push("Sources", "")
    if (sources.length > 0) {
      for (const s of sources) lines.push(`- ${s}`)
    } else {
      lines.push("No external sources provided.")
    }

    return lines.join("\n")
  }

  const copyPortableTextExport = async () => {
    try {
      const text = buildPortableTextExport()
      await navigator.clipboard.writeText(text)
      toast({ description: "Copied formatted article for Sanity" })
    } catch {
      toast({ variant: "destructive", description: "Failed to copy formatted article" })
    }
  }

  // Translation and reformatting are now handled automatically by the generator API

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg leading-tight">News #{index + 1}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyPortableTextExport} className="shrink-0 bg-transparent">
              <Copy className="size-3.5 mr-1.5" />
              Copy for Sanity
            </Button>
            <Button variant="outline" size="sm" onClick={copyAllAsJSON} className="shrink-0 bg-transparent">
              <Copy className="size-3.5 mr-1.5" />
              Copy all as JSON
            </Button>
          </div>
        </div>
        {data.isTranslated && (
          <Badge
            variant="secondary"
            className="w-fit bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
          >
            แปลอัตโนมัติ
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={data.Title}
              readOnly
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(data.Title, "Title")}
              className="shrink-0"
            >
              {copiedField === "Title" ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>

        {/* Slug */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Slug</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={data.Slug}
              readOnly
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(data.Slug, "Slug")} className="shrink-0">
              {copiedField === "Slug" ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>

        {/* Excerpt */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Excerpt</label>
          <div className="flex gap-2">
            <textarea
              value={data.Excerpt}
              readOnly
              rows={3}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(data.Excerpt, "Excerpt")}
              className="shrink-0"
            >
              {copiedField === "Excerpt" ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={data.Category}
              readOnly
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(data.Category, "Category")}
              className="shrink-0"
            >
              {copiedField === "Category" ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>

        {/* Cover */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cover</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={data.Cover}
              readOnly
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(data.Cover, "Cover")}
              className="shrink-0"
            >
              {copiedField === "Cover" ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
            </Button>
          </div>
          {data.coverNote && <p className="text-xs text-muted-foreground">{data.coverNote}</p>}
        </div>

        {/* Sources */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Sources</label>
          <div className="flex gap-2">
            <textarea
              value={data.Sources.join("\n")}
              readOnly
              rows={Math.min(data.Sources.length, 5)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(data.Sources.join("\n"), "Sources")}
              className="shrink-0"
            >
              {copiedField === "Sources" ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Content</label>
          <div className="flex gap-2">
            <textarea
              value={data.Content}
              readOnly
              rows={8}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(data.Content, "Content")}
              className="shrink-0"
            >
              {copiedField === "Content" ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
