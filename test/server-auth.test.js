const assert = require('assert');
const { loadConfig } = require('../server/lib/config');
const { AuthService, buildCookieHeader, parseCookies } = require('../server/lib/utils/auth');

describe('Server auth utilities', function () {
  it('does not throw on malformed percent-encoded cookies', function () {
    assert.deepStrictEqual(parseCookies('k_vault_session=%E0%A4%A; theme=dark'), {
      k_vault_session: '%E0%A4%A',
      theme: 'dark',
    });
  });

  it('can mark session cookies as Secure when configured', function () {
    const header = buildCookieHeader('k_vault_session', 'abc123', {
      maxAge: 60,
      secure: true,
    });

    assert.ok(header.includes('HttpOnly'));
    assert.ok(header.includes('SameSite=Strict'));
    assert.ok(header.includes('Secure'));
  });

  it('applies Secure to login and logout cookies from AuthService', function () {
    const service = new AuthService(null, {
      sessionCookieName: 'k_vault_session',
      sessionDurationMs: 60_000,
      sessionCookieSecure: true,
    });

    assert.ok(service.createSessionCookie('token').includes('Secure'));
    assert.ok(service.createClearSessionCookies().every((cookie) => cookie.includes('Secure')));
  });

  it('defaults session cookies to Secure when PUBLIC_BASE_URL is HTTPS', function () {
    const config = loadConfig({
      PUBLIC_BASE_URL: 'https://img.example.com',
      CONFIG_ENCRYPTION_KEY: 'auth_test_key_123456',
      SESSION_SECRET: 'auth_test_secret_123456',
    });

    assert.strictEqual(config.sessionCookieSecure, true);
  });
});
