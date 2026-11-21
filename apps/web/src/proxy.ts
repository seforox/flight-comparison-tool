import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

const ACCESS_COOKIE_NAME = 'vflights_access';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function deriveCookieToken(accessKey: string): string {
  return createHmac('sha256', accessKey)
    .update('vflights-private-access-v1')
    .digest('hex');
}

function applySecurityHeaders(response: NextResponse, blockSearchEngines: boolean): NextResponse {
  if (blockSearchEngines) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return response;
}

export function proxy(request: NextRequest) {
  const privateAccessEnabled = process.env.PRIVATE_ACCESS_ENABLED === 'true';
  const blockSearchEngines =
    process.env.BLOCK_SEARCH_ENGINES === 'true' ||
    (process.env.BLOCK_SEARCH_ENGINES !== 'false' && privateAccessEnabled);

  if (!privateAccessEnabled) {
    return applySecurityHeaders(NextResponse.next(), blockSearchEngines);
  }

  const accessKey = process.env.SITE_ACCESS_KEY;
  if (!accessKey) {
    const res = new NextResponse(
      'Configuración incompleta: activa SITE_ACCESS_KEY o desactiva PRIVATE_ACCESS_ENABLED.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
    return applySecurityHeaders(res, blockSearchEngines);
  }

  const expectedToken = deriveCookieToken(accessKey);
  const cookieToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;

  if (cookieToken && safeCompare(cookieToken, expectedToken)) {
    return applySecurityHeaders(NextResponse.next(), blockSearchEngines);
  }

  const queryKey = request.nextUrl.searchParams.get('key');
  if (queryKey && safeCompare(queryKey, accessKey)) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete('key');

    const response = NextResponse.redirect(cleanUrl, 302);
    response.cookies.set(ACCESS_COOKIE_NAME, expectedToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });
    return applySecurityHeaders(response, blockSearchEngines);
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    const res = NextResponse.json(
      { message: 'Acceso privado restringido' },
      { status: 403 },
    );
    return applySecurityHeaders(res, blockSearchEngines);
  }

  const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Acceso privado | V Flights</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f7fb; color: #0b2239; font-family: system-ui, -apple-system, sans-serif; padding: 1.5rem; }
      main { max-width: 420px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem; text-align: center; box-shadow: 0 10px 30px rgba(11, 34, 57, 0.08); }
      h1 { margin: 0 0 0.75rem; font-size: 1.25rem; }
      p { margin: 0; color: #475569; line-height: 1.5; font-size: 0.95rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Acceso privado</h1>
      <p>Esta aplicación está restringida. Necesitas un enlace de invitación válido para acceder.</p>
    </main>
  </body>
</html>`;

  const res = new NextResponse(html, {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
  return applySecurityHeaders(res, blockSearchEngines);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
