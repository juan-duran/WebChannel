import { WifiOff, RefreshCw } from 'lucide-react';

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
      <div className="bg-yellow-500/10 border-b border-yellow-500/20">
        <div className="max-w-screen-md w-full mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
          <span className="text-sm text-yellow-500">Connecting...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-500/10 border-b border-red-500/20">
      <div className="max-w-screen-md w-full mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">
            {status === 'error' ? 'Connection error' : 'Disconnected'}
          </span>
        </div>
        {onReconnect && (
          <button
            onClick={onReconnect}
            className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
          >
            Reconnect
          </button>
        )}
      </div>
    </div>
  );
}
