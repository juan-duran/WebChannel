import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProgressProps {
  message?: string;
  duration?: number;
}

const LOADING_MESSAGES = [
  'Quenty está analisando as conversas...',
  'Buscando os debates sociais mais recentes...',
  'Refinando o seu briefing...',
  'Coletando insights das discussões...',
  'Sintetizando os tópicos principais...',
];

export function LoadingProgress({ message, duration = 10000 }: LoadingProgressProps) {
  const [currentMessage, setCurrentMessage] = useState(message || LOADING_MESSAGES[0]);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (message) return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => {
        const next = (prev + 1) % LOADING_MESSAGES.length;
        setCurrentMessage(LOADING_MESSAGES[next]);
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [message]);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="relative">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <div className="absolute inset-0 rounded-full bg-blue-100 opacity-20 animate-pulse" />
      </div>
      <p className="mt-6 text-sm text-gray-600 text-center max-w-md animate-fadeIn">
        {currentMessage}
      </p>
      <div className="mt-4 flex gap-1">
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

export function TrendSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
          <div className="flex-shrink-0 w-5 h-5 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

export function TopicSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-200" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-2 bg-gray-100 rounded w-full" />
          </div>
          <div className="flex-shrink-0 w-4 h-4 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}
