import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlusIcon,
  UsersIcon,
  KeyIcon,
  TrashIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../api';

interface SystemUser {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

interface EmployeeMasterRecord {
  emp_id: string;
  user_name: string;
  department?: string;
  email?: string;
  number?: string;
  name_with_department?: string;
}

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [resetModal, setResetModal] = useState<SystemUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Form state
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Employee',
    phone: '',
  });

  const { data: users = [], isLoading } = useQuery<SystemUser[]>({
    queryKey: ['system-users'],
    queryFn: async () => (await api.get('/users')).data,
  });

  const { data: employees = [] } = useQuery<EmployeeMasterRecord[]>({
    queryKey: ['employee-master'],
    queryFn: async () => (await api.get('/employees/master')).data,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/auth/register', data),
    onSuccess: () => {
      toast.success('User created successfully!');
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'Employee', phone: '' });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to create user'),
  });

  const resetMutation = useMutation({
    mutationFn: (data: { user_id: number; new_password: string }) =>
      api.post('/auth/reset-password', data),
    onSuccess: () => {
      toast.success('Password reset successfully!');
      setResetModal(null);
      setNewPassword('');
    },
    onError: () => toast.error('Failed to reset password'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
    },
    onError: () => toast.error('Failed to delete user'),
  });

  const selectEmployee = (emp: EmployeeMasterRecord) => {
    setForm((prev) => ({
      ...prev,
      name: emp.user_name,
      email: emp.email || '',
      phone: emp.number || '',
    }));
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      Admin: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400',
      CEO: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400',
      Manager: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400',
      HR: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400',
      Employee: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400',
    };
    return styles[role] || styles.Employee;
  };

  return (
    <div className="space-y-6 max-w-[1100px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheckIcon className="w-7 h-7 text-brand-600" />
            User Management
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create and manage system login accounts
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-sm transition shadow-sm"
        >
          <UserPlusIcon className="w-5 h-5" />
          Create User
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white dark:bg-[#161b27] p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">New User Account</h3>

          {/* Employee Master Dropdown */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select from Employee Master (optional)
            </label>
            <select
              onChange={(e) => {
                const emp = employees.find((x) => x.emp_id === e.target.value);
                if (emp) selectEmployee(emp);
              }}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
            >
              <option value="">-- Select Employee --</option>
              {employees.map((emp) => (
                <option key={emp.emp_id} value={emp.emp_id}>
                  {emp.name_with_department || emp.user_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
                placeholder="email@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password *</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
                placeholder="Initial password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
              >
                <option value="Employee">Employee</option>
                <option value="HR">HR</option>
                <option value="Manager">Manager</option>
                <option value="CEO">CEO</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || !form.email || !form.password || createMutation.isPending}
              className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </div>
      )}

      {/* Users List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white dark:bg-[#161b27] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-slate-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">{users.length} Users</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-500/10 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-sm shrink-0">
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{u.name}</p>
                    <p className="text-[12px] text-slate-400 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-3 py-1 text-[11px] font-bold rounded-full border ${getRoleBadge(u.role)}`}>
                    {u.role}
                  </span>
                  <button
                    onClick={() => { setResetModal(u); setNewPassword(''); }}
                    className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 text-slate-400 hover:text-amber-600 transition"
                    title="Reset Password"
                  >
                    <KeyIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete user ${u.name}?`)) deleteMutation.mutate(u.id);
                    }}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600 transition"
                    title="Delete User"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reset Password</h3>
            <p className="text-sm text-slate-500">For: <strong>{resetModal.name}</strong> ({resetModal.email})</p>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
              placeholder="New password"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setResetModal(null)}
                className="flex-1 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => resetMutation.mutate({ user_id: resetModal.id, new_password: newPassword })}
                disabled={!newPassword || resetMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition disabled:opacity-50"
              >
                {resetMutation.isPending ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
