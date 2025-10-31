import { User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function ProfilePage() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err: any) {
      console.error('Failed to sign out:', err);
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
