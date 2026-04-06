import { useState, useEffect, useCallback } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import api from '../api';

interface Props {
  meetingId: number;
  meetingType: 'Regular' | 'BR';
  onComplete?: () => void;
}

interface StageInfo {
  stage: string;
  step: number;
  total: number;
  label: string;
  status: string;
}

const stageIcons: Record<string, string> = {
  uploading: '📤',
  transcribing: '🎤',
  summarizing: '🧠',
  generating_pdfs: '📄',
  uploading_assets: '☁️',
  finalizing: '🔗',
  completed: '✅',
  failed: '❌',
};

const ProcessingBanner: React.FC<Props> = ({ meetingId, meetingType, onComplete }) => {
  const [stageInfo, setStageInfo] = useState<StageInfo | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pollActive, setPollActive] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get(`/recording/status/${meetingId}`, {
        params: { meeting_type: meetingType },
      });
      setStageInfo(res.data);

      if (res.data.stage === 'completed') {
        setPollActive(false);
        if (onComplete) onComplete();
      } else if (res.data.stage === 'failed') {
        setPollActive(false);
      }
    } catch {
      // Silently fail — meeting may not be processing
    }
  }, [meetingId, meetingType, onComplete]);

  useEffect(() => {
    fetchStatus(); // initial fetch
    if (!pollActive) return;

    const interval = setInterval(fetchStatus, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, [fetchStatus, pollActive]);

  // Don't render if no processing info or meeting isn't in a processing state
  if (!stageInfo || (!stageInfo.stage && stageInfo.status !== 'Processing')) return null;
  if (stageInfo.stage === '' && stageInfo.status !== 'Processing') return null;

  const progress = stageInfo.total > 0 ? (stageInfo.step / stageInfo.total) * 100 : 0;
  const isComplete = stageInfo.stage === 'completed';
  const isFailed = stageInfo.stage === 'failed';
  const icon = stageIcons[stageInfo.stage] || '⏳';

  // Auto-hide after completion
  if (isComplete && stageInfo.status !== 'Processing') return null;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-500 ${
      isFailed
        ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
        : isComplete
        ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20'
        : 'bg-brand-50 dark:bg-brand-500/5 border-brand-200 dark:border-brand-500/20'
    }`}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-3.5 group"
      >
        <div className="flex items-center gap-3">
          {isFailed ? (
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
          ) : isComplete ? (
            <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
          ) : (
            <ArrowPathIcon className="w-5 h-5 text-brand-500 animate-spin" />
          )}
          <div className="text-left">
            <p className={`text-[13px] font-bold ${
              isFailed ? 'text-red-700 dark:text-red-400' 
              : isComplete ? 'text-emerald-700 dark:text-emerald-400' 
              : 'text-brand-700 dark:text-brand-400'
            }`}>
              {isComplete ? 'AI Processing Complete' : isFailed ? 'AI Processing Failed' : 'AI Pipeline Running...'}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              {icon} {stageInfo.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isComplete && !isFailed && (
            <span className="text-[12px] font-bold text-brand-600 dark:text-brand-400 tabular-nums">
              {stageInfo.step}/{stageInfo.total}
            </span>
          )}
          {collapsed ? (
            <ChevronDownIcon className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUpIcon className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Progress Details (collapsible) */}
      {!collapsed && (
        <div className="px-5 pb-4 space-y-3">
          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-white/50 dark:bg-white/5 rounded-full overflow-hidden border border-slate-200/50 dark:border-white/10">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                isFailed ? 'bg-red-500' : isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-brand-500 to-purple-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Stage Timeline */}
          <div className="grid grid-cols-6 gap-1">
            {['uploading', 'transcribing', 'summarizing', 'generating_pdfs', 'uploading_assets', 'finalizing'].map((stage, i) => {
              const stepNum = i + 1;
              const isDone = stageInfo.step > stepNum || isComplete;
              const isCurrent = stageInfo.step === stepNum && !isComplete && !isFailed;
              return (
                <div key={stage} className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    isDone
                      ? 'bg-emerald-500 text-white scale-100'
                      : isCurrent
                      ? 'bg-brand-500 text-white animate-pulse scale-110'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}>
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span className={`text-[8px] font-bold uppercase tracking-wider text-center leading-tight ${
                    isDone ? 'text-emerald-600 dark:text-emerald-400' : isCurrent ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'
                  }`}>
                    {stageIcons[stage]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Info text */}
          <p className="text-[10px] text-slate-400 font-medium text-center">
            {isComplete
              ? 'All intelligence assets have been generated. You can now review the results above.'
              : isFailed
              ? 'An error occurred during processing. Check backend logs for details.'
              : 'You can navigate away from this page — processing will continue in the background.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ProcessingBanner;
