import { Fragment } from 'react';
import { AlertCircle } from 'lucide-react';
import { ChatMessage } from '../lib/chatService';

type MessageBubbleProps = {
  message: ChatMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.status === 'error';
  const baseStatusClass = isUser ? 'text-dark-primary/70' : 'text-text-muted';
  const errorStatusClass = isUser ? 'text-dark-primary' : 'text-red-400';
  const errorIconClass = isUser ? 'text-dark-primary' : 'text-red-400';

  const normalizeContent = (content: string) =>
    content
      .replace(/\r\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\/n(?=[\s-])/g, '\n');

  const renderContent = (content: string) => {
    if (!content) return null;

    const normalized = normalizeContent(content);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const isUrl = (segment: string) => /^https?:\/\/[^\s]+$/i.test(segment);
    const linkClass = isUser
      ? 'font-medium underline text-dark-primary/90 hover:text-dark-primary break-words'
      : 'font-medium text-accent underline hover:text-accent-hover break-words';

    return normalized.split('\n').map((line, lineIndex) => {
      const segments = line.split(urlRegex);

      return (
        <Fragment key={`line-${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {segments.map((segment, segmentIndex) => {
            if (!segment) {
              return null;
            }

            if (isUrl(segment)) {
              return (
                <a
                  key={`segment-${lineIndex}-${segmentIndex}`}
                  href={segment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  {segment}
                </a>
              );
            }

            return (
              <span key={`segment-${lineIndex}-${segmentIndex}`} className="break-words">
                {segment}
              </span>
            );
          })}
        </Fragment>
      );
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fadeIn`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? isError
              ? 'bg-red-500 text-white'
              : 'bg-accent text-dark-primary'
            : 'bg-dark-secondary text-text-primary border border-border-primary'
        }`}
      >
        <div className="break-words text-[15px] leading-relaxed">{renderContent(message.content)}</div>
        <div className={`text-xs mt-1.5 flex items-center gap-2 ${baseStatusClass}`}>
          <span>
            {formatTime(message.timestamp)}
            {message.status === 'sending' && ' • Enviando...'}
          </span>
          {message.status === 'error' && (
            <span
              className={`inline-flex items-center gap-1 ${errorStatusClass}`}
              title="Não foi possível enviar esta mensagem."
            >
              <AlertCircle className={`w-3 h-3 ${errorIconClass}`} aria-hidden />
              <span>Falhou</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
