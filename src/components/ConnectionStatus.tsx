import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

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
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border-b border-yellow-200">
        <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />
        <span className="text-sm text-yellow-900">Connecting...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-red-50 border-b border-red-200">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-red-600" />
        <span className="text-sm text-red-900">
          {status === 'error' ? 'Connection error' : 'Disconnected'}
        </span>
      </div>
      {onReconnect && (
        <button
          onClick={onReconnect}
          className="text-sm text-red-700 hover:text-red-900 font-medium"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}
