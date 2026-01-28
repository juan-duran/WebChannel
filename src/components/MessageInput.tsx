import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

type MessageInputProps = {
  onSend: (message: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  onFocus?: () => void;
};

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  onFocus,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled) return;

    onSend(trimmedMessage);
    setMessage('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleFocus = () => {
    if (textareaRef.current) {
      textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    onFocus?.();
  };

  return (
    <div className="border-t border-border-primary bg-dark-secondary px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full resize-none rounded-2xl border border-border-primary bg-dark-tertiary px-4 py-3 pr-12 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:bg-dark-primary disabled:text-text-muted text-[15px] leading-relaxed max-h-[120px] overflow-y-auto scrollbar-none"
              style={{ minHeight: '48px' }}
            />
            <div className="absolute bottom-3 right-3 text-xs text-text-muted">
              {message.length > 0 && `${message.length}`}
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
              disabled || !message.trim()
                ? 'bg-dark-tertiary text-text-muted cursor-not-allowed'
                : 'bg-accent text-dark-primary hover:bg-accent-hover active:scale-95 shadow-md hover:shadow-lg glow-accent'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
