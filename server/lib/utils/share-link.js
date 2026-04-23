const crypto = require('node:crypto');

function asString(value) {
  if (value == null) return '';
  return String(value);
}

function normalizeSecret(secret) {
  return asString(secret).trim();
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getSharePayload({ fileId, expiresAt }) {
  return `${asString(fileId)}:${Number(expiresAt || 0)}`;
}

function signSharePayload(payload, secret) {
  const normalizedSecret = normalizeSecret(secret);
  if (!normalizedSecret) {
    throw new Error('Share signing secret is required.');
  }
  return base64url(
    crypto.createHmac('sha256', normalizedSecret).update(payload).digest()
  );
}

function createShareSignature({ fileId, expiresAt, secret }) {
  return signSharePayload(getSharePayload({ fileId, expiresAt }), secret);
}

function verifyShareSignature({ fileId, expiresAt, signature, secret }) {
  const actual = asString(signature);
  if (!actual) return false;
  if (!normalizeSecret(secret)) return false;

  const expected = createShareSignature({ fileId, expiresAt, secret });
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

module.exports = {
  createShareSignature,
  verifyShareSignature,
};
