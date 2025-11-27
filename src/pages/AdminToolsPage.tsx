import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';

type CacheStats = {
  size?: number;
  maxSize?: number;
  ttlMs?: number;
  inflightRequests?: number;
  hits?: number;
  misses?: number;
  inflight?: number;
  entries?: number;
  evictions?: number;
};

type CacheInvalidation = {
  id: string;
  key_prefix: string;
  invalidated_by: string;
  reason: string | null;
  invalidated_at: string;
};

export function AdminToolsPage() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [invalidations, setInvalidations] = useState<CacheInvalidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invalidatePrefix, setInvalidatePrefix] = useState('');
  const [invalidateKeys, setInvalidateKeys] = useState('');
  const [invalidateReason, setInvalidateReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, invalidationsRes] = await Promise.all([
        fetch('/admin/cache/stats', { credentials: 'include' }),
        fetch('/admin/cache/invalidations', { credentials: 'include' }),
      ]);

      if (!statsRes.ok) {
        throw new Error('Falha ao carregar estatísticas de cache (verifique se você é admin).');
      }
      const statsData = await statsRes.json();
      setStats(statsData);

      if (!invalidationsRes.ok) {
        throw new Error('Falha ao carregar histórico de invalidações (verifique se você é admin).');
      }
      const invalidationsData = (await invalidationsRes.json()) as { data?: CacheInvalidation[] };
      setInvalidations(invalidationsData.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados de admin.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInvalidate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        reason: invalidateReason || undefined,
      };

      if (invalidatePrefix.trim()) {
        body.prefix = invalidatePrefix.trim();
      }

      const keys = invalidateKeys
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      if (keys.length > 0) {
        body.keys = keys;
      }

      if (!body.prefix && !body.keys) {
        throw new Error('Informe um prefixo ou uma lista de keys para invalidar.');
      }

      const res = await fetch('/admin/cache/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Falha ao invalidar cache.');
      }

      await fetchData();
      setInvalidatePrefix('');
      setInvalidateKeys('');
      setInvalidateReason('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao invalidar cache.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const ttlMinutes = useMemo(() => {
    if (!stats?.ttlMs) return null;
    return Math.round((stats.ttlMs / 1000 / 60) * 10) / 10;
  }, [stats]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Tools</h1>
          <p className="text-sm text-gray-600">Cache observability and invalidation controls.</p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Erro</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Cache Stats</h2>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : stats ? (
            <dl className="grid grid-cols-2 gap-3 text-sm text-gray-700">
              <div>
                <dt className="text-gray-500">Entries</dt>
                <dd className="font-semibold">{stats.entries ?? stats.size ?? 0}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Hits</dt>
                <dd className="font-semibold">{stats.hits ?? 0}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Misses</dt>
                <dd className="font-semibold">{stats.misses ?? 0}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Evictions</dt>
                <dd className="font-semibold">{stats.evictions ?? 0}</dd>
              </div>
              <div>
                <dt className="text-gray-500">TTL</dt>
                <dd className="font-semibold">{ttlMinutes ? `${ttlMinutes} min` : 'N/D'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Max size</dt>
                <dd className="font-semibold">{stats.maxSize ?? 'N/D'}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">Sem dados.</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">Invalidar Cache</h2>
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Prefixo (opcional)</span>
              <input
                type="text"
                value={invalidatePrefix}
                onChange={(e) => setInvalidatePrefix(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="ex: summary:"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Keys (opcional, separadas por vírgula)</span>
              <input
                type="text"
                value={invalidateKeys}
                onChange={(e) => setInvalidateKeys(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="ex: summary:assunto=1&topico=2, trends:d=2025-11-27"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Motivo (opcional)</span>
              <input
                type="text"
                value={invalidateReason}
                onChange={(e) => setInvalidateReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="ex: nova carga de trends"
              />
            </label>
            <button
              type="button"
              onClick={handleInvalidate}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {submitting ? 'Invalidando...' : 'Invalidar'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Histórico de Invalidações</h2>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : invalidations.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma invalidação registrada.</p>
        ) : (
          <div className="space-y-2">
            {invalidations.map((inv) => (
              <div
                key={inv.id}
                className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-800"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 mb-1">
                  <span className="font-semibold">{inv.invalidated_by}</span>
                  <span className="text-gray-400">·</span>
                  <span>{new Date(inv.invalidated_at).toLocaleString('pt-BR')}</span>
                </div>
                <p className="font-semibold text-gray-900">Prefix/Keys: {inv.key_prefix}</p>
                {inv.reason && <p className="text-gray-700">Motivo: {inv.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
