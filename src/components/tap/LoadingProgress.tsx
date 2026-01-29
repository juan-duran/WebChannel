import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProgressProps {
  message?: string;
}

const LOADING_MESSAGES = [
  'ANALISANDO CONVERSAS...',
  'BUSCANDO DEBATES RECENTES...',
  'REFINANDO SEU BRIEFING...',
  'COLETANDO INSIGHTS...',
  'SINTETIZANDO TÓPICOS...',
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
    <div className="flex flex-col items-center justify-center py-12 px-4 bg-white border-[3px] border-black shadow-brutal">
      <div className="relative w-16 h-16 bg-brutal-yellow border-2 border-black flex items-center justify-center shadow-[4px_4px_0_0_#000000]">
        <Loader2 className="w-8 h-8 text-black animate-spin" />
      </div>
      <p className="mt-6 text-sm font-mono font-bold text-black text-center max-w-md uppercase tracking-wide animate-fadeIn">
        {currentMessage}
      </p>
      <div className="mt-4 flex gap-2">
        <div className="w-3 h-3 bg-black border border-black animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-3 h-3 bg-brutal-yellow border border-black animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-3 h-3 bg-brutal-cyan border border-black animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

export function TrendSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-white border-[3px] border-black p-4 shadow-brutal animate-shimmer-brutal"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-start gap-4">
            {/* Position badge skeleton */}
            <div className="flex-shrink-0 w-12 h-12 bg-gray-200 border-2 border-black" />
            <div className="flex-1 space-y-3">
              {/* Category skeleton */}
              <div className="h-6 bg-gray-200 border-2 border-black w-24" />
              {/* Title skeleton */}
              <div className="h-5 bg-gray-300 border border-black w-full" />
              <div className="h-5 bg-gray-200 border border-black w-3/4" />
              {/* Engagement badges skeleton */}
              <div className="flex gap-2 pt-2">
                <div className="h-8 bg-gray-200 border-2 border-black w-20" />
                <div className="h-8 bg-gray-200 border-2 border-black w-16" />
              </div>
            </div>
            {/* Chevron skeleton */}
            <div className="flex-shrink-0 w-10 h-10 bg-gray-300 border-2 border-black" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TopicSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0_0_#000000] animate-shimmer-brutal"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-6 bg-gray-200 border-2 border-black w-28" />
            <div className="w-5 h-5 bg-gray-300 border border-black" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 border border-black w-full" />
            <div className="h-4 bg-gray-200 border border-black w-4/5" />
          </div>
          <div className="flex gap-2 mt-3">
            <div className="h-7 bg-gray-200 border-2 border-black w-16" />
            <div className="h-7 bg-gray-200 border-2 border-black w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
