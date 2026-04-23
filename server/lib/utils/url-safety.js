const dns = require('node:dns/promises');
const net = require('node:net');

function ipv4ToNumber(address) {
  return address.split('.').reduce((value, part) => ((value << 8) + Number(part)) >>> 0, 0);
}

function isIpv4InRange(address, base, maskBits) {
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (ipv4ToNumber(address) & mask) === (ipv4ToNumber(base) & mask);
}

function isBlockedIpv4(address) {
  return [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ].some(([base, maskBits]) => isIpv4InRange(address, base, maskBits));
}

function isBlockedIpv6(address) {
  const normalized = String(address || '').toLowerCase();
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) {
    return isBlockedIpv4(mappedIpv4[1]);
  }

  const mappedHexIpv4 = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHexIpv4) {
    const high = Number.parseInt(mappedHexIpv4[1], 16);
    const low = Number.parseInt(mappedHexIpv4[2], 16);
    if (Number.isFinite(high) && Number.isFinite(low)) {
      return isBlockedIpv4([
        (high >> 8) & 255,
        high & 255,
        (low >> 8) & 255,
        low & 255,
      ].join('.'));
    }
  }

  return (
    normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe8')
    || normalized.startsWith('fe9')
    || normalized.startsWith('fea')
    || normalized.startsWith('feb')
  );
}

function isBlockedIpAddress(address) {
  const normalized = stripHostnameBrackets(address);
  const version = net.isIP(normalized);
  if (version === 4) return isBlockedIpv4(normalized);
  if (version === 6) return isBlockedIpv6(normalized);
  return false;
}

function stripHostnameBrackets(hostname) {
  return String(hostname || '').replace(/^\[|\]$/g, '');
}

function isLocalHostname(hostname) {
  const normalized = stripHostnameBrackets(hostname).toLowerCase().replace(/\.$/, '');
  return normalized === 'localhost' || normalized.endsWith('.localhost');
}

async function assertSafeHttpUrl(rawUrl, { allowPrivateNetwork = false } = {}) {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP/HTTPS URL is supported.');
  }

  if (allowPrivateNetwork) {
    return url;
  }

  if (isLocalHostname(url.hostname)) {
    throw new Error('Private or local upload URLs are blocked.');
  }

  const hostname = stripHostnameBrackets(url.hostname);
  if (net.isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) {
      throw new Error('Private or local upload URLs are blocked.');
    }
    return url;
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length) {
    throw new Error('Upload URL hostname could not be resolved.');
  }

  if (records.some((record) => isBlockedIpAddress(record.address))) {
    throw new Error('Upload URL resolves to a private or local address.');
  }

  return url;
}

module.exports = {
  assertSafeHttpUrl,
  isBlockedIpAddress,
};
