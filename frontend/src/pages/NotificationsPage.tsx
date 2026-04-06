import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import type { Notification } from '../types';

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications/')).data,
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => api.put(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="space-y-4">
      <button 
        onClick={() => window.history.back()} 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-brand-500 transition-colors mb-2 w-fit"
      >
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 rotate-45"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Back
      </button>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h2>

      {isLoading ? (
        <div className="text-gray-400 text-center py-12">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No notifications.</div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border transition ${
                n.is_read
                  ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">{n.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(n.sent_at).toLocaleString()} &middot; {n.notification_type}
                    {n.recipient_email && ` &middot; ${n.recipient_email}`}
                  </p>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => markRead.mutate(n.id)}
                    className="text-xs text-brand-600 hover:underline whitespace-nowrap"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
