import { type NextRequest, NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import { checkRateLimit, recordFailure } from '@/lib/rate-limiter';
import { getClientIp } from '@/lib/client-ip';

// R-API-09 closure (Wave 5B): external-route rate limit. cybernews
// fans out to 5 feed URLs per request, making it the most amplified
// of the three external routes. 60 req/min/IP cap matches the cves +
// greynoise routes — consistent UX, predictable upstream load.
const RATE_LIMIT_BUCKET = 'api:external:cybernews';
const RATE_LIMIT_OPTIONS = { bucket: RATE_LIMIT_BUCKET, max: 60, windowMs: 60_000 };

export const dynamic = 'force-dynamic';

// R-API-08 closure (Wave 5B): replaces hand-rolled regex XML parser
// with the `fast-xml-parser` library. Regex-based XML parsing is a
// known anti-pattern (Phase 3.A audit) — nested tags, malformed
// CDATA, and unicode edge cases can break regex assumptions. The
// library is a well-maintained, conservative parser with explicit
// CDATA + entity handling.
//
// SENIOR ARCHITECT NOTE: parser configured to preserve attribute
// data (needed for Atom `<link href>` extraction) and to NOT trim
// text content (preserve content fidelity; cleanText handles
// whitespace normalization downstream).
//
// REJECTED ALTERNATIVE: keep regex with stricter denylist of
// dangerous patterns. Rejected — patchwork; library is a single
// dependency that solves the class of issues.
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '__cdata',
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

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

// ─── Text cleaning helpers (kept post-Wave-5B for cleanText) ────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp:   '&',
  lt:    '<',
  gt:    '>',
  quot:  '"',
  apos:  "'",
  nbsp:  ' ',
  copy:  '\u00a9',
  reg:   '\u00ae',
  trade: '\u2122',
  hellip:'\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
};

function decodeNumericEntity(body: string): string {
  const isHex = body.startsWith('x') || body.startsWith('X');
  const codePoint = isHex ? parseInt(body.slice(1), 16) : parseInt(body, 10);
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return '';
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return '';
  }
}

/** Strips HTML tags and decodes common entities */
function cleanText(raw: string): string {
  const withoutTags = raw.replace(/<[^>]*>/g, ' ');
  const decoded = withoutTags.replace(/&(#?[a-zA-Z0-9]+);/g, (match, entity: string) => {
    if (entity.startsWith('#')) {
      return decodeNumericEntity(entity.slice(1));
    }
    const key = entity.toLowerCase();
    return NAMED_ENTITIES[key] ?? match;
  });
  return decoded.replace(/\s+/g, ' ').trim();
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

// ─── RSS/Atom field extractors (post-fast-xml-parser, Wave 5B) ──────────────

/**
 * Pulls a string from a fast-xml-parser node. The parser returns:
 *   - string for plain text leafs
 *   - object with #text + __cdata for mixed content
 *   - array for repeated tags
 *   - undefined when tag absent
 * Caller passes the node directly; we normalize to a string.
 */
function extractTextNode(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.length > 0 ? extractTextNode(node[0]) : '';
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (typeof obj.__cdata === 'string') return obj.__cdata;
    if (typeof obj['#text'] === 'string') return obj['#text'];
  }
  return '';
}

/**
 * Pulls a link string from an RSS/Atom item. Handles three shapes:
 *   - RSS 2.0: <link>https://...</link>   → string leaf
 *   - Atom:    <link href="https://..."/> → @_href attribute
 *   - feedburner:origLink fallback for FeedBurner-wrapped feeds
 */
function extractItemLink(item: Record<string, unknown>): string {
  // feedburner:origLink takes precedence (canonical URL when present)
  const fb = item['feedburner:origLink'];
  const fbStr = extractTextNode(fb);
  if (fbStr) return fbStr.trim();

  const link = item.link;
  if (typeof link === 'string') return link.trim();
  if (Array.isArray(link)) {
    for (const entry of link) {
      const href = extractLinkHref(entry);
      if (href) return href;
    }
  } else if (link && typeof link === 'object') {
    const href = extractLinkHref(link);
    if (href) return href;
  }

  // guid as last-resort fallback (Atom + some RSS feeds use guid for URLs)
  const guid = extractTextNode(item.guid);
  if (guid.startsWith('http')) return guid.trim();
  return '';
}

function extractLinkHref(linkNode: unknown): string {
  if (typeof linkNode === 'string') return linkNode.trim();
  if (linkNode && typeof linkNode === 'object') {
    const obj = linkNode as Record<string, unknown>;
    if (typeof obj['@_href'] === 'string') return (obj['@_href'] as string).trim();
    if (typeof obj['#text'] === 'string') return (obj['#text'] as string).trim();
  }
  return '';
}

/** Parses an RSS XML string and returns up to MAX_PER_SOURCE items.
 * Wave 5B: uses fast-xml-parser instead of hand-rolled regex.
 * Malformed XML returns an empty array (defensive — no throw bubbles
 * up to the Promise.allSettled in GET handler). */
function parseFeed(xml: string, source: string): FeedItem[] {
  let parsed: unknown;
  try {
    parsed = xmlParser.parse(xml);
  } catch {
    // Malformed XML — return empty rather than crash the feed loop
    return [];
  }

  // Navigate to <item> array — exists at rss.channel.item (RSS 2.0)
  // or feed.entry (Atom). Both are conventions the parser preserves.
  const root = parsed as Record<string, unknown> | null;
  if (!root) return [];

  const rssChannel = (root.rss as Record<string, unknown> | undefined)?.channel as
    | Record<string, unknown>
    | undefined;
  const atomFeed = root.feed as Record<string, unknown> | undefined;

  let rawItems: unknown = rssChannel?.item ?? atomFeed?.entry;
  if (!rawItems) return [];
  if (!Array.isArray(rawItems)) rawItems = [rawItems];

  const items: FeedItem[] = [];
  for (const item of rawItems as Record<string, unknown>[]) {
    if (items.length >= MAX_PER_SOURCE) break;

    const title = cleanText(extractTextNode(item.title));
    const link = extractItemLink(item);
    const rawPubDate =
      extractTextNode(item.pubDate) ||
      extractTextNode(item['dc:date']) ||
      extractTextNode(item.updated);
    const rawDesc =
      extractTextNode(item.description) ||
      extractTextNode(item.summary) ||
      extractTextNode(item['content:encoded']);

    if (!title || !link) continue;

    items.push({
      title,
      link,
      pubDate: toISO(rawPubDate),
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

export async function GET(request: NextRequest) {
  // R-API-09 rate-limit gate
  const clientIp = getClientIp(request);
  const limited = await checkRateLimit(clientIp, RATE_LIMIT_OPTIONS);
  if (limited.limited) {
    return NextResponse.json(
      { error: 'Cok fazla istek. Lutfen daha sonra tekrar deneyin.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limited.resetAt - Date.now()) / 1000)) } },
    );
  }
  await recordFailure(clientIp, RATE_LIMIT_OPTIONS);

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
