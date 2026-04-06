import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../api';
import type { MeetingFormData, AttendanceStatus, TaskStatus } from '../types';

const emptyForm: MeetingFormData = {
  title: '',
  organization: '',
  meeting_type: '',
  meeting_mode: 'Online',
  date: '',
  time: '',
  venue: '',
  hosted_by: '',
  attendees: [],
  agenda_items: [],
  discussion_summary: '',
  tasks: [],
  next_meeting: { next_date: '', next_time: '' },
};

export default function CreateMOMPage() {
  const [form, setForm] = useState<MeetingFormData>({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Load branding config for autofill
  useEffect(() => {
    api.get('/branding/').then(({ data }) => {
      if (data.client_name) {
        setForm(prev => ({ ...prev, organization: data.client_name }));
      }
    }).catch(err => console.error('Failed to load branding:', err));
  }, []);

  const updateField = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  // Attendees
  const addAttendee = () =>
    setForm((p) => ({
      ...p,
      attendees: [...p.attendees, { user_name: '', email: '', designation: '', whatsapp_number: '', remarks: '', attendance_status: 'Present' as AttendanceStatus }],
    }));
  const removeAttendee = (i: number) =>
    setForm((p) => ({ ...p, attendees: p.attendees.filter((_, idx) => idx !== i) }));
  const updateAttendee = (i: number, field: string, value: string) =>
    setForm((p) => ({
      ...p,
      attendees: p.attendees.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)),
    }));

  // Agenda
  const addAgenda = () =>
    setForm((p) => ({ ...p, agenda_items: [...p.agenda_items, { topic: '', description: '' }] }));
  const removeAgenda = (i: number) =>
    setForm((p) => ({ ...p, agenda_items: p.agenda_items.filter((_, idx) => idx !== i) }));
  const updateAgenda = (i: number, field: string, value: string) =>
    setForm((p) => ({
      ...p,
      agenda_items: p.agenda_items.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)),
    }));

  // Tasks
  const addTask = () =>
    setForm((p) => ({
      ...p,
      tasks: [
        ...p.tasks,
        { title: '', description: '', responsible_person: '', responsible_email: '', deadline: '', status: 'Pending' as TaskStatus, _manualMode: false } as any,
      ],
    }));
  const removeTask = (i: number) =>
    setForm((p) => ({ ...p, tasks: p.tasks.filter((_, idx) => idx !== i) }));
  const updateTask = (i: number, field: string, value: string) =>
    setForm((p) => ({
      ...p,
      tasks: p.tasks.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)),
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Meeting title is required');
      return;
    }
    if (form.tasks.length === 0) {
      toast.error('At least one task is required');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        date: form.date && form.date.trim() !== '' ? form.date : null,
        time: form.time && form.time.trim() !== '' ? form.time : null,
        tasks: form.tasks.map((t) => ({
          ...t,
          deadline: t.deadline && t.deadline.trim() !== '' ? t.deadline : null,
          responsible_email: t.responsible_email && t.responsible_email.trim() !== '' ? t.responsible_email : null,
        })),
        attendees: form.attendees.map((a) => ({
          ...a,
          email: a.email && a.email.trim() !== '' ? a.email : null,
        })),
        next_meeting:
          form.next_meeting && (form.next_meeting.next_date?.trim() !== '' || form.next_meeting.next_time?.trim() !== '')
            ? {
              next_date: form.next_meeting.next_date && form.next_meeting.next_date.trim() !== '' ? form.next_meeting.next_date : null,
              next_time: form.next_meeting.next_time && form.next_meeting.next_time.trim() !== '' ? form.next_meeting.next_time : null,
            }
            : null,
      };
      const isBR = form.meeting_type?.toLowerCase().includes('board resolution') || form.meeting_type?.toLowerCase() === 'br';
      const endpoint = isBR ? '/br/' : '/meetings/';

      const { data } = await api.post(endpoint, payload);
      toast.success(`${isBR ? 'Resolution' : 'Meeting'} created successfully!`);
      navigate(`${isBR ? '/br' : '/meetings'}/${data.id}`);
    } catch (err: any) {
      // Handle backend error response: can be string or array of error objects
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        toast.error(detail);
      } else if (Array.isArray(detail)) {
        // Map array of error objects to readable string
        toast.error(detail.map((d: any) => d.msg || JSON.stringify(d)).join('\n'));
      } else {
        toast.error('Failed to create meeting');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="max-w-4xl mx-auto">
      <button 
        onClick={() => navigate('/meetings')} 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-brand-500 transition-colors mb-4 w-fit"
      >
        <PlusIcon className="w-3 h-3 rotate-45" /> Back to Meetings
      </button>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Create MOM Manually</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Meeting Details */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Meeting Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Title *</label>
              <input required value={form.title} onChange={(e) => updateField('title', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Organization</label>
              <input value={form.organization} onChange={(e) => updateField('organization', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Meeting Type</label>
              <select value={form.meeting_type} onChange={(e) => updateField('meeting_type', e.target.value)} className={inputClass}>
                <option value="">Regular Meeting</option>
                <option value="Board Resolution">Board Resolution</option>
                <option value="Committee Meeting">Committee Meeting</option>
                <option value="Annual General Meeting">Annual General Meeting</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Meeting Mode</label>
              <select value={form.meeting_mode} onChange={(e) => updateField('meeting_mode', e.target.value)} className={inputClass}>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Venue / Platform</label>
              <input value={form.venue} onChange={(e) => updateField('venue', e.target.value)} placeholder={form.meeting_mode === 'Online' ? 'Google Meet link...' : 'Conference Hall...'} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Time</label>
              <input type="time" value={form.time} onChange={(e) => updateField('time', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Hosted By</label>
              <input value={form.hosted_by} onChange={(e) => updateField('hosted_by', e.target.value)} className={inputClass} />
            </div>
          </div>
        </section>

        {/* Attendees */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Attendees</h3>
            <button type="button" onClick={addAttendee} className="flex items-center gap-1 text-sm text-brand-600 hover:underline">
              <PlusIcon className="w-4 h-4" /> Add
            </button>
          </div>
          {form.attendees.map((a, i) => (
            <div key={i} className="flex flex-col gap-3 mb-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <input placeholder="Unique ID" value={a.unique_id || ''} onChange={(e) => updateAttendee(i, 'unique_id', e.target.value)} className={inputClass} />
                <input placeholder="Name *" value={a.user_name} onChange={(e) => updateAttendee(i, 'user_name', e.target.value)} className={inputClass} />
                <input placeholder="Email" value={a.email || ''} onChange={(e) => updateAttendee(i, 'email', e.target.value)} className={inputClass} />
                <input placeholder="Designation" value={a.designation || ''} onChange={(e) => updateAttendee(i, 'designation', e.target.value)} className={inputClass} />
                <input placeholder="WhatsApp Number" value={a.whatsapp_number || ''} onChange={(e) => updateAttendee(i, 'whatsapp_number', e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input placeholder="Remarks (Sent in email notification if present)" value={a.remarks || ''} onChange={(e) => updateAttendee(i, 'remarks', e.target.value)} className={`md:col-span-2 ${inputClass}`} />
                <select value={a.attendance_status} onChange={(e) => updateAttendee(i, 'attendance_status', e.target.value)} className={inputClass}>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Excused">Excused</option>
                </select>
                <div className="flex items-center">
                  <button type="button" onClick={() => removeAttendee(i)} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1">
                    <TrashIcon className="w-4 h-4" /> Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Agenda */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agenda</h3>
            <button type="button" onClick={addAgenda} className="flex items-center gap-1 text-sm text-brand-600 hover:underline">
              <PlusIcon className="w-4 h-4" /> Add
            </button>
          </div>
          {form.agenda_items.map((a, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <input placeholder="Topic" value={a.topic} onChange={(e) => updateAgenda(i, 'topic', e.target.value)} className={inputClass} />
              <input placeholder="Description" value={a.description || ''} onChange={(e) => updateAgenda(i, 'description', e.target.value)} className={inputClass} />
              <button type="button" onClick={() => removeAgenda(i)} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1">
                <TrashIcon className="w-4 h-4" /> Remove
              </button>
            </div>
          ))}
        </section>

        {/* Discussion */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Discussion Summary</h3>
          <textarea
            rows={4}
            value={form.discussion_summary}
            onChange={(e) => updateField('discussion_summary', e.target.value)}
            className={inputClass}
            placeholder="Summarize the key discussion points..."
          />
        </section>

        {/* Tasks */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Action Items / Tasks</h3>
            <button type="button" onClick={addTask} className="flex items-center gap-1 text-sm text-brand-600 hover:underline">
              <PlusIcon className="w-4 h-4" /> Add
            </button>
          </div>
          {form.tasks.map((t, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3 items-start bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
              <input placeholder="Task title" value={t.title} onChange={(e) => updateTask(i, 'title', e.target.value)} className={inputClass} />

              <div className="md:col-span-2 flex flex-col gap-2">
                <select
                  value={(t as any)._manualMode ? '__OTHER__' : (t.responsible_person || '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__OTHER__') {
                      setForm(p => {
                        const newTasks = [...p.tasks];
                        (newTasks[i] as any)._manualMode = true;
                        newTasks[i].responsible_person = '';
                        newTasks[i].responsible_email = '';
                        return { ...p, tasks: newTasks };
                      });
                    } else if (val) {
                      const a = form.attendees.find(x => x.user_name === val);
                      setForm(p => {
                        const newTasks = [...p.tasks];
                        (newTasks[i] as any)._manualMode = false;
                        newTasks[i].responsible_person = a?.user_name || '';
                        newTasks[i].responsible_email = a?.email || '';
                        return { ...p, tasks: newTasks };
                      });
                    } else {
                      setForm(p => {
                        const newTasks = [...p.tasks];
                        (newTasks[i] as any)._manualMode = false;
                        newTasks[i].responsible_person = '';
                        newTasks[i].responsible_email = '';
                        return { ...p, tasks: newTasks };
                      });
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">-- Select Assignee --</option>
                  {form.attendees.map((a, aIdx) => (a.user_name ? <option key={aIdx} value={a.user_name}>{a.user_name} {a.email ? `(${a.email})` : ''}</option> : null))}
                  <option value="__OTHER__">Other / Manual</option>
                </select>

                {(t as any)._manualMode && (
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Name" value={t.responsible_person || ''} onChange={(e) => updateTask(i, 'responsible_person', e.target.value)} className={inputClass} />
                    <input placeholder="Email" value={t.responsible_email || ''} onChange={(e) => updateTask(i, 'responsible_email', e.target.value)} className={inputClass} />
                  </div>
                )}
              </div>

              <input type="date" value={t.deadline || ''} onChange={(e) => updateTask(i, 'deadline', e.target.value)} className={inputClass} />
              <select value={t.status} onChange={(e) => updateTask(i, 'status', e.target.value)} className={inputClass}>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
              <button type="button" onClick={() => removeTask(i)} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1">
                <TrashIcon className="w-4 h-4" /> Remove
              </button>
            </div>
          ))}
        </section>

        {/* Next Meeting */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Next Meeting</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date</label>
              <input
                type="date"
                value={form.next_meeting?.next_date || ''}
                onChange={(e) => setForm((p) => ({ ...p, next_meeting: { ...p.next_meeting!, next_date: e.target.value } }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Time</label>
              <input
                type="time"
                value={form.next_meeting?.next_time || ''}
                onChange={(e) => setForm((p) => ({ ...p, next_meeting: { ...p.next_meeting!, next_time: e.target.value } }))}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition disabled:opacity-50"
        >
          {loading ? 'Creating Meeting...' : 'Create Meeting'}
        </button>
      </form>
    </div>
  );
}
