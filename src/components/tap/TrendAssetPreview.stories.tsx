import { TrendAssetPreview } from './TrendAssetPreview';

export default { title: 'Tap/TrendAssetPreview' };

export const ImagePreview = () => (
  <div className="max-w-md">
    <TrendAssetPreview
      asset={{ assetUrl: 'https://via.placeholder.com/640x360.png?text=Imagem', assetType: 'image' }}
      fallbackTitle="Imagem do trending topic"
    />
  </div>
);

export const VideoPreview = () => (
  <div className="max-w-md">
    <TrendAssetPreview
      asset={{ assetUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4', assetType: 'video' }}
      fallbackTitle="Vídeo do assunto"
    />
  </div>
);

export const ArticlePreview = () => (
  <div className="max-w-md">
    <TrendAssetPreview
      asset={{
        assetUrl: 'https://example.com/news/trend',
        assetType: 'article',
        assetThumbnail: 'https://via.placeholder.com/96x96.png?text=News',
        assetTitle: 'Assunto em destaque',
        assetDescription: 'Cobertura detalhada sobre o assunto quente do momento.',
      }}
    />
  </div>
);
