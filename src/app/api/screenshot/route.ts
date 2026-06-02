import { NextRequest, NextResponse } from "next/server";

async function fetchOgImage(
  pageUrl: string
): Promise<{ contentType: string; buffer: ArrayBuffer } | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        // Mimic a social crawler so sites serve OG tags
        "User-Agent": "Mozilla/5.0 (compatible; facebookexternalhit/1.1)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Match og:image or twitter:image in either attribute order
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

    if (!match?.[1]) return null;

    let imgUrl = match[1].trim().replace(/&amp;/g, "&");

    if (imgUrl.startsWith("//")) imgUrl = `https:${imgUrl}`;
    else if (imgUrl.startsWith("/")) {
      const base = new URL(pageUrl);
      imgUrl = `${base.origin}${imgUrl}`;
    }

    if (!/^https?:\/\//i.test(imgUrl)) return null;

    const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(8_000) });
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    return { contentType, buffer: await imgRes.arrayBuffer() };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Invalid URL scheme" }, { status: 400 });
  }

  // 1. Try OG / twitter:image — fast, already optimized for previews
  const og = await fetchOgImage(url);
  if (og) {
    return new NextResponse(og.buffer, {
      headers: {
        "Content-Type": og.contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  // 2. Fall back to thum.io screenshot
  try {
    const screenshotUrl = `https://image.thum.io/get/width/1280/crop/720/${url}`;
    const res = await fetch(screenshotUrl, {
      headers: { "User-Agent": "nandzz/1.0" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Screenshot service failed" }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Screenshot service returned non-image" }, { status: 502 });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Screenshot service failed" }, { status: 502 });
  }
}
