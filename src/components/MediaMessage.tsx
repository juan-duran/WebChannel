import { useState } from 'react';
import { Link as LinkIcon, Loader2, AlertCircle } from 'lucide-react';

interface MediaMessageProps {
  mediaUrl: string;
  mediaType?: string;
  mediaCaption?: string;
  content?: string;
}

export function MediaMessage({ mediaUrl, mediaType, mediaCaption, content }: MediaMessageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const isImage = mediaType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaUrl);
  const isVideo = mediaType?.startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(mediaUrl);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-900">Failed to load media</p>
          <p className="text-xs text-red-700 mt-1">{mediaUrl}</p>
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="max-w-md">
        {isLoading && (
          <div className="flex items-center justify-center h-48 bg-gray-100 rounded-lg">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        )}
        <img
          src={mediaUrl}
          alt={mediaCaption || 'Image'}
          className={`w-full h-auto rounded-lg shadow-md ${isLoading ? 'hidden' : ''}`}
          onLoad={handleLoad}
          onError={handleError}
        />
        {mediaCaption && (
          <p className="text-sm text-gray-700 mt-2">{mediaCaption}</p>
        )}
        {content && content !== mediaUrl && (
          <p className="text-sm text-gray-900 mt-2">{content}</p>
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="max-w-md">
        {isLoading && (
          <div className="flex items-center justify-center h-48 bg-gray-100 rounded-lg">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        )}
        <video
          src={mediaUrl}
          controls
          className={`w-full h-auto rounded-lg shadow-md ${isLoading ? 'hidden' : ''}`}
          onLoadedData={handleLoad}
          onError={handleError}
        >
          Your browser does not support the video tag.
        </video>
        {mediaCaption && (
          <p className="text-sm text-gray-700 mt-2">{mediaCaption}</p>
        )}
        {content && content !== mediaUrl && (
          <p className="text-sm text-gray-900 mt-2">{content}</p>
        )}
      </div>
    );
  }

  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors max-w-md"
    >
      <LinkIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-900 truncate">
          {mediaCaption || 'View link'}
        </p>
        <p className="text-xs text-blue-700 truncate mt-0.5">{mediaUrl}</p>
      </div>
    </a>
  );
}
