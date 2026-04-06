import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';

interface AbsenteeRecord {
  user_name: string;
  email: string | null;
  absent_count: number;
}

export default function AttendancePage() {
  const [searchName, setSearchName] = useState('');
  const [userStats, setUserStats] = useState<{ user_name: string; present: number; absent: number } | null>(null);

  const { data: absentees = [], isLoading } = useQuery<AbsenteeRecord[]>({
    queryKey: ['absentees'],
    queryFn: async () => (await api.get('/attendance/absentees')).data,
  });

  const handleSearch = async () => {
    if (!searchName.trim()) return;
    try {
      const { data } = await api.get(`/attendance/user/${encodeURIComponent(searchName.trim())}`);
      setUserStats(data);
    } catch {
      setUserStats(null);
    }
  };

  return (
    <div className="space-y-6">
      <button 
        onClick={() => window.history.back()} 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-brand-500 transition-colors mb-2 w-fit"
      >
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 rotate-45"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Back
      </button>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Attendance Tracking</h2>

      {/* User search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Look Up Attendance</h3>
        <div className="flex gap-3">
          <input
            placeholder="Enter user name"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 transition"
          >
            Search
          </button>
        </div>
        {userStats && (
          <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{userStats.user_name}</p>
              <p className="text-xs text-gray-500">Name</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{userStats.present}</p>
              <p className="text-xs text-gray-500">Present</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{userStats.absent}</p>
              <p className="text-xs text-gray-500">Absent</p>
            </div>
          </div>
        )}
      </div>

      {/* Frequent absentees */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Frequent Absentees (3+ absences)
        </h3>
        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : absentees.length === 0 ? (
          <p className="text-gray-400 text-sm">No frequent absentees found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-2 pr-6">Name</th>
                  <th className="py-2 pr-6">Email</th>
                  <th className="py-2">Absent Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {absentees.map((a, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-6 font-medium text-gray-900 dark:text-white">{a.user_name}</td>
                    <td className="py-2 pr-6 text-gray-500">{a.email || '—'}</td>
                    <td className="py-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-medium">
                        {a.absent_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
