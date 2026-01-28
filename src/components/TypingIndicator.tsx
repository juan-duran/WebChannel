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
    if (elapsed < 30) return 'Processando sua solicitação...';
    if (elapsed < 60) return 'Ainda trabalhando nisso...';
    return 'Quase lá...';
  };

  return (
    <div className="text-sm italic text-accent animate-pulse transition-opacity duration-300">
      {getEstimatedTime()}
    </div>
  );
}
