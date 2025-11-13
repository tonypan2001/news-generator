import type { RSSMap } from "./types"

export const RSS_SOURCES: RSSMap = {
  th: {
    Hot: [
      { url: "https://www.matichon.co.th/feed", name: "Matichon" },
      { url: "https://www.thaipbs.or.th/rss/thaipbs-news.xml", name: "ThaiPBS" },
      { url: "https://www.thairath.co.th/rss/home", name: "Thairath" },
    ],
    Drama: [
      { url: "https://www.sanook.com/entertain/rss/", name: "Sanook Entertainment" },
      { url: "https://workpointtoday.com/feed/", name: "WorkpointToday" },
      { url: "https://www.dailynews.co.th/rss/entertainment.xml", name: "Daily News Entertainment" },
    ],
    Business: [
      { url: "https://www.prachachat.net/feed", name: "Prachachat" },
      { url: "https://www.bangkokpost.com/business/rss", name: "Bangkok Post Business" },
      { url: "https://www.thairath.co.th/rss/business", name: "Thairath Business" },
    ],
    Tech: [
      { url: "https://www.blognone.com/rss", name: "Blognone" },
      { url: "https://www.thairath.co.th/rss/tech", name: "Thairath Tech" },
      { url: "https://techsauce.co/feed", name: "TechSauce" },
    ],
    Entertainment: [
      { url: "https://www.sanook.com/entertain/rss/", name: "Sanook Entertainment" },
      { url: "https://workpointtoday.com/feed/", name: "Workpoint Today" },
      { url: "https://www.thairath.co.th/rss/entertainment", name: "Thairath Entertainment" },
    ],
    Lifestyle: [
      { url: "https://adaybulletin.com/feed", name: "a day BULLETIN" },
      { url: "https://thestandard.co/pop/feed/", name: "The Standard Pop" },
      { url: "https://www.thairath.co.th/rss/lifestyle", name: "Thairath Lifestyle" },
    ],
  },
  intl: {
    Hot: [
      { url: "https://feeds.bbci.co.uk/news/world/rss.xml", name: "BBC World" },
      { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", name: "NY Times World" },
      { url: "https://www.aljazeera.com/xml/rss/all.xml", name: "Al Jazeera" },
    ],
    Drama: [
      { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", name: "BBC Entertainment & Arts" },
      { url: "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml", name: "NY Times Arts" },
    ],
    Business: [
      { url: "https://feeds.bbci.co.uk/news/business/rss.xml", name: "BBC Business" },
      { url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", name: "NY Times Business" },
      { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", name: "CNBC Top News" },
    ],
    Tech: [
      { url: "https://techcrunch.com/feed/", name: "TechCrunch" },
      { url: "https://www.theverge.com/rss/index.xml", name: "The Verge" },
      { url: "https://feeds.arstechnica.com/arstechnica/index", name: "Ars Technica" },
    ],
    Entertainment: [
      { url: "https://variety.com/feed/", name: "Variety" },
      { url: "https://www.hollywoodreporter.com/feed/", name: "The Hollywood Reporter" },
      { url: "https://ew.com/feed/", name: "Entertainment Weekly" },
    ],
    Lifestyle: [
      { url: "https://www.vogue.com/feed/rss", name: "Vogue" },
      { url: "https://www.gq.com/feed/rss", name: "GQ" },
      { url: "https://www.bonappetit.com/feed/rss", name: "Bon Appétit" },
    ],
  },
}
