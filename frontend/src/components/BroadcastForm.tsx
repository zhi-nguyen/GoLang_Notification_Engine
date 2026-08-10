import React, { useState } from 'react';
import { useNotificationContext } from '../context/NotificationContext';
import type { SendNotificationRequest, NotificationType, TargetType } from '../types';
import { PaperAirplaneSolid } from './Icons';

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: 'app_alert', label: 'App Alert' },
  { value: 'push', label: 'Push Notification' },
  { value: 'email', label: 'Email Digest' },
  { value: 'sms', label: 'SMS OTP' },
];

const TARGET_TYPES: { value: TargetType; label: string }[] = [
  { value: 'all', label: 'Broadcast to All Users' },
  { value: 'user', label: 'Specific User IDs' },
  { value: 'segment', label: 'User Segment' },
];

const CHANNEL_OPTIONS = [
  { key: 'email', label: 'Email Worker' },
  { key: 'sms', label: 'SMS Worker' },
  { key: 'push', label: 'Push Worker' },
];

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
    <div className="p-5 rounded-lg bg-white border border-[#e0e0e0] shadow-sm">
      <h2 className="text-sm font-bold text-[#1b1b1b] mb-4">
        Dispatch Notification Payload
      </h2>

      {successMsg && (
        <div className="mb-4 p-3 rounded-md bg-[#49cc90]/10 border border-[#49cc90]/40 text-[#2d8a5e] text-xs font-medium">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="text-xs font-semibold text-[#3b4151] block mb-1.5">
            Title <span className="text-[#f93e3e]">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Flash Sale 50% Off"
            className="w-full px-3 py-2 rounded-md bg-white border border-[#d1d5db] text-[#3b4151] text-xs focus:outline-none focus:border-[#4990e2] focus:ring-1 focus:ring-[#4990e2]/30 transition-colors"
          />
        </div>

        {/* Body */}
        <div>
          <label className="text-xs font-semibold text-[#3b4151] block mb-1.5">
            Message Body <span className="text-[#f93e3e]">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter notification message content..."
            className="w-full px-3 py-2 rounded-md bg-white border border-[#d1d5db] text-[#3b4151] text-xs focus:outline-none focus:border-[#4990e2] focus:ring-1 focus:ring-[#4990e2]/30 transition-colors resize-none"
          />
        </div>

        {/* Notification Type & Target Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-[#3b4151] block mb-1.5">Category Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as NotificationType)}
              className="w-full px-3 py-2 rounded-md bg-white border border-[#d1d5db] text-[#3b4151] text-xs focus:outline-none focus:border-[#4990e2]"
            >
              {NOTIFICATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#3b4151] block mb-1.5">Target Scope</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as TargetType)}
              className="w-full px-3 py-2 rounded-md bg-white border border-[#d1d5db] text-[#3b4151] text-xs focus:outline-none focus:border-[#4990e2]"
            >
              {TARGET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Target IDs (Conditional) */}
        {targetType !== 'all' && (
          <div>
            <label className="text-xs font-semibold text-[#3b4151] block mb-1.5">
              Target User IDs (comma-separated)
            </label>
            <input
              type="text"
              value={targetIds}
              onChange={(e) => setTargetIds(e.target.value)}
              placeholder="e.g. client_A, client_B, usr_100"
              className="w-full px-3 py-2 rounded-md bg-white border border-[#d1d5db] text-[#3b4151] text-xs font-mono focus:outline-none focus:border-[#4990e2]"
            />
          </div>
        )}

        {/* Async Channel Workers */}
        <div>
          <label className="text-xs font-semibold text-[#3b4151] block mb-2">
            Async Delivery Channels (JetStream Workers)
          </label>
          <div className="flex gap-4">
            {CHANNEL_OPTIONS.map((ch) => (
              <label key={ch.key} className="flex items-center gap-2 text-xs text-[#3b4151] cursor-pointer">
                <input
                  type="checkbox"
                  checked={channels[ch.key]}
                  onChange={(e) => setChannels({ ...channels, [ch.key]: e.target.checked })}
                  className="rounded border-[#d1d5db] text-[#4990e2] focus:ring-[#4990e2]/30 accent-[#4990e2]"
                />
                {ch.label}
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 rounded-md bg-[#4990e2] hover:bg-[#3d7bc7] text-white font-semibold text-xs shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <PaperAirplaneSolid className="w-3.5 h-3.5" />
          {isSubmitting ? 'Dispatching Payload...' : 'Send Notification'}
        </button>
      </form>
    </div>
  );
};
