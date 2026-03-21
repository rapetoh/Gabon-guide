import { NextResponse } from 'next/server'

// Resolves a short/redirect URL (e.g. maps.app.goo.gl) to the final URL.
// Used by PlaceForm to extract coordinates from Google Maps share links.
export async function POST(req: Request) {
  const { url } = await req.json()

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    return NextResponse.json({ resolvedUrl: response.url })
  } catch {
    return NextResponse.json({ error: 'Could not resolve URL' }, { status: 400 })
  }
}
