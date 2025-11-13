"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Toaster } from "@/components/ui/toaster"
import { NewsCard } from "@/components/news-card"
import type { NormalizedNews, Category } from "@/lib/types"

const CATEGORIES: Category[] = ["Hot", "Drama", "Business", "Tech", "Entertainment", "Lifestyle"]

export default function GeneratorPage() {
  const [category, setCategory] = useState<Category>("Hot")
  const [region, setRegion] = useState<"th" | "intl">("th")
  const [count, setCount] = useState(5)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<NormalizedNews[]>([])

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)
    setResults([])

    try {
      const params = new URLSearchParams({
        category,
        region,
        count: count.toString(),
      })

      console.log("[v0] Fetching:", `/api/generator?${params}`)
      const response = await fetch(`/api/generator?${params}`)
      console.log("[v0] Response status:", response.status, response.statusText)

      const contentType = response.headers.get("content-type")
      console.log("[v0] Content-Type:", contentType)

      if (!response.ok) {
        // Try to parse JSON error, fallback to text
        let errorMessage = "Failed to generate news"
        try {
          if (contentType?.includes("application/json")) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } else {
            const textError = await response.text()
            errorMessage = textError.slice(0, 200) || errorMessage
          }
        } catch (parseError) {
          console.error("[v0] Error parsing error response:", parseError)
        }
        throw new Error(errorMessage)
      }

      if (!contentType?.includes("application/json")) {
        const responseText = await response.text()
        console.error("[v0] Expected JSON but got:", responseText.slice(0, 200))
        throw new Error("Server returned invalid response format. Check console for details.")
      }

      const data = await response.json()
      console.log("[v0] Received", data.length, "results")
      setResults(data)
    } catch (err) {
      console.error("[v0] Generate error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container max-w-4xl py-8 md:py-12 px-4">
        {/* Header */}
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-balance">PulseDaily News Generator</h1>
          <p className="text-muted-foreground text-balance">
            Fetch trending news from curated sources and generate normalized content in Thai
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-8 shadow-lg">
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Count */}
                <div className="space-y-2">
                  <Label htmlFor="count">Count: {count}</Label>
                  <Slider
                    id="count"
                    min={3}
                    max={10}
                    step={1}
                    value={[count]}
                    onValueChange={(values) => setCount(values[0])}
                    className="pt-2"
                  />
                </div>
              </div>

              {/* Region Segmented Control */}
              <div className="space-y-2">
                <Label>Region</Label>
                <div className="flex justify-center">
                  <div className="inline-flex rounded-lg border border-input bg-background p-1">
                    <button
                      onClick={() => setRegion("th")}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        region === "th"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      ไทย
                    </button>
                    <button
                      onClick={() => setRegion("intl")}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        region === "intl"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      ต่างประเทศ
                    </button>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <Button onClick={handleGenerate} disabled={isLoading} size="lg" className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-8">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Empty State */}
        {!isLoading && results.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <Sparkles className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Ready to generate news</h3>
            <p className="text-sm text-muted-foreground max-w-sm">กด Generate เพื่อดึงข่าวล่าสุดจากแหล่งที่คัดสรรแล้ว</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Generated {results.length} {results.length === 1 ? "article" : "articles"}
              </h2>
            </div>
            {results.map((news, index) => (
              <NewsCard key={index} news={news} index={index} />
            ))}
          </div>
        )}
      </div>

      <Toaster />
    </div>
  )
}
