import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Only allow http/https
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Invalid URL scheme" }, { status: 400 });
  }

  const screenshotUrl = `https://screenshot.microlink.io/?url=${encodeURIComponent(url)}&meta=false&type=jpeg&quality=80&viewport.width=1280&viewport.height=720`;

  const res = await fetch(screenshotUrl, {
    headers: { "User-Agent": "nandzz/1.0" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Screenshot service failed" },
      { status: 502 }
    );
  }

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = await res.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
