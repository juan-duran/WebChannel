import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, BellOff, CheckCircle, Loader2 } from 'lucide-react';
import { requestNotificationPermission, subscribeToPush } from '../lib/notifications';

export function NotificationsPage() {
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setNotificationEnabled(!!data);
    } catch (err) {
      console.error('Failed to check subscription:', err);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      setLoading(true);
      setMessage('');

      const granted = await requestNotificationPermission();
      if (!granted) {
        setMessage('Please allow notifications in your browser settings');
        return;
      }

      setPermission('granted');
      const subscription = await subscribeToPush();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        subscription_data: subscription,
      });

      setNotificationEnabled(true);
      setMessage('Notifications enabled successfully!');
    } catch (err: any) {
      setMessage(err.message || 'Failed to enable notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    try {
      setLoading(true);
      setMessage('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);

      setNotificationEnabled(false);
      setMessage('Notifications disabled');
    } catch (err: any) {
      setMessage(err.message || 'Failed to disable notifications');
    } finally {
      setLoading(false);
    }
  };

  const isSupported = 'Notification' in window && 'serviceWorker' in navigator;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Notifications</h2>
        <p className="text-gray-600">Manage your push notification preferences</p>
      </div>

      {!isSupported && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 mb-6">
          Push notifications are not supported in your browser
        </div>
      )}

      {message && (
        <div className={`p-4 rounded-lg mb-6 ${
          message.includes('success') || message.includes('enabled')
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
        }`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {notificationEnabled ? (
                  <Bell className="w-6 h-6 text-blue-600" />
                ) : (
                  <BellOff className="w-6 h-6 text-gray-400" />
                )}
                <h3 className="text-lg font-semibold text-gray-900">Push Notifications</h3>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                Get notified about daily trends and topics you care about
              </p>
              {notificationEnabled && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Notifications are enabled</span>
                </div>
              )}
            </div>

            {isSupported && (
              <button
                onClick={notificationEnabled ? handleDisableNotifications : handleEnableNotifications}
                disabled={loading}
                className={`px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                  notificationEnabled
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {notificationEnabled ? 'Disable' : 'Enable'}
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">How it works</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-bold flex-shrink-0 mt-0.5">
                1
              </span>
              <p className="text-gray-700">Enable notifications to receive daily digests</p>
            </li>
            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-bold flex-shrink-0 mt-0.5">
                2
              </span>
              <p className="text-gray-700">Get notified when new trends are available</p>
            </li>
            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-bold flex-shrink-0 mt-0.5">
                3
              </span>
              <p className="text-gray-700">Stay updated on topics you've subscribed to</p>
            </li>
          </ul>
        </div>

        {permission === 'denied' && (
          <div className="p-6 bg-red-50">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Notifications Blocked</h3>
            <p className="text-red-700 text-sm">
              You have blocked notifications for this site. To enable them, please update your browser settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
