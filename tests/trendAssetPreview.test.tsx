import React from 'react';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import { TrendAssetPreview } from '../src/components/tap/TrendAssetPreview';

type RenderResult = string;

const render = (element: JSX.Element): RenderResult => renderToStaticMarkup(element);

const imageMarkup = render(
  <TrendAssetPreview asset={{ assetUrl: 'https://example.com/trend.png', assetType: 'image' }} fallbackTitle="Prévia" />,
);
assert.ok(imageMarkup.includes('<img'), 'expected image preview to render an <img> element');

const videoMarkup = render(
  <TrendAssetPreview asset={{ assetUrl: 'https://example.com/video.mp4', assetType: 'video' }} fallbackTitle="Vídeo" />,
);
assert.ok(videoMarkup.includes('<video'), 'expected video preview to render a <video> element');

const articleMarkup = render(
  <TrendAssetPreview
    asset={{
      assetUrl: 'https://example.com/news/trend',
      assetType: 'article',
      assetThumbnail: 'https://example.com/news/cover.png',
      assetTitle: 'Título do artigo',
      assetDescription: 'Resumo do conteúdo relacionado ao assunto.',
    }}
  />,
);
assert.ok(articleMarkup.includes('Abrir matéria'), 'expected article preview to render the article call-to-action');

console.log('TrendAssetPreview component tests passed.');
