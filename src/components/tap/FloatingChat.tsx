import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { MessageInput } from '../MessageInput';
import { MessageBubble } from '../MessageBubble';
import { TypingIndicator } from '../TypingIndicator';
import { ChatMessage } from '../../lib/chatService';

interface FloatingChatProps {
  context?: {
    trendName?: string;
    topicName?: string;
  };
  isProcessing: boolean;
  onSendMessage: (message: string) => void;
  messages: ChatMessage[];
}

export function FloatingChat({
  context,
  isProcessing,
  onSendMessage,
  messages,
}: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSend = (message: string) => {
    let contextualMessage = message;
    if (context?.topicName) {
      contextualMessage = `[Context: ${context.trendName} > ${context.topicName}] ${message}`;
    } else if (context?.trendName) {
      contextualMessage = `[Context: ${context.trendName}] ${message}`;
    }
    onSendMessage(contextualMessage);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-br from-blue-600 to-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center gap-2"
          aria-label="Ask Quenty"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="text-sm font-medium pr-1">Ask Quenty</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 animate-slideUp">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[60vh] flex flex-col mx-auto max-w-4xl">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-3xl flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Ask Quenty</h3>
                {context && (
                  <p className="text-xs opacity-90 mt-0.5">
                    {context.topicName
                      ? `${context.trendName} > ${context.topicName}`
                      : context.trendName}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors text-white hover:text-gray-900 active:text-gray-900"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[200px] max-h-[calc(60vh-160px)]">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageCircle className="w-12 h-12 text-blue-600 mb-3 opacity-50" />
                  <p className="text-gray-600 text-sm mb-4">
                    Ask me anything about this topic!
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {['Explain like I\'m 12', 'Show opposing view', 'Summarize comments'].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleSend(suggestion)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {isProcessing && <TypingIndicator />}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <MessageInput
                onSend={handleSend}
                disabled={isProcessing}
                placeholder={isProcessing ? 'Quenty is thinking...' : 'Type a message...'}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
