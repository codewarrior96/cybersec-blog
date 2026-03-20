import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // CIRCL.lu API limits request frequency so Next.js revalidate (cache) is important 
    const res = await fetch('https://cve.circl.lu/api/last', { 
      next: { revalidate: 600 } // Cache for 10 minutes to respect rate limits
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch from CIRCL.lu. Status: ${res.status}`);
    }
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API/CVE] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch CVE data' }, { status: 500 });
  }
}
