import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    TrashIcon,
    CalendarDaysIcon,
    MapPinIcon,
    ClipboardDocumentListIcon,
    BuildingOfficeIcon,
    ArrowRightIcon,
    PlusIcon,
    ArrowUpTrayIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import api from '../api';
import type { MeetingListItem } from '../types';

export default function BRMeetingsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'Upcoming' | 'Passed' | 'Cancelled'>('Upcoming');

    const { data: meetings = [], isLoading } = useQuery<MeetingListItem[]>({
        queryKey: ['br-meetings'],
        queryFn: async () => (await api.get('/br/')).data,
    });

    const handleDelete = async (id: number, title: string) => {
        if (!window.confirm(`Delete Board Resolution "${title}"?\nThis action cannot be undone.`)) return;
        try {
            await api.delete(`/br/${id}`);
            toast.success('Resolution deleted');
            queryClient.invalidateQueries({ queryKey: ['br-meetings'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        } catch {
            toast.error('Failed to delete resolution');
        }
    };

    const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Completed'>('All');

    const upcomingMeetings = meetings.filter(m => m.status === 'Scheduled' || m.status === 'Rescheduled' || m.status === 'Processing');
    const passedMeetings = meetings.filter(m => m.status === 'Completed');
    const cancelledMeetings = meetings.filter(m => m.status === 'Cancelled');

    let displayedMeetings =
        activeTab === 'Passed' ? passedMeetings :
            activeTab === 'Cancelled' ? cancelledMeetings : upcomingMeetings;

    if (statusFilter !== 'All') {
        displayedMeetings = displayedMeetings.filter(m => {
            if (statusFilter === 'Pending') return (m.pending_tasks || 0) > 0;
            if (statusFilter === 'In Progress') return (m.in_progress_tasks || 0) > 0;
            if (statusFilter === 'Completed') return (m.completed_tasks || 0) > 0;
            return true;
        });
    }

    const totalTasks = meetings.reduce((acc, m) => acc + (m.task_count || 0), 0);
    const totalPending = meetings.reduce((acc, m) => acc + (m.pending_tasks || 0), 0);
    const totalInProgress = meetings.reduce((acc, m) => acc + (m.in_progress_tasks || 0), 0);
    const totalCompleted = meetings.reduce((acc, m) => acc + (m.completed_tasks || 0), 0);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed': return 'text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400 border-green-100 dark:border-green-500/20';
            case 'Processing': return 'text-brand-600 bg-brand-50 dark:bg-brand-500/10 dark:text-brand-400 border-brand-100 dark:border-brand-500/20 animate-pulse';
            case 'Rescheduled': return 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100 dark:border-amber-500/20';
            case 'Cancelled': return 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400 border-red-100 dark:border-red-500/20';
            default: return 'text-brand-600 bg-brand-50 dark:bg-brand-500/10 dark:text-brand-400 border-brand-100 dark:border-brand-500/20';
        }
    };

    return (
        <div className="space-y-5 max-w-[1200px] mx-auto">

            {/* ── Page Header ── */}
            <div className="flex flex-col gap-1">
                <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-brand-500 transition-colors mb-2 w-fit">
                    <PlusIcon className="w-3 h-3 rotate-45" /> Back to Dashboard
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-2">
                        <Link
                            to="/upload"
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-all border border-slate-200 dark:border-slate-800"
                        >
                            <ArrowUpTrayIcon className="w-4 h-4" />
                            Upload BR
                        </Link>
                        <Link
                            to="/schedule-meeting"
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-all border border-brand-100 dark:border-brand-500/20"
                        >
                            <CalendarDaysIcon className="w-4 h-4" />
                            Schedule BR
                        </Link>
                        <Link
                            to="/create-mom"
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-200 dark:shadow-brand-900/40 transition-all active:scale-[0.98]"
                        >
                            <PlusIcon className="w-4 h-4" />
                            New Resolution
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── Action Item Intelligence Summary ── */}
            <div className="bg-white dark:bg-[#161b27] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-white/5">
                    <div className="flex items-center gap-2">
                        <ShieldCheckIcon className="w-4 h-4 text-brand-500" />
                        <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Action Item Intelligence Summary</span>
                    </div>
                    <Link to="/tasks?source=BR" className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                        View All Action Items <ArrowRightIcon className="w-3 h-3" />
                    </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800 relative">
                    <div 
                        onClick={() => setStatusFilter('All')}
                        className={`group flex flex-col gap-1 px-4 py-3 cursor-pointer transition-all ${statusFilter === 'All' ? 'bg-brand-50/50 dark:bg-brand-500/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Action Items</p>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-slate-800 dark:text-white">{totalTasks}</span>
                            <ClipboardDocumentListIcon className={`w-4 h-4 transition-transform group-hover:scale-110 ${statusFilter === 'All' ? 'text-brand-500' : 'text-slate-300'}`} />
                        </div>
                    </div>
                    <div 
                        onClick={() => setStatusFilter('Pending')}
                        className={`group flex flex-col gap-1 px-4 py-3 cursor-pointer transition-all ${statusFilter === 'Pending' ? 'bg-amber-50/50 dark:bg-amber-500/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Pending</p>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-slate-800 dark:text-white">{totalPending}</span>
                            <div className={`w-2 h-2 rounded-full transition-transform group-hover:scale-125 ${statusFilter === 'Pending' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-amber-200'}`} />
                        </div>
                    </div>
                    <div 
                        onClick={() => setStatusFilter('In Progress')}
                        className={`group flex flex-col gap-1 px-4 py-3 cursor-pointer transition-all ${statusFilter === 'In Progress' ? 'bg-brand-50/50 dark:bg-brand-500/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                        <p className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">In Progress</p>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-slate-800 dark:text-white">{totalInProgress}</span>
                            <div className={`w-2 h-2 rounded-full transition-transform group-hover:scale-125 ${statusFilter === 'In Progress' ? 'bg-brand-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-brand-200'}`} />
                        </div>
                    </div>
                    <div 
                        onClick={() => setStatusFilter('Completed')}
                        className={`group flex flex-col gap-1 px-4 py-3 cursor-pointer transition-all ${statusFilter === 'Completed' ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Completed</p>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-slate-800 dark:text-white">{totalCompleted}</span>
                            <div className={`w-2 h-2 rounded-full transition-transform group-hover:scale-125 ${statusFilter === 'Completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-emerald-200'}`} />
                        </div>
                    </div>

                    {statusFilter !== 'All' && (
                        <button 
                            onClick={() => setStatusFilter('All')}
                            className="absolute bottom-1 right-2 text-[9px] font-bold text-brand-500 hover:underline flex items-center gap-0.5 z-10"
                        >
                            Reset Filter
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('Upcoming')}
                    className={`px-5 py-2 text-[13px] font-bold rounded-lg transition-colors ${activeTab === 'Upcoming'
                        ? 'bg-white dark:bg-[#161b27] text-brand-600 dark:text-brand-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                >
                    Upcoming ({upcomingMeetings.length})
                </button>
                <button
                    onClick={() => setActiveTab('Passed')}
                    className={`px-5 py-2 text-[13px] font-bold rounded-lg transition-colors ${activeTab === 'Passed'
                        ? 'bg-white dark:bg-[#161b27] text-brand-600 dark:text-brand-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                >
                    Passed ({passedMeetings.length})
                </button>
                <button
                    onClick={() => setActiveTab('Cancelled')}
                    className={`px-5 py-2 text-[13px] font-bold rounded-lg transition-colors ${activeTab === 'Cancelled'
                        ? 'bg-white dark:bg-[#161b27] text-brand-600 dark:text-brand-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                >
                    Cancelled ({cancelledMeetings.length})
                </button>
            </div>

            {/* ── Content ── */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-52 gap-3">
                    <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-400">Loading resolutions…</p>
                </div>
            ) : displayedMeetings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-52 gap-3 bg-white dark:bg-[#161b27] rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    <ShieldCheckIcon className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-medium text-slate-400">No {activeTab.toLowerCase()} resolutions found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {displayedMeetings.map((m) => (
                        <div
                            key={m.id}
                            className="group bg-white dark:bg-[#161b27] rounded-2xl border border-slate-100 dark:border-slate-800 px-5 py-4 shadow-sm hover:shadow-md hover:border-brand-200 dark:hover:border-brand-500/30 transition-all duration-200"
                        >
                            <div className="flex items-start justify-between gap-4">

                                {/* Left – Info */}
                                <div className="flex items-start gap-4 min-w-0">
                                    {/* Status Indicator Bar */}
                                    <div className={`w-1 self-stretch rounded-full ${m.status === 'Completed' ? 'bg-green-500' :
                                            m.status === 'Cancelled' ? 'bg-red-500' :
                                                m.status === 'Rescheduled' ? 'bg-amber-500' :
                                                    'bg-brand-500'
                                        }`} />

                                    {/* Icon */}
                                    <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
                                        <ShieldCheckIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                    </div>

                                    {/* Text */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Link
                                                to={`/br/${m.id}`}
                                                className="text-[15px] font-bold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors line-clamp-1"
                                            >
                                                <span className="text-brand-500 font-mono text-[13px] mr-1.5 opacity-70">BR-{String(m.id).padStart(3, '0')}</span>
                                                {m.title}
                                            </Link>
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${getStatusColor(m.status)}`}>
                                                {m.status === 'Completed' ? 'Passed' : m.status}
                                            </span>
                                            {m.status === 'Completed' && (
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${m.sent_to_cs 
                                                    ? 'text-green-600 bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20' 
                                                    : 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20'}`}>
                                                    {m.sent_to_cs ? 'CS FILED' : 'CS PENDING'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Meta row */}
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                                            {m.organization && (
                                                <span className="flex items-center gap-1 text-[12px] text-slate-500 dark:text-slate-400">
                                                    <BuildingOfficeIcon className="w-3.5 h-3.5 shrink-0" />
                                                    {m.organization}
                                                </span>
                                            )}
                                            {m.date && (
                                                <span className="flex items-center gap-1 text-[12px] text-slate-500 dark:text-slate-400">
                                                    <CalendarDaysIcon className="w-3.5 h-3.5 shrink-0" />
                                                    {m.date}
                                                </span>
                                            )}
                                            {m.venue && (
                                                <span className="flex items-center gap-1 text-[12px] text-slate-500 dark:text-slate-400">
                                                    <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
                                                    {m.venue}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right – Badges + Actions */}
                                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0 ml-auto">
                                    {/* Action Item badge */}
                                    <div className="hidden lg:flex flex-col items-end gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <div className="flex flex-col items-center px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 min-w-[70px]">
                                                <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-tighter">Pending</span>
                                                <span className="text-[13px] font-bold text-amber-700 dark:text-amber-300 leading-none">{m.pending_tasks}</span>
                                            </div>
                                            <div className="flex flex-col items-center px-2 py-1 rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 min-w-[70px]">
                                                <span className="text-[9px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-tighter">In Progress</span>
                                                <span className="text-[13px] font-bold text-brand-700 dark:text-brand-300 leading-none">{m.in_progress_tasks}</span>
                                            </div>
                                            <div className="flex flex-col items-center px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 min-w-[70px]">
                                                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Completed</span>
                                                <span className="text-[13px] font-bold text-emerald-700 dark:text-emerald-300 leading-none">{m.completed_tasks}</span>
                                            </div>
                                        </div>
                                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                                            <ClipboardDocumentListIcon className="w-3.5 h-3.5" />
                                            {m.task_count} action items
                                        </span>
                                    </div>

                                    {/* View button */}
                                    <div className="flex items-center gap-2">
                                        <Link
                                            to={`/br/${m.id}`}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-[12px] font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-100 transition-colors"
                                        >
                                            View <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </Link>
                                    </div>

                                    {/* Delete */}
                                    <button
                                        onClick={() => handleDelete(m.id, m.title)}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all"
                                        title="Delete resolution"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
