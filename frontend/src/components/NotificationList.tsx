import React, { useState } from 'react';
import { useNotificationContext } from '../context/NotificationContext';
import type { NotificationType } from '../types';
import { RefreshSolid, FunnelSolid } from './Icons';

const TYPE_BADGE_STYLES: Record<string, string> = {
  email: 'bg-[#61affe]/15 text-[#3b82c4] border-[#61affe]/30',
  sms: 'bg-[#49cc90]/15 text-[#2d8a5e] border-[#49cc90]/30',
  push: 'bg-[#9b59b6]/15 text-[#7c3aad] border-[#9b59b6]/30',
  app_alert: 'bg-[#fca130]/15 text-[#b5741f] border-[#fca130]/30',
};

const TYPE_LABELS: Record<string, string> = {
  email: 'EMAIL',
  sms: 'SMS',
  push: 'PUSH',
  app_alert: 'APP_ALERT',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-[#fca130]',
  sending: 'text-[#61affe]',
  completed: 'text-[#49cc90]',
  failed: 'text-[#f93e3e]',
};

const METRIC_ITEMS = [
  { key: 'pending', label: 'Pending', color: 'text-[#fca130]' },
  { key: 'sending', label: 'Sending', color: 'text-[#61affe]' },
  { key: 'completed', label: 'Completed', color: 'text-[#49cc90]' },
  { key: 'failed', label: 'Failed', color: 'text-[#f93e3e]' },
] as const;

export const NotificationList: React.FC = () => {
  const { notifications, refreshNotifications, stats } = useNotificationContext();
  const [filterType, setFilterType] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshNotifications();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredItems = notifications.filter((n) => {
    if (filterType === 'all') return true;
    return n.type === filterType;
  });

  const getTypeBadge = (type: NotificationType) => {
    const style = TYPE_BADGE_STYLES[type] || TYPE_BADGE_STYLES.app_alert;
    const label = TYPE_LABELS[type] || 'ALERT';
    return (
      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${style}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="p-5 rounded-lg bg-white border border-[#e0e0e0] shadow-sm">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div>
          <h2 className="text-sm font-bold text-[#1b1b1b]">
            Notification Audit History
          </h2>
          <p className="text-xs text-[#8a8a8a]">Total stored: {notifications.length}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#f7f7f7] border border-[#e0e0e0] text-xs">
            <FunnelSolid className="w-3 h-3 text-[#8a8a8a]" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-[#3b4151] focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">All Categories</option>
              <option value="app_alert">App Alert</option>
              <option value="push">Push</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="p-2 rounded-md bg-[#f7f7f7] hover:bg-[#eeeeee] border border-[#e0e0e0] text-[#6b7280] transition-colors"
            title="Refresh History"
          >
            <RefreshSolid className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#4990e2]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {METRIC_ITEMS.map((m) => (
          <div key={m.key} className="p-3 rounded-md bg-[#fafafa] border border-[#e8e8e8]">
            <div className="text-[10px] uppercase font-bold text-[#8a8a8a]">{m.label}</div>
            <div className={`text-lg font-bold ${m.color}`}>
              {stats[m.key as keyof typeof stats] || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Feed List */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="p-10 text-center text-[#8a8a8a] text-xs">
            No notifications matched current filter
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-md bg-[#fafafa] border border-[#e8e8e8] hover:border-[#4990e2] transition-colors flex items-start gap-3"
            >
              <div className="shrink-0 mt-0.5">
                {getTypeBadge(item.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap justify-between items-baseline mb-1 gap-2">
                  <h4 className="text-xs font-bold text-[#1b1b1b]">{item.title}</h4>
                  <span className="text-[10px] text-[#8a8a8a] font-mono">
                    {new Date(item.created_at || Date.now()).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-[#6b7280] mb-2">{item.body}</p>

                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-[#f7f7f7] text-[#6b7280] border border-[#e0e0e0] font-mono">
                    ID: {item.id}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#f7f7f7] text-[#3b4151] border border-[#e0e0e0]">
                    Target: {item.target?.type || 'all'}
                    {item.target?.ids?.length ? ` (${item.target.ids.join(', ')})` : ''}
                  </span>
                  <span className={`font-semibold ${STATUS_STYLES[item.status] || 'text-[#49cc90]'}`}>
                    ● {item.status}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
