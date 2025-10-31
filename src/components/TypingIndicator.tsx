import { useEffect, useState } from 'react';

type TypingIndicatorProps = {
  startTime?: Date;
};

export function TypingIndicator({ startTime }: TypingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
      setElapsed(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const getEstimatedTime = () => {
    if (elapsed < 30) return 'Processing your request...';
    if (elapsed < 60) return 'Still working on it...';
    return 'Almost there...';
  };

  const progress = Math.min((elapsed / 90) * 100, 100);

  return (
    <div className="flex justify-start mb-4 animate-fadeIn">
      <div className="max-w-[85%] sm:max-w-[75%]">
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span className="text-sm text-gray-600">{getEstimatedTime()}</span>
          </div>
          {elapsed > 0 && (
            <div className="relative w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}
        </div>
        {elapsed > 0 && (
          <div className="text-xs text-gray-500 mt-1.5 ml-2">
            {elapsed}s elapsed
          </div>
        )}
      </div>
    </div>
  );
}
