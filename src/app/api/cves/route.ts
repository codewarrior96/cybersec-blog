import { NextRequest, NextResponse } from 'next/server';

export interface CVEItem {
  id: string;
  description: string;
  severity: string | null;
  score: number | null;
  published: string;
  lastModified: string;
  references: string[];
  weaknesses: string | null;
}

interface NVDCVSSData {
  baseSeverity: string;
  baseScore: number;
}

interface NVDCVSSMetric {
  cvssData: NVDCVSSData;
}

interface NVDMetrics {
  cvssMetricV31?: NVDCVSSMetric[];
  cvssMetricV30?: NVDCVSSMetric[];
}

interface NVDDescription {
  lang: string;
  value: string;
}

interface NVDWeaknessDesc {
  lang: string;
  value: string;
}

interface NVDWeakness {
  description: NVDWeaknessDesc[];
}

interface NVDReference {
  url: string;
}

interface NVDCVEItem {
  id: string;
  descriptions: NVDDescription[];
  published: string;
  lastModified: string;
  metrics?: NVDMetrics;
  references: NVDReference[];
  weaknesses?: NVDWeakness[];
}

interface NVDVulnerability {
  cve: NVDCVEItem;
}

interface NVDResponse {
  vulnerabilities?: NVDVulnerability[];
  totalResults?: number;
}

function formatNVDDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, '.000');
}

const MAX_DAYS = 120;
const MIN_DAYS = 1;
const DEFAULT_DAYS = 7;
const MAX_KEYWORD_LENGTH = 128;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keywordRaw = searchParams.get('keyword')?.trim() ?? '';
  const keyword = keywordRaw.length > 0 && keywordRaw.length <= MAX_KEYWORD_LENGTH ? keywordRaw : null;

  const parsedDays = parseInt(searchParams.get('days') ?? String(DEFAULT_DAYS), 10);
  const days = Number.isFinite(parsedDays)
    ? Math.min(MAX_DAYS, Math.max(MIN_DAYS, parsedDays))
    : DEFAULT_DAYS;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const PAGE_SIZE = 100;
  const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
  const NVD_HEADERS = { 'User-Agent': 'cybersec-blog/1.0' };
  const NVD_REVALIDATE = { next: { revalidate: 300 } };

  // Build base params (date window + optional keyword) — shared by probe + fetch.
  const baseParams = new URLSearchParams();
  baseParams.set('pubStartDate', formatNVDDate(startDate));
  baseParams.set('pubEndDate', formatNVDDate(endDate));
  if (keyword) baseParams.set('keywordSearch', keyword);

  try {
    // NVD 2.0 default sort = published ASC; without startIndex, we get the
    // OLDEST 100. Two-call strategy: probe to learn totalResults, then fetch
    // the last 100 (newest). NVD anonymous rate limit is 5 req per 30 sec;
    // we use 2 per user action, well within budget.
    const probeParams = new URLSearchParams(baseParams);
    probeParams.set('resultsPerPage', '1');
    const probeUrl = `${NVD_BASE}?${probeParams.toString()}`;
    const probeRes = await fetch(probeUrl, { headers: NVD_HEADERS, ...NVD_REVALIDATE });
    if (!probeRes.ok) {
      throw new Error(`NVD probe returned ${probeRes.status}`);
    }
    const probeData: NVDResponse = await probeRes.json();
    const totalResults = probeData.totalResults ?? 0;
    const startIndex = Math.max(0, totalResults - PAGE_SIZE);

    const fetchParams = new URLSearchParams(baseParams);
    fetchParams.set('resultsPerPage', String(PAGE_SIZE));
    fetchParams.set('startIndex', String(startIndex));
    const fetchUrl = `${NVD_BASE}?${fetchParams.toString()}`;
    const res = await fetch(fetchUrl, { headers: NVD_HEADERS, ...NVD_REVALIDATE });

    if (!res.ok) {
      throw new Error(`NVD fetch returned ${res.status}`);
    }

    const data: NVDResponse = await res.json();

    const cves: CVEItem[] = (data.vulnerabilities ?? []).map((v: NVDVulnerability) => {
      const cve = v.cve;
      const description =
        cve.descriptions?.find((d: NVDDescription) => d.lang === 'en')?.value ??
        cve.descriptions?.[0]?.value ??
        'No description available';

      const cvssV31 = cve.metrics?.cvssMetricV31?.[0];
      const cvssV30 = cve.metrics?.cvssMetricV30?.[0];
      const cvss = cvssV31 ?? cvssV30;

      return {
        id: cve.id,
        description,
        severity: cvss?.cvssData?.baseSeverity ?? null,
        score: cvss?.cvssData?.baseScore ?? null,
        published: cve.published,
        lastModified: cve.lastModified,
        references: (cve.references ?? []).slice(0, 3).map((r: NVDReference) => r.url),
        weaknesses: cve.weaknesses?.[0]?.description?.[0]?.value ?? null,
      };
    });

    return NextResponse.json(
      {
        cves,
        total: data.totalResults ?? cves.length,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: message,
        cves: [],
        total: 0,
        fetchedAt: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
