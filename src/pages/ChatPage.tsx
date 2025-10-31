import { useState, useRef, useEffect } from 'react';
import { MessageCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import { TypingIndicator } from '../components/TypingIndicator';
import { QuickActions } from '../components/QuickActions';
import { ChatMessage, sendMessageToAgent, generateMessageId } from '../lib/chatService';

export function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStartTime, setProcessingStartTime] = useState<Date | undefined>();
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const handleSendMessage = async (content: string) => {
    if (!user?.email || isProcessing) return;

    setError(null);

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'sending'
    };

    setMessages(prev => [...prev, userMessage]);

    setMessages(prev =>
      prev.map(msg => (msg.id === userMessage.id ? { ...msg, status: 'sent' as const } : msg))
    );

    setIsProcessing(true);
    setProcessingStartTime(new Date());

    try {
      const response = await sendMessageToAgent({
        message: content,
        userEmail: user.email
      });

      setIsProcessing(false);
      setProcessingStartTime(undefined);

      if (response.success && response.data) {
        let aiContent = '';

        if (typeof response.data === 'string') {
          aiContent = response.data;
        } else if (response.data.message) {
          aiContent = response.data.message;
        } else if (response.data.response) {
          aiContent = response.data.response;
        } else if (response.data.content) {
          aiContent = response.data.content;
        } else {
          aiContent = JSON.stringify(response.data, null, 2);
        }

        const aiMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: aiContent,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);
      } else {
        setError(response.error || 'Falha ao obter resposta do agente IA');
        setMessages(prev =>
          prev.map(msg =>
            msg.id === userMessage.id ? { ...msg, status: 'error' as const } : msg
          )
        );
      }
    } catch (err) {
      setIsProcessing(false);
      setProcessingStartTime(undefined);
      setError('Ocorreu um erro inesperado. Por favor, tente novamente.');
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id ? { ...msg, status: 'error' as const } : msg
        )
      );
    }
  };

  const handleRetry = () => {
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    if (lastUserMessage) {
      setMessages(prev => prev.filter(msg => msg.id !== lastUserMessage.id));
      handleSendMessage(lastUserMessage.content);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
    setIsProcessing(false);
    setProcessingStartTime(undefined);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-blue-50 to-white">
      <div className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">QUENTY Agente</h1>
              <p className="text-xs text-gray-500">
                {isProcessing ? 'Processando...' : 'Pronto para ajudar'}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              disabled={isProcessing}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && !isProcessing && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
                <MessageCircle className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Bem-vindo ao QUENTY Agente
              </h2>
              <p className="text-gray-600 mb-8 max-w-md">
                Pergunte-me qualquer coisa sobre notícias, assuntos quentes e tópicos. Estou aqui para ajudar!
              </p>
              <QuickActions onSelect={handleSendMessage} disabled={isProcessing} />
            </div>
          )}

          {messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {isProcessing && <TypingIndicator startTime={processingStartTime} />}

          {error && (
            <div className="flex justify-center mb-4 animate-fadeIn">
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 shadow-sm max-w-[85%] sm:max-w-[75%]">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-900 font-medium mb-1">Erro</p>
                    <p className="text-sm text-red-700">{error}</p>
                    <button
                      onClick={handleRetry}
                      disabled={isProcessing}
                      className="mt-3 flex items-center gap-2 text-sm text-red-700 hover:text-red-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Tentar Novamente
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <MessageInput
        onSend={handleSendMessage}
        disabled={isProcessing}
        placeholder={isProcessing ? 'Aguarde...' : 'Digite uma mensagem...'}
      />
    </div>
  );
}
