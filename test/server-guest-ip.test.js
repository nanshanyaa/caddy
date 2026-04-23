const assert = require('assert');
const { getClientIp } = require('../server/lib/utils/guest');

describe('Guest client IP handling', function () {
  it('prefers the reverse proxy real IP over spoofable forwarded chains', function () {
    const request = new Request('http://localhost/upload', {
      headers: {
        'x-real-ip': '203.0.113.10',
        'x-forwarded-for': '198.51.100.5, 203.0.113.10',
      },
    });

    assert.strictEqual(getClientIp(request), '203.0.113.10');
  });

  it('uses the last forwarded hop when x-real-ip is absent', function () {
    const request = new Request('http://localhost/upload', {
      headers: {
        'x-forwarded-for': '198.51.100.5, 203.0.113.10',
      },
    });

    assert.strictEqual(getClientIp(request), '203.0.113.10');
  });

  it('can ignore proxy IP headers when configured', function () {
    const request = new Request('http://localhost/upload', {
      headers: {
        'x-real-ip': '203.0.113.10',
        'x-forwarded-for': '198.51.100.5, 203.0.113.10',
      },
    });

    assert.strictEqual(getClientIp(request, false), '0.0.0.0');
  });
});
