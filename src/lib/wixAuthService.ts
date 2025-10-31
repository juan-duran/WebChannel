import { supabase } from './supabase';

export interface WixUser {
  id: string;
  email: string;
  fullName?: string;
  token: string;
  subscriptionStatus: 'active' | 'trial' | 'inactive' | 'canceled';
  expiresAt: number;
  wixCustomerId?: string;
}

const TOKEN_KEY = 'wix_auth_token';
const SESSION_KEY = 'wix_session_id';
const WIX_VELO_ENDPOINT = import.meta.env.VITE_WIX_AUTH_ENDPOINT || 'https://your-wix-site.com/_functions/validateSubscription';

async function upsertWebUser(email: string, data: any): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from('web_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing) {
    const { error: updateError } = await supabase
      .from('web_users')
      .update({
        full_name: data.fullName,
        subscription_status: data.subscriptionStatus || 'active',
        wix_customer_id: data.wixCustomerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;
    return existing.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('web_users')
      .insert({
        email,
        full_name: data.fullName,
        subscription_status: data.subscriptionStatus || 'active',
        wix_customer_id: data.wixCustomerId
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    return inserted.id;
  }
}

async function createWebSession(userId: string, token: string, expiresAt: number): Promise<string> {
  const { data, error } = await supabase
    .from('web_sessions')
    .insert({
      user_id: userId,
      access_token: token,
      expires_at: new Date(expiresAt).toISOString(),
      user_agent: navigator.userAgent
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

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

    const userId = await upsertWebUser(email, {
      fullName: data.fullName,
      subscriptionStatus: data.subscriptionStatus || 'active',
      wixCustomerId: data.wixCustomerId
    });

    const expiresAt = data.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000;
    const sessionId = await createWebSession(userId, data.token, expiresAt);

    const user: WixUser = {
      id: userId,
      email: data.email || email,
      fullName: data.fullName,
      token: data.token,
      subscriptionStatus: data.subscriptionStatus || 'active',
      expiresAt,
      wixCustomerId: data.wixCustomerId
    };

    storeWixToken(user);
    localStorage.setItem(SESSION_KEY, sessionId);
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

export async function clearWixToken(): Promise<void> {
  const sessionId = localStorage.getItem(SESSION_KEY);
  if (sessionId) {
    await supabase
      .from('web_sessions')
      .delete()
      .eq('id', sessionId);
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
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
    const refreshed = await requestWixToken(email);
    return refreshed;
  } catch {
    await clearWixToken();
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
