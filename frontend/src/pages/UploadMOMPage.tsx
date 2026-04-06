import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { ArrowUpTrayIcon, DocumentIcon, SparklesIcon, PlusIcon } from '@heroicons/react/24/outline';
import api from '../api';

export default function UploadMOMPage() {
  const [file, setFile] = useState<File | null>(null);
  const [meetingType, setMeetingType] = useState<'Meeting' | 'Board Resolution'>('Meeting');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onDrop = useCallback((files: File[]) => {
    if (files.length > 0) setFile(files[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = meetingType === 'Board Resolution' ? '/br/upload' : '/upload/mom';

      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`${meetingType} processed successfully!`);
      navigate(`${meetingType === 'Board Resolution' ? '/br' : '/meetings'}/${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button 
        onClick={() => navigate('/')} 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-brand-500 transition-colors mb-2 w-fit"
      >
        <PlusIcon className="w-3 h-3 rotate-45" /> Back to Dashboard
      </button>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Upload MOM Document</h2>

      <div className="bg-white dark:bg-[#161b27] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Meeting Category</label>
        <div className="flex gap-2">
          <button
            onClick={() => setMeetingType('Meeting')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${meetingType === 'Meeting' ? 'bg-brand-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
          >
            Regular Meeting
          </button>
          <button
            onClick={() => setMeetingType('Board Resolution')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${meetingType === 'Board Resolution' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
          >
            Board Resolution
          </button>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${isDragActive
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-600 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10'
          }`}
      >
        <input {...getInputProps()} />
        <ArrowUpTrayIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
        {isDragActive ? (
          <p className="text-brand-600 font-medium">Drop the file here...</p>
        ) : (
          <>
            <p className="text-slate-600 dark:text-slate-300 font-medium">Drag & drop a PDF or TXT file here</p>
            <p className="text-sm text-slate-400 mt-1">or click to browse (max 10MB)</p>
          </>
        )}
      </div>

      {/* Uploaded File Info */}
      {file && (
        <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <DocumentIcon className="w-8 h-8 text-brand-500" />
          <div className="flex-1">
            <p className="font-medium text-slate-900 dark:text-white">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={() => setFile(null)} className="text-sm text-red-500 hover:underline font-medium">
            Remove
          </button>
        </div>
      )}

      {/* Upload & Process Button — Brand Blue, Always Visible */}
      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-[15px] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(57,157,255,0.35)] hover:shadow-[0_6px_20px_rgba(57,157,255,0.45)] active:scale-[0.98] flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
            Processing with AI...
          </>
        ) : (
          <>
            <SparklesIcon className="w-5 h-5" />
            Upload & Process with AI
          </>
        )}
      </button>

      {/* How it Works */}
      <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-5">
        <h3 className="font-semibold text-brand-800 dark:text-brand-300 mb-2">How it works</h3>
        <ol className="text-sm text-brand-700 dark:text-brand-400 space-y-1.5 list-decimal list-inside">
          <li>Upload your MOM document (PDF or TXT)</li>
          <li>AI extracts meeting details, attendees, agenda, and action items</li>
          <li>Data is saved and tasks are automatically created</li>
          <li>Notifications are sent to responsible persons</li>
        </ol>
      </div>
    </div>
  );
}
