import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProgressProps {
  message?: string;
}

const LOADING_MESSAGES = [
  'Quenty está analisando as conversas...',
  'Buscando os debates sociais mais recentes...',
  'Refinando o seu briefing...',
  'Coletando insights das discussões...',
  'Sintetizando os tópicos principais...',
];

export function LoadingProgress({ message }: LoadingProgressProps) {
  const [currentMessage, setCurrentMessage] = useState(message || LOADING_MESSAGES[0]);
  const messageIndexRef = useRef(0);

  useEffect(() => {
    if (message) return;

    const interval = setInterval(() => {
      const next = (messageIndexRef.current + 1) % LOADING_MESSAGES.length;
      messageIndexRef.current = next;
      setCurrentMessage(LOADING_MESSAGES[next]);
    }, 3000);

    return () => clearInterval(interval);
  }, [message]);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="relative">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
        <div className="absolute inset-0 rounded-full bg-accent opacity-20 animate-pulse" />
      </div>
      <p className="mt-6 text-sm text-text-secondary text-center max-w-md animate-fadeIn">
        {currentMessage}
      </p>
      <div className="mt-4 flex gap-1">
        <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

export function TrendSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-border-primary bg-dark-secondary">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-dark-tertiary" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-dark-tertiary rounded w-3/4" />
            <div className="h-3 bg-dark-elevated rounded w-full" />
          </div>
          <div className="flex-shrink-0 w-5 h-5 bg-dark-tertiary rounded" />
        </div>
      ))}
    </div>
  );
}

export function TopicSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border-primary bg-dark-secondary">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cat-futebol/20" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-dark-tertiary rounded w-2/3" />
            <div className="h-2 bg-dark-elevated rounded w-full" />
          </div>
          <div className="flex-shrink-0 w-4 h-4 bg-dark-tertiary rounded" />
        </div>
      ))}
    </div>
  );
}
