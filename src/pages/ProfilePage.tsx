import { User, LogOut, ShieldCheck, Calendar, CheckCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { parseJWT } from '../lib/wixAuthService';

export function ProfilePage() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err: any) {
      console.error('Failed to sign out:', err);
    }
  };

  const tokenPayload = user?.token ? parseJWT(user.token) : null;
  const expirationDate = tokenPayload?.exp ? new Date(tokenPayload.exp * 1000) : null;
  const daysUntilExpiration = expirationDate ? Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'trial': return 'text-blue-600 bg-blue-50';
      case 'expired': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'trial': return 'Teste';
      case 'expired': return 'Expirada';
      default: return 'Desconhecida';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Perfil</h2>
        <p className="text-gray-600">Gerencie sua conta</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Informações da Conta</h3>
              <p className="text-gray-600 text-sm mb-4">{user?.email}</p>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Assinatura Wix</h3>
              <p className="text-gray-600 text-sm">Status da sua assinatura e detalhes</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Status</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(user?.subscriptionStatus || 'active')}`}>
                {getStatusText(user?.subscriptionStatus || 'active')}
              </span>
            </div>

            {expirationDate && (
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Validade</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {expirationDate.toLocaleDateString('pt-BR')}
                  </p>
                  {daysUntilExpiration !== null && (
                    <p className="text-xs text-gray-500">
                      {daysUntilExpiration > 0 ? `${daysUntilExpiration} dias restantes` : 'Expirando em breve'}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4">
              {user?.subscriptionStatus === 'expired' ? (
                <a
                  href="https://your-wix-site.com/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Renovar Assinatura
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <a
                  href="https://your-wix-site.com/account"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Gerenciar Assinatura na Wix
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sobre</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>QUENTY Agente oferece acesso conversacional aos seus resumos de notícias, assuntos quentes e tópicos.</p>
            <p>Faça perguntas sobre assuntos quentes, explore tópicos e obtenha insights personalizados de notícias por meio de conversa natural.</p>
            <p className="pt-2">
              <span className="font-medium text-gray-900">Versão:</span> 1.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
