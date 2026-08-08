import React, { useState } from 'react';
import { useNotificationContext } from '../context/NotificationContext';
import type { SendNotificationRequest, NotificationType, TargetType } from '../types';
import { Send, Mail, MessageSquare, Smartphone } from 'lucide-react';

export const BroadcastForm: React.FC = () => {
  const { sendNotification } = useNotificationContext();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<NotificationType>('app_alert');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [targetIds, setTargetIds] = useState('');
  const [channels, setChannels] = useState<{ [key: string]: boolean }>({
    email: true,
    sms: false,
    push: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;

    try {
      setIsSubmitting(true);
      setSuccessMsg(null);

      const activeChannels = Object.keys(channels).filter((c) => channels[c]);
      const parsedIds = targetIds
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const req: SendNotificationRequest = {
        title,
        body,
        type,
        channels: activeChannels,
        target: {
          type: targetType,
          ids: targetType !== 'all' ? parsedIds : undefined,
        },
      };

      await sendNotification(req);
      setSuccessMsg('Notification dispatched successfully!');

      // Reset form
      setTitle('');
      setBody('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-xl">
      <h2 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
        <Send className="w-4 h-4 text-indigo-400" />
        Dispatch Notification Payload
      </h2>

      {successMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium animate-in fade-in">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">
            Title <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Flash Sale 50% Off"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Body */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">
            Message Body <span className="text-rose-400">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter notification message content..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>

        {/* Notification Type & Target Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Category Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as NotificationType)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="app_alert">App Alert</option>
              <option value="push">Push Notification</option>
              <option value="email">Email Digest</option>
              <option value="sms">SMS OTP</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Target Scope</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as TargetType)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Broadcast to All Users</option>
              <option value="user">Specific User IDs</option>
              <option value="segment">User Segment</option>
            </select>
          </div>
        </div>

        {/* Target IDs (Conditional) */}
        {targetType !== 'all' && (
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Target User IDs (comma-separated)
            </label>
            <input
              type="text"
              value={targetIds}
              onChange={(e) => setTargetIds(e.target.value)}
              placeholder="e.g. client_A, client_B, usr_100"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Async Channel Workers */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-2">
            Async Delivery Channels (JetStream Workers)
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.email}
                onChange={(e) => setChannels({ ...channels, email: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
              />
              <Mail className="w-3.5 h-3.5 text-blue-400" /> Email Worker
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.sms}
                onChange={(e) => setChannels({ ...channels, sms: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
              />
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> SMS Worker
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.push}
                onChange={(e) => setChannels({ ...channels, push: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
              />
              <Smartphone className="w-3.5 h-3.5 text-purple-400" /> Push Worker
            </label>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? 'Dispatching Payload...' : 'Send Notification'}
        </button>
      </form>
    </div>
  );
};
