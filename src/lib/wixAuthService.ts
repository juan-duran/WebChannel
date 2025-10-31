export interface WixUser {
  email: string;
  token: string;
  subscriptionStatus: 'active' | 'expired' | 'trial';
  expiresAt: number;
}

const TOKEN_KEY = 'wix_auth_token';
const WIX_VELO_ENDPOINT = import.meta.env.VITE_WIX_AUTH_ENDPOINT || 'https://your-wix-site.com/_functions/validateSubscription';

export async function requestWixToken(email: string): Promise<WixUser> {
  try {
    const response = await fetch(WIX_VELO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Assinatura não encontrada');
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('Token inválido recebido do servidor');
    }

    const user: WixUser = {
      email: data.email || email,
      token: data.token,
      subscriptionStatus: data.subscriptionStatus || 'active',
      expiresAt: data.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000,
    };

    storeWixToken(user);
    return user;
  } catch (error) {
    throw error;
  }
}

export function storeWixToken(user: WixUser): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(user));
}

export function getStoredWixToken(): WixUser | null {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;

    const user: WixUser = JSON.parse(stored);

    if (isTokenExpired(user.token)) {
      clearWixToken();
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export function clearWixToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function parseJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = parseJWT(token);
    if (!payload || !payload.exp) return true;

    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export function getTokenEmail(token: string): string | null {
  try {
    const payload = parseJWT(token);
    return payload?.email || null;
  } catch {
    return null;
  }
}

export function getSubscriptionStatus(token: string): string | null {
  try {
    const payload = parseJWT(token);
    return payload?.subscriptionStatus || null;
  } catch {
    return null;
  }
}

export async function refreshWixToken(email: string): Promise<WixUser | null> {
  try {
    return await requestWixToken(email);
  } catch {
    return null;
  }
}

export function shouldRefreshToken(user: WixUser): boolean {
  try {
    const payload = parseJWT(user.token);
    if (!payload || !payload.exp) return true;

    const expiresIn = payload.exp * 1000 - Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    return expiresIn < oneDayInMs;
  } catch {
    return true;
  }
}
