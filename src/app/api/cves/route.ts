import { NextResponse } from 'next/server';

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

const WINDOW_DAYS = 30;

export async function GET() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - WINDOW_DAYS);

  const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
  const NVD_HEADERS = { 'User-Agent': 'cybersec-blog/1.0' };
  const NVD_REVALIDATE = { next: { revalidate: 300 } };
  const NVD_MAX_PAGE = 2000;

  // Single-call strategy: query CRITICAL-only CVEs in the 30-day window.
  // CRITICAL volume (~5-15/day at NVD) yields ~150-450 entries per month,
  // well within NVD 2.0's resultsPerPage cap of 2000. Frontend takes the
  // top 20 by CVSS score; Salim's vision is a curated live feed, not a
  // comprehensive CVE list. NVD anonymous rate limit (5 req/30s) easily
  // accommodated; cached server-side for 5 min.
  const nvdParams = new URLSearchParams();
  nvdParams.set('pubStartDate', formatNVDDate(startDate));
  nvdParams.set('pubEndDate', formatNVDDate(endDate));
  nvdParams.set('cvssV3Severity', 'CRITICAL');
  nvdParams.set('resultsPerPage', String(NVD_MAX_PAGE));

  const nvdUrl = `${NVD_BASE}?${nvdParams.toString()}`;

  try {
    const res = await fetch(nvdUrl, { headers: NVD_HEADERS, ...NVD_REVALIDATE });

    if (!res.ok) {
      throw new Error(`NVD API returned ${res.status}`);
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
