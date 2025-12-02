export function trackPageView(path: string) {
  if (typeof window === 'undefined') return;
  const gtag = (window as any).gtag;
  if (!gtag) return;

  gtag('event', 'page_view', {
    page_path: path,
  });
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined | null>,
) {
  if (typeof window === 'undefined') return;
  const gtag = (window as any).gtag;
  if (!gtag) return;

  gtag('event', eventName, params || {});
}
