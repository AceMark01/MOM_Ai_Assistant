import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  PlusCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuthStore } from '../store';
import type { EmployeeMasterRecord } from '../types';

interface FMSTask {
  sr_no: string;
  name: string;
  job: string;
  date: string;
  status: string;
  status1: string;
  actual: string;
  actual1: string;
  high: string;
  reason: string;
  gmail: string;
  timestamp: string;
  time_delay: string;
  planned: string;
}

const ADMIN_ROLES = ['Admin', 'CEO', 'Manager', 'HR'];

export default function MyTasksPage() {
  const { user } = useAuthStore();
  const isAdmin = user && ADMIN_ROLES.includes(user.role);
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Awaiting Review' | 'Completed'>('All');
  const [search, setSearch] = useState('');
  const [completeModal, setCompleteModal] = useState<FMSTask | null>(null);
  const [reason, setReason] = useState('');

  // Assign Task Modal state (Admin only)
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [employees, setEmployees] = useState<EmployeeMasterRecord[]>([]);
  const [assignMode, setAssignMode] = useState<'list' | 'manual'>('list');
  const [assignForm, setAssignForm] = useState({ employeeId: '', manualName: '', manualEmail: '', manualPhone: '', jobDescription: '', deadline: '' });

  // Fetch employee master list for assignment dropdown
  useEffect(() => {
    if (isAdmin) {
      api.get('/employees/master').then(({ data }) => {
        setEmployees(Array.isArray(data) ? data : []);
      }).catch(() => {});
    }
  }, [isAdmin]);

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery<FMSTask[]>({
    queryKey: ['fms-tasks'],
    queryFn: async () => {
      const endpoint = isAdmin ? '/fms/tasks' : '/fms/tasks/my';
      return (await api.get(endpoint)).data;
    },
  });

  // Mark complete mutation
  const completeMutation = useMutation({
    mutationFn: (data: { task_sr_no: string; reason: string }) =>
      api.post('/fms/tasks/complete', data),
    onSuccess: () => {
      toast.success('Task marked as Done!');
      queryClient.invalidateQueries({ queryKey: ['fms-tasks'] });
      setCompleteModal(null);
      setReason('');
    },
    onError: () => toast.error('Failed to complete task'),
  });

  // Mark seen mutation (admin only)
  const seenMutation = useMutation({
    mutationFn: (task_sr_no: string) =>
      api.post('/fms/tasks/seen', { task_sr_no }),
    onSuccess: () => {
      toast.success('Task acknowledged!');
      queryClient.invalidateQueries({ queryKey: ['fms-tasks'] });
    },
    onError: () => toast.error('Failed to mark as seen'),
  });

  // Assign task mutation (admin only)
  const assignMutation = useMutation({
    mutationFn: (data: { person_name: string; job_description: string; deadline_date: string; person_email: string; source: string }) =>
      api.post('/fms/tasks/assign', data),
    onSuccess: () => {
      toast.success('Task assigned successfully!');
      queryClient.invalidateQueries({ queryKey: ['fms-tasks'] });
      setShowAssignModal(false);
      setAssignMode('list');
      setAssignForm({ employeeId: '', manualName: '', manualEmail: '', manualPhone: '', jobDescription: '', deadline: '' });
    },
    onError: () => toast.error('Failed to assign task'),
  });

  const handleAssignSubmit = () => {
    let personName = '';
    let personEmail = '';
    
    if (assignMode === 'list') {
      const selectedEmp = employees.find(e => e.emp_id === assignForm.employeeId);
      if (!selectedEmp) { toast.error('Please select an employee'); return; }
      personName = selectedEmp.user_name;
      personEmail = selectedEmp.email || '';
    } else {
      if (!assignForm.manualName.trim()) { toast.error('Please enter employee name'); return; }
      personName = assignForm.manualName.trim();
      personEmail = assignForm.manualEmail.trim();
    }
    
    if (!assignForm.jobDescription.trim()) { toast.error('Please enter task description'); return; }
    if (!assignForm.deadline) { toast.error('Please select a deadline'); return; }
    assignMutation.mutate({
      person_name: personName,
      job_description: assignForm.jobDescription,
      deadline_date: assignForm.deadline,
      person_email: personEmail,
      source: 'Manual',
    });
  };

  // Trust the status determined by the Backend's smart logic
  const getEffectiveStatus = (t: FMSTask) => {
    return t.status || 'Pending';
  };

  const filteredTasks = tasks.filter((t) => {
    const effective = getEffectiveStatus(t);
    const matchesStatus = statusFilter === 'All' || effective === statusFilter;
    const matchesSearch =
      (t.job || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.sr_no || '').toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => getEffectiveStatus(t) === 'Pending').length,
    awaitingReview: tasks.filter((t) => getEffectiveStatus(t) === 'Awaiting Review').length,
    completed: tasks.filter((t) => getEffectiveStatus(t) === 'Completed').length,
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20';
      case 'Awaiting Review': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
      case 'Pending': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
      default: return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardDocumentListIcon className="w-7 h-7 text-brand-600" />
              {isAdmin ? 'FMS Task Dashboard' : 'My Tasks'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isAdmin ? 'All delegated tasks across the organization' : `Tasks assigned to ${user?.name || 'you'}`}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold transition shadow-lg shadow-brand-600/20 hover:shadow-brand-600/40"
            >
              <PlusCircleIcon className="w-5 h-5" />
              Assign Task
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'brand', icon: ClipboardDocumentListIcon },
          { label: 'Pending', value: stats.pending, color: 'red', icon: ExclamationTriangleIcon },
          { label: 'Awaiting Review', value: stats.awaitingReview, color: 'amber', icon: ClockIcon },
          { label: 'Completed', value: stats.completed, color: 'green', icon: CheckCircleIcon },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-[#161b27] p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-${s.color}-50 dark:bg-${s.color}-500/10 flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 text-${s.color}-600 dark:text-${s.color}-400`} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{s.value}</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#161b27] p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 text-slate-400 pr-2 border-r border-slate-100 dark:border-slate-800">
          <FunnelIcon className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Filter</span>
        </div>
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
          {(['All', 'Pending', 'Awaiting Review', 'Completed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 text-[12px] font-bold rounded-md transition-all ${
                statusFilter === s
                  ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto w-full md:w-64 pl-4 pr-4 py-2 text-sm bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-white"
        />
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center py-20 bg-white dark:bg-[#161b27] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
          <ClipboardDocumentListIcon className="w-16 h-16 text-slate-200 dark:text-slate-800 mb-2" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Tasks Found</h3>
          <p className="text-slate-400 text-sm">No tasks matching your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredTasks.map((t) => {
            const effective = getEffectiveStatus(t);
            return (
              <div
                key={t.sr_no}
                className="group bg-white dark:bg-[#161b27] p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-brand-500/30 transition-all duration-300 relative overflow-hidden"
              >
                {/* Left accent */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  effective === 'Completed' ? 'bg-green-500' : effective === 'Awaiting Review' ? 'bg-amber-500' : 'bg-red-500'
                }`} />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-3">
                  <div className="space-y-2 min-w-0 flex-1">
                    {/* Sr No & Person */}
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-500/10 dark:text-brand-400 dark:border-brand-500/20">
                        {t.sr_no}
                      </span>
                      {isAdmin && (
                        <span className="text-[12px] font-bold text-slate-400">
                          → {t.name}
                        </span>
                      )}
                      {t.high && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400">
                          HIGH
                        </span>
                      )}
                    </div>

                    {/* Task Title */}
                    <h4 className="text-[15px] font-bold text-slate-900 dark:text-white leading-snug">
                      {t.job}
                    </h4>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-slate-400">
                      {t.date && (
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5" /> Deadline: {t.date}
                        </span>
                      )}
                      {t.actual && (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircleIcon className="w-3.5 h-3.5" /> Done: {t.actual}
                        </span>
                      )}
                      {t.time_delay && !t.time_delay.includes('#') && (
                        <span>Delay: {t.time_delay}</span>
                      )}
                    </div>

                    {t.reason && (
                      <p className="text-[12px] text-slate-400 italic">Note: {t.reason}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-4 py-1.5 rounded-xl text-[11px] font-extrabold border ${getStatusStyle(effective)}`}>
                      {effective.toUpperCase()}
                    </span>

                    {/* User: Mark complete button */}
                    {effective === 'Pending' && !isAdmin && (
                      <button
                        onClick={() => setCompleteModal(t)}
                        className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-[12px] font-bold transition shadow-sm"
                      >
                        Mark Done
                      </button>
                    )}

                    {/* Admin: Mark seen button */}
                    {effective === 'Awaiting Review' && isAdmin && (
                      <button
                        onClick={() => seenMutation.mutate(t.sr_no)}
                        disabled={seenMutation.isPending}
                        className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-bold transition shadow-sm flex items-center gap-1.5"
                      >
                        <EyeIcon className="w-4 h-4" />
                        Mark Seen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Complete Modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mark Task as Complete</h3>
            <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
              <p className="text-[11px] font-bold text-brand-600">{completeModal.sr_no}</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">{completeModal.job}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500"
                placeholder="Any comments about completion..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setCompleteModal(null); setReason(''); }}
                className="flex-1 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => completeMutation.mutate({ task_sr_no: completeModal.sr_no, reason })}
                disabled={completeMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition disabled:opacity-50"
              >
                {completeMutation.isPending ? 'Saving...' : 'Confirm Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Task Modal (Admin Only) */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PlusCircleIcon className="w-6 h-6 text-brand-600" />
                Assign New Task
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                <XMarkIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Mode Toggle */}
              <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAssignMode('list')}
                  className={`flex-1 px-4 py-2 text-[12px] font-bold rounded-md transition-all ${
                    assignMode === 'list'
                      ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  Select from List
                </button>
                <button
                  type="button"
                  onClick={() => setAssignMode('manual')}
                  className={`flex-1 px-4 py-2 text-[12px] font-bold rounded-md transition-all ${
                    assignMode === 'manual'
                      ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  Enter Manually
                </button>
              </div>

              {/* Employee Select (List Mode) */}
              {assignMode === 'list' ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Select Employee *</label>
                  <select
                    value={assignForm.employeeId}
                    onChange={(e) => setAssignForm(p => ({ ...p, employeeId: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((emp) => (
                      <option key={emp.emp_id} value={emp.emp_id}>
                        {emp.name_with_department || `${emp.user_name}${emp.department ? ` - ${emp.department}` : ''}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Employee Name *</label>
                    <input
                      type="text"
                      value={assignForm.manualName}
                      onChange={(e) => setAssignForm(p => ({ ...p, manualName: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                      placeholder="Enter full name..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={assignForm.manualEmail}
                        onChange={(e) => setAssignForm(p => ({ ...p, manualEmail: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Phone</label>
                      <input
                        type="tel"
                        value={assignForm.manualPhone}
                        onChange={(e) => setAssignForm(p => ({ ...p, manualPhone: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                        placeholder="+91 XXXXXXXXXX"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Job Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Task Description *</label>
                <textarea
                  value={assignForm.jobDescription}
                  onChange={(e) => setAssignForm(p => ({ ...p, jobDescription: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
                  placeholder="Describe the task to be assigned..."
                />
              </div>

              {/* Deadline Date */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Deadline *</label>
                <input
                  type="date"
                  value={assignForm.deadline}
                  onChange={(e) => setAssignForm(p => ({ ...p, deadline: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowAssignModal(false); setAssignMode('list'); setAssignForm({ employeeId: '', manualName: '', manualEmail: '', manualPhone: '', jobDescription: '', deadline: '' }); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={assignMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition disabled:opacity-50 shadow-lg shadow-brand-600/20"
              >
                {assignMutation.isPending ? 'Assigning...' : 'Assign Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
