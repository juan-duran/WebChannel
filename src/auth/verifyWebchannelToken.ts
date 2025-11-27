import CryptoJS from 'crypto-js';

export type WebchannelTokenPayload = {
  email: string;
  iat: number;
  exp: number;
  iss: 'quenty.com.br';
  aud: 'webchannel';
};

const WEBCHANNEL_ISSUER = 'quenty.com.br';
const WEBCHANNEL_AUDIENCE = 'webchannel';

function base64UrlEncode(wordArray: CryptoJS.lib.WordArray): string {
  return CryptoJS.enc.Base64.stringify(wordArray)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const parsed = CryptoJS.enc.Base64.parse(padded);
  return CryptoJS.enc.Utf8.stringify(parsed);
}

export function verifyWebchannelToken(token: string): WebchannelTokenPayload | null {
  const secret = process.env.WEBCHANNEL_HMAC_SECRET;
  if (!secret) {
    throw new Error('WEBCHANNEL_HMAC_SECRET is not set');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const expectedSignature = base64UrlEncode(CryptoJS.HmacSHA256(`${header}.${payload}`, secret));

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const decodedPayload = JSON.parse(base64UrlDecode(payload)) as Partial<WebchannelTokenPayload>;

    if (
      decodedPayload.iss !== WEBCHANNEL_ISSUER ||
      decodedPayload.aud !== WEBCHANNEL_AUDIENCE ||
      typeof decodedPayload.email !== 'string' ||
      typeof decodedPayload.exp !== 'number' ||
      typeof decodedPayload.iat !== 'number'
    ) {
      return null;
    }

    const nowInSeconds = Date.now() / 1000;
    if (decodedPayload.exp <= nowInSeconds) {
      return null;
    }

    return decodedPayload as WebchannelTokenPayload;
  } catch (error) {
    console.error('Failed to verify Webchannel token', error);
    return null;
  }
}
