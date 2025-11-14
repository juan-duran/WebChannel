import React, { useMemo, useState, type MouseEvent } from 'react';
import { ExternalLink, Eye, EyeOff } from 'lucide-react';
import type { TrendAssetMetadata } from '../../types/tapNavigation';

const IMAGE_PATTERN = /\.(?:apng|avif|gif|jpe?g|jfif|pjpeg|pjp|png|svg|webp)$/i;
const VIDEO_PATTERN = /\.(?:mp4|webm|ogg|ogv|m4v|mov)$/i;

const normalizeString = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const extractYouTubeId = (url?: string): string | undefined => {
  if (!url) {
    return undefined;
  }
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/i);
  if (youtubeMatch && youtubeMatch[1]) {
    return youtubeMatch[1];
  }
  return undefined;
};

const extractIframeSrc = (html?: string | null): string | undefined => {
  const trimmed = normalizeString(html);
  if (!trimmed) {
    return undefined;
  }
  if (!/^<iframe/i.test(trimmed)) {
    return undefined;
  }
  const srcMatch = trimmed.match(/src\s*=\s*\"([^\"]+)\"/i) ?? trimmed.match(/src\s*=\s*'([^']+)'/i);
  const src = srcMatch?.[1];
  if (!src || !/^https?:\/\//i.test(src)) {
    return undefined;
  }
  if (src.toLowerCase().startsWith('javascript:')) {
    return undefined;
  }
  return src;
};

export type TrendAssetPreviewProps = {
  asset?: TrendAssetMetadata;
  fallbackUrl?: string | null;
  fallbackTitle?: string;
  fallbackDescription?: string;
  className?: string;
};

export function TrendAssetPreview({
  asset,
  fallbackUrl,
  fallbackTitle,
  fallbackDescription,
  className,
}: TrendAssetPreviewProps) {
  const assetUrl = useMemo(() => {
    const candidates = [asset?.assetUrl, fallbackUrl];
    for (const candidate of candidates) {
      const normalized = normalizeString(candidate ?? undefined);
      if (normalized) {
        return normalized;
      }
    }
    return undefined;
  }, [asset?.assetUrl, fallbackUrl]);

  const assetThumbnail = useMemo(() => normalizeString(asset?.assetThumbnail), [asset?.assetThumbnail]);
  const assetTitle = asset?.assetTitle ?? fallbackTitle;
  const assetDescription = asset?.assetDescription ?? fallbackDescription;
  const assetType = normalizeString(asset?.assetType)?.toLowerCase();
  const iframeSrc = useMemo(() => extractIframeSrc(asset?.assetEmbedHtml), [asset?.assetEmbedHtml]);
  const youtubeId = useMemo(() => extractYouTubeId(assetUrl), [assetUrl]);

  const normalizedThumbnail = assetThumbnail ?? undefined;
  const normalizedTitle = normalizeString(assetTitle);
  const normalizedDescription = normalizeString(assetDescription);

  const embedSrc = useMemo(() => {
    if (iframeSrc) {
      return iframeSrc;
    }
    if (youtubeId) {
      return `https://www.youtube.com/embed/${youtubeId}`;
    }
    return undefined;
  }, [iframeSrc, youtubeId]);

  const normalizedType = useMemo<'image' | 'video' | 'embed' | 'article' | 'link' | 'none'>(() => {
    if (!asset && !assetUrl && !normalizedThumbnail && !normalizedTitle && !normalizedDescription) {
      return 'none';
    }

    if (embedSrc) {
      return 'embed';
    }

    if (assetType?.includes('image')) {
      return 'image';
    }

    if (assetType?.includes('video') || assetType?.includes('media') || assetType?.includes('clip')) {
      return youtubeId ? 'embed' : 'video';
    }

    if (assetType?.includes('article') || assetType?.includes('news') || assetType?.includes('story')) {
      return 'article';
    }

    if (assetType?.includes('link') && (normalizedTitle || normalizedDescription)) {
      return 'article';
    }

    if (assetUrl && IMAGE_PATTERN.test(assetUrl)) {
      return 'image';
    }

    if (assetUrl && (VIDEO_PATTERN.test(assetUrl) || youtubeId)) {
      return youtubeId ? 'embed' : 'video';
    }

    if (normalizedThumbnail && (normalizedTitle || normalizedDescription)) {
      return 'article';
    }

    if (normalizedTitle && normalizedDescription) {
      return 'article';
    }

    if (assetUrl) {
      return 'link';
    }

    return 'none';
  }, [asset, assetType, assetUrl, embedSrc, normalizedDescription, normalizedThumbnail, normalizedTitle, youtubeId]);

  const [isCollapsed, setIsCollapsed] = useState(false);

  if (normalizedType === 'none') {
    return null;
  }

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsCollapsed((previous) => !previous);
  };

  const handleContainerClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const containerClasses = `rounded-xl border border-gray-200 bg-white/80 shadow-sm ${className ?? ''}`.trim();

  if (normalizedType === 'article' && assetUrl) {
    return (
      <div className={containerClasses} onClick={handleContainerClick}>
        <a
          href={assetUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="group flex gap-3 p-4"
        >
          {normalizedThumbnail ? (
            <img
              src={normalizedThumbnail}
              alt={normalizedTitle ?? 'Prévia do artigo'}
              className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
              loading="lazy"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 line-clamp-2">
              {normalizedTitle ?? 'Visualizar conteúdo'}
            </p>
            {normalizedDescription ? (
              <p className="mt-1 text-xs text-gray-600 line-clamp-3">{normalizedDescription}</p>
            ) : null}
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
              Abrir matéria
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </span>
          </div>
        </a>
      </div>
    );
  }

  if (normalizedType === 'image' || normalizedType === 'video' || normalizedType === 'embed') {
    const hasMediaContent =
      (normalizedType === 'image' && Boolean(assetUrl)) ||
      (normalizedType === 'video' && Boolean(assetUrl)) ||
      (normalizedType === 'embed' && Boolean(embedSrc));

    if (!hasMediaContent) {
      return null;
    }

    const shouldShowToggle = true;

    return (
      <div className={containerClasses} onClick={handleContainerClick}>
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Prévia do conteúdo</p>
          {shouldShowToggle ? (
            <button
              type="button"
              onClick={handleToggle}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600"
            >
              {isCollapsed ? (
                <React.Fragment>
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Ver
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Ocultar
                </React.Fragment>
              )}
            </button>
          ) : null}
        </div>
        {!isCollapsed ? (
          <div className="mt-3 overflow-hidden">
            {normalizedType === 'image' && assetUrl ? (
              <img
                src={assetUrl}
                alt={normalizedTitle ?? 'Imagem relacionada ao assunto'}
                className="h-auto w-full rounded-b-xl object-cover"
                loading="lazy"
              />
            ) : normalizedType === 'video' && assetUrl ? (
              <video
                controls
                preload="metadata"
                className="h-auto w-full rounded-b-xl bg-black"
              >
                <source src={assetUrl} />
                Seu navegador não suporta a reprodução de vídeo.
              </video>
            ) : embedSrc ? (
              <div className="aspect-video w-full">
                <iframe
                  src={embedSrc}
                  title={normalizedTitle ?? 'Player de vídeo'}
                  className="h-full w-full rounded-b-xl"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (normalizedType === 'link' && assetUrl) {
    return (
      <div className={containerClasses} onClick={handleContainerClick}>
        <a
          href={assetUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="flex items-center justify-between gap-3 p-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          <span className="truncate">Abrir conteúdo relacionado</span>
          <ExternalLink className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return null;
}
