import { User as UserIcon, LogOut, Mail, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentUser } from '../state/UserContext';

export function ProfilePage() {
  const { user: authUser, signOut } = useAuth();
  const user = useCurrentUser();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err: unknown) {
      console.error('Failed to sign out:', err);
    }
  };

  const createdDate = authUser?.created_at ? new Date(authUser.created_at) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile</h2>
        <p className="text-gray-600">Manage your account settings</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
              <UserIcon className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Account Information</h3>
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-600 text-sm">{user.email}</p>
                </div>
                {createdDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <p className="text-gray-600 text-sm">
                      Joined {createdDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">About WebChannel</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>WebChannel provides an intelligent chat interface for seamless conversations with AI assistants.</p>
            <p>Send messages, receive responses, and maintain your conversation history across sessions.</p>
            <p className="pt-2">
              <span className="font-medium text-gray-900">Version:</span> 1.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
