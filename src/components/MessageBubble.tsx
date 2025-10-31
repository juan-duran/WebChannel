import { ChatMessage } from '../lib/chatService';

type MessageBubbleProps = {
  message: ChatMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.status === 'error';

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
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
              : 'bg-blue-600 text-white'
            : 'bg-white text-gray-900 border border-gray-200'
        }`}
      >
        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
          {message.content}
        </div>
        <div
          className={`text-xs mt-1.5 ${
            isUser ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {formatTime(message.timestamp)}
          {message.status === 'sending' && ' • Sending...'}
          {message.status === 'error' && ' • Failed'}
        </div>
      </div>
    </div>
  );
}
