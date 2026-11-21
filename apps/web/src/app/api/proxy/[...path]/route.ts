import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function getBackendBaseUrl(): string {
  const url =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001';
  return url.replace(/\/$/, '');
}

async function handleProxy(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params;
  const targetPath = (path || []).join('/');
  const search = request.nextUrl.search || '';
  const targetUrl = `${getBackendBaseUrl()}/${targetPath}${search}`;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const authorization = request.headers.get('authorization');
  const accept = request.headers.get('accept');

  if (contentType) headers.set('content-type', contentType);
  if (authorization) headers.set('authorization', authorization);
  if (accept) headers.set('accept', accept);

  if (process.env.API_GATEWAY_ENABLED === 'true' && process.env.API_GATEWAY_SECRET) {
    headers.set('x-api-gateway-secret', process.env.API_GATEWAY_SECRET);
  }

  const method = request.method.toUpperCase();
  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody && body && body.byteLength > 0 ? body : undefined,
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    const upstreamContentType = upstream.headers.get('content-type');
    if (upstreamContentType) {
      responseHeaders.set('content-type', upstreamContentType);
    }

    if (upstream.status === 204 || upstream.status === 304) {
      return new NextResponse(null, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    const responseBody = await upstream.arrayBuffer();
    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[API Proxy] Error conectando con el backend:', error);
    return NextResponse.json(
      { message: 'No se pudo conectar con el servidor de la API' },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}
