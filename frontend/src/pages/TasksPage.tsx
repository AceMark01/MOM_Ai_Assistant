import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  ArrowRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  ClockIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import api from '../api';
import type { GlobalTask } from '../types';

export default function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('source') as 'All' | 'Regular' | 'BR' || 'All';
  const initialStatus = searchParams.get('status') as 'All' | 'Pending' | 'In Progress' | 'Completed' || 'All';
  const initialMeetingId = searchParams.get('meeting_id');

  const [filter, setFilter] = useState<'All' | 'Regular' | 'BR'>(initialFilter);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Completed'>(initialStatus);
  const [search, setSearch] = useState('');

  const { data: tasks = [], isLoading } = useQuery<GlobalTask[]>({
    queryKey: ['global-tasks'],
    queryFn: async () => (await api.get('/meetings/global/tasks')).data,
  });

  const updateSourceFilter = (s: 'All' | 'Regular' | 'BR') => {
    setFilter(s);
    setSearchParams(prev => {
      if (s === 'All') prev.delete('source');
      else prev.set('source', s);
      return prev;
    });
  };

  const updateStatusFilter = (s: 'All' | 'Pending' | 'In Progress' | 'Completed') => {
    setStatusFilter(s);
    setSearchParams(prev => {
      if (s === 'All') prev.delete('status');
      else prev.set('status', s);
      return prev;
    });
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSource = filter === 'All' || t.source === filter;
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchesMeetingId = !initialMeetingId || t.meeting_id === parseInt(initialMeetingId);
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                         t.meeting_title.toLowerCase().includes(search.toLowerCase());
    return matchesSource && matchesStatus && matchesMeetingId && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'text-green-600 bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20';
      case 'In Progress': return 'text-brand-600 bg-brand-50 dark:bg-brand-500/10 border-brand-100 dark:border-brand-500/20';
      case 'Pending': return 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20';
      default: return 'text-slate-600 bg-slate-50 dark:bg-slate-500/10 border-slate-100 dark:border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto animate-in fade-in duration-500">
      
      {/* ── Header ── */}
      <div className="flex flex-col gap-1">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-brand-500 transition-colors mb-2 w-fit">
          <PlusIcon className="w-3 h-3 rotate-45" /> Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardDocumentListIcon className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            Global Task Intelligence
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tracking {filteredTasks.length} action items across all governance modules
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks or meetings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 text-sm bg-white dark:bg-[#161b27] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none text-slate-900 dark:text-white shadow-sm"
          />
        </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#161b27] p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 text-slate-400 pr-2 border-r border-slate-100 dark:border-slate-800">
          <FunnelIcon className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Filters</span>
        </div>
        
        {/* Source Filter */}
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
          {(['All', 'Regular', 'BR'] as const).map((s) => (
            <button
              key={s}
              onClick={() => updateSourceFilter(s)}
              className={`px-4 py-1.5 text-[12px] font-bold rounded-md transition-all ${
                filter === s 
                ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-lg ml-auto">
          {(['All', 'Pending', 'In Progress', 'Completed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => updateStatusFilter(s)}
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
      </div>

      {/* ── Task List ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium tracking-wide">Synthesizing task data...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#161b27] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
          <ClipboardDocumentListIcon className="w-16 h-16 text-slate-200 dark:text-slate-800 mb-2" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Clear Skies</h3>
          <p className="text-slate-400 text-sm">No tasks matching your current intelligence filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTasks.map((t) => (
            <div 
              key={`${t.source}-${t.id}`}
              className="group bg-white dark:bg-[#161b27] p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-brand-500/30 transition-all duration-300 relative overflow-hidden"
            >
              {/* Type Accent */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${t.source === 'BR' ? 'bg-amber-500' : 'bg-brand-500'}`} />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-3 min-w-0 flex-1">
                  {/* Meeting Link & Source */}
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-opacity-20 ${
                      t.source === 'BR' 
                        ? 'text-amber-600 bg-amber-50 border-amber-600 dark:bg-amber-500/10' 
                        : 'text-brand-600 bg-brand-50 border-brand-600 dark:bg-brand-500/10'
                    }`}>
                      {t.source === 'BR' ? 'BOARD RESOLUTION' : 'MOM RECORD'}
                    </span>
                    <Link 
                      to={t.source === 'BR' ? `/br/${t.meeting_id}` : `/meetings/${t.meeting_id}`}
                      className="text-[12px] font-bold text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1 transition-colors"
                    >
                      {t.meeting_title}
                      <ArrowRightIcon className="w-3 h-3" />
                    </Link>
                  </div>

                  {/* Task Name */}
                  <h4 className="text-[17px] font-bold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">
                    {t.title}
                  </h4>
                  
                  {t.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {t.description}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-bold text-brand-600 uppercase">
                        {(t.responsible_person || '?')[0]}
                      </div>
                      <span className="text-[13px] font-medium">{t.responsible_person || 'Unassigned'}</span>
                    </div>

                    {t.deadline && (
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <ClockIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-[13px] font-medium uppercase">DL: {t.deadline}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Column */}
                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 shrink-0">
                  <span className={`px-4 py-1.5 rounded-xl text-[12px] font-extrabold border shadow-sm ${getStatusColor(t.status)}`}>
                    {t.status.toUpperCase()}
                  </span>
                  
                  <Link 
                    to={t.source === 'BR' ? `/br/${t.meeting_id}` : `/meetings/${t.meeting_id}`}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all border border-transparent hover:border-brand-500/20 shadow-sm"
                  >
                    <ArrowRightIcon className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
