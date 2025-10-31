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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile</h2>
        <p className="text-gray-600">Manage your account</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Account Information</h3>
              <p className="text-gray-600 text-sm mb-4">{user?.email}</p>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">About</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>AI Assistant Chat provides conversational access to your news digest, trends, and topics.</p>
            <p>Ask questions about trends, explore topics, and get personalized news insights through natural conversation.</p>
            <p className="pt-2">
              <span className="font-medium text-gray-900">Version:</span> 1.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
