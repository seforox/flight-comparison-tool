import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ApiGatewayGuard } from './api-gateway.guard';

function createMockContext(
  method: string,
  path: string,
  headers: Record<string, string> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, path, url: path, headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApiGatewayGuard', () => {
  const originalEnv = { ...process.env };
  let guard: ApiGatewayGuard;

  beforeEach(() => {
    process.env = { ...originalEnv };
    guard = new ApiGatewayGuard();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows all requests when API_GATEWAY_ENABLED is not true', () => {
    process.env.API_GATEWAY_ENABLED = 'false';
    const ctx = createMockContext('GET', '/alerts');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows GET /health without secret when enabled', () => {
    process.env.API_GATEWAY_ENABLED = 'true';
    process.env.API_GATEWAY_SECRET = 'super-secret-value';
    const ctx = createMockContext('GET', '/health');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks requests missing or with wrong secret when enabled', () => {
    process.env.API_GATEWAY_ENABLED = 'true';
    process.env.API_GATEWAY_SECRET = 'super-secret-value';

    expect(() => guard.canActivate(createMockContext('POST', '/auth/register'))).toThrow(
      ForbiddenException,
    );
    expect(() =>
      guard.canActivate(
        createMockContext('POST', '/auth/register', { 'x-api-gateway-secret': 'wrong' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows requests with valid secret when enabled', () => {
    process.env.API_GATEWAY_ENABLED = 'true';
    process.env.API_GATEWAY_SECRET = 'super-secret-value';

    const ctx = createMockContext('GET', '/airports', {
      'x-api-gateway-secret': 'super-secret-value',
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
