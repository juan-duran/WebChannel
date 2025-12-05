export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  return /iPhone|iPad|iPod/.test(ua) && /AppleWebKit/.test(ua);
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;

  const mq = window.matchMedia && window.matchMedia('(display-mode: standalone)');
  const isStandaloneMq = mq && mq.matches;

  // Safari iOS standalone
  // @ts-expect-error
  const isStandaloneSafari = typeof window.navigator.standalone !== 'undefined' && window.navigator.standalone === true;

  return Boolean(isStandaloneMq || isStandaloneSafari);
}
