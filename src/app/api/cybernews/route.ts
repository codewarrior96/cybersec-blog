import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
}

interface FeedSource {
  url: string;
  source: string;
}

// ─── Feed sources ─────────────────────────────────────────────────────────────

const FEEDS: FeedSource[] = [
  { url: 'https://feeds.feedburner.com/TheHackersNews',                     source: 'THN' },
  { url: 'https://krebsonsecurity.com/feed/',                                source: 'Krebs' },
  { url: 'https://www.bleepingcomputer.com/feed/',                           source: 'BleepingComputer' },
  { url: 'https://isc.sans.edu/rssfeed_full.xml',                            source: 'SANS ISC' },
  { url: 'https://feeds.feedburner.com/securityweek',                        source: 'SecurityWeek' },
];

const MAX_PER_SOURCE  = 5;
const MAX_TOTAL       = 20;
const FETCH_TIMEOUT   = 8_000;

// ─── XML helpers ─────────────────────────────────────────────────────────────

/** Extracts the text content of the first occurrence of <tag>…</tag>, handles CDATA */
function extractTag(xml: string, tag: string): string {
  // CDATA: <tag><![CDATA[…]]></tag>
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const cdataM  = xml.match(cdataRe);
  if (cdataM) return cdataM[1].trim();

  // Plain text: <tag>…</tag>
  const textRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const textM  = xml.match(textRe);
  if (textM) return textM[1].trim();

  return '';
}

/** Specialized link extractor — handles RSS 2.0 and Atom formats */
function extractLink(itemXml: string): string {
  // RSS 2.0: <link>https://…</link>
  const rssM = itemXml.match(/<link>([^<\s]+)<\/link>/i);
  if (rssM) return rssM[1].trim();

  // Atom: <link href="https://…"/>
  const atomM = itemXml.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (atomM) return atomM[1].trim();

  // feedburner:origLink
  const fbM = itemXml.match(/<feedburner:origLink>([^<]+)<\/feedburner:origLink>/i);
  if (fbM) return fbM[1].trim();

  // <guid isPermaLink="true"> or plain guid as fallback
  const guidM = itemXml.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/i);
  if (guidM) return guidM[1].trim();

  return '';
}

/** Strips HTML tags and decodes common entities */
function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g,   '&')
    .replace(/&lt;/g,    '<')
    .replace(/&gt;/g,    '>')
    .replace(/&quot;/g,  '"')
    .replace(/&#39;/g,   "'")
    .replace(/&apos;/g,  "'")
    .replace(/&nbsp;/g,  ' ')
    .replace(/&#\d+;/g,  '')
    .replace(/&[a-z]+;/g,'')
    .replace(/\s+/g,     ' ')
    .trim();
}

/** Parses pubDate to ISO string; returns current time on failure */
function toISO(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/** Parses an RSS XML string and returns up to MAX_PER_SOURCE items */
function parseFeed(xml: string, source: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRe.exec(xml)) !== null && items.length < MAX_PER_SOURCE) {
    const chunk = match[1];

    const title       = cleanText(extractTag(chunk, 'title'));
    const link        = extractLink(chunk);
    const rawPubDate  = extractTag(chunk, 'pubDate') || extractTag(chunk, 'dc:date') || extractTag(chunk, 'updated');
    const rawDesc     = extractTag(chunk, 'description') || extractTag(chunk, 'summary') || extractTag(chunk, 'content:encoded');

    if (!title || !link) continue;

    items.push({
      title,
      link,
      pubDate:     toISO(rawPubDate),
      description: cleanText(rawDesc).slice(0, 220),
      source,
    });
  }

  return items;
}

/** Fetches a single RSS feed with a hard timeout */
async function fetchFeed(feed: FeedSource): Promise<FeedItem[]> {
  const res = await fetch(feed.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CyberSecBlog/2.0; +https://cybersec.blog)',
      'Accept':     'application/rss+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
    cache:  'no-store',
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${feed.url}`);

  const xml = await res.text();
  return parseFeed(xml, feed.source);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));

  const allItems: FeedItem[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
    // silently discard rejected feeds
  }

  // Sort newest-first, cap at MAX_TOTAL
  allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  const items = allItems.slice(0, MAX_TOTAL);

  return NextResponse.json(
    { items, fetchedAt: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}
