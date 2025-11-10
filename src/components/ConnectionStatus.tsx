import { RefreshCw, WifiOff } from 'lucide-react';

interface ConnectionStatusProps {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  onReconnect?: () => void;
}

export function ConnectionStatus({ status, onReconnect }: ConnectionStatusProps) {
  if (status === 'connected') {
    return null;
  }

  if (status === 'connecting') {
    return (
      <>
        <div className="fixed top-0 left-0 w-full z-50 flex items-center justify-center bg-yellow-100 text-yellow-800 text-center py-1 text-sm shadow-sm animate-pulse">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Connecting...
        </div>
        <div className="h-8" aria-hidden="true" />
      </>
    );
  }

  return (
    <>
      <div className="fixed top-0 left-0 w-full z-50 flex items-center justify-center bg-red-100 text-red-800 text-center py-1 text-sm shadow-sm animate-fadeIn">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>{status === 'error' ? 'Connection error' : 'Disconnected'}</span>
        </div>
        {onReconnect && (
          <button
            onClick={onReconnect}
            className="ml-4 text-sm font-medium underline hover:text-red-900 transition-colors"
          >
            Reconnect
          </button>
        )}
      </div>
      <div className="h-8" aria-hidden="true" />
    </>
  );
}
