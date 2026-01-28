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
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  connectionError?: string | null;
  onReconnect?: () => void;
  onSendMessage: (message: string) => void;
  messages: ChatMessage[];
}

export function FloatingChat({
  context,
  isProcessing,
  connectionState,
  connectionError,
  onReconnect,
  onSendMessage,
  messages,
}: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isConnected = connectionState === 'connected';
  const isInputDisabled = isProcessing || !isConnected;

  const getConnectionStatusMessage = () => {
    switch (connectionState) {
      case 'connecting':
        return 'Reconectando ao assistente...';
      case 'disconnected':
        return 'Conexão com o assistente perdida.';
      case 'error':
        return connectionError || 'Não foi possível se conectar ao assistente.';
      default:
        return null;
    }
  };

  const connectionStatusMessage = getConnectionStatusMessage();
  const showReconnectButton = Boolean(
    onReconnect && (connectionState === 'error' || connectionState === 'disconnected'),
  );

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
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-br from-accent to-accent-hover text-dark-primary p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center gap-2 glow-accent"
          aria-label="Ask Quenty"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="text-sm font-medium pr-1">Ask Quenty</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 animate-slideUp">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          <div className="relative bg-dark-secondary rounded-t-3xl shadow-2xl max-h-[60vh] flex flex-col mx-auto max-w-4xl border-t border-border-primary">
            <div className="bg-gradient-to-r from-accent to-accent-hover text-dark-primary px-6 py-4 rounded-t-3xl flex items-center justify-between">
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
                className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-full hover:bg-dark-primary/20 active:bg-dark-primary/30 transition-colors text-dark-primary"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[200px] max-h-[calc(60vh-160px)]">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageCircle className="w-12 h-12 text-accent mb-3 opacity-50" />
                  <p className="text-text-secondary text-sm mb-4">
                    Ask me anything about this topic!
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {['Explain like I\'m 12', 'Show opposing view', 'Summarize comments'].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleSend(suggestion)}
                        disabled={isInputDisabled}
                        className="px-3 py-1.5 text-xs bg-accent-muted text-accent rounded-full hover:bg-accent/20 transition-colors disabled:opacity-50"
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
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border-primary bg-dark-tertiary rounded-b-3xl">
              {connectionStatusMessage && (
                <div className="mb-2 flex flex-col gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-500">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{connectionStatusMessage}</span>
                    {!isConnected && !showReconnectButton && (
                      <span className="text-yellow-400">Tente novamente em instantes.</span>
                    )}
                  </div>
                  {showReconnectButton && (
                    <button
                      type="button"
                      onClick={onReconnect}
                      className="self-start rounded-lg border border-yellow-500/30 bg-dark-secondary px-3 py-1 text-[11px] font-semibold text-yellow-400 transition-colors hover:bg-yellow-500/10"
                    >
                      Tentar reconectar agora
                    </button>
                  )}
                </div>
              )}
              {isProcessing && <TypingIndicator />}
              <MessageInput
                onSend={handleSend}
                disabled={isInputDisabled}
                placeholder={
                  isProcessing
                    ? 'Quenty is thinking...'
                    : isConnected
                      ? 'Type a message...'
                      : 'Conectando ao assistente...'
                }
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
