import React, { useState } from 'react';
import { useNotificationContext } from '../context/NotificationContext';
import type { NotificationType } from '../types';
import { Mail, MessageSquare, Smartphone, Zap, RefreshCw, Filter } from 'lucide-react';

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

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4 text-blue-400" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4 text-emerald-400" />;
      case 'push':
        return <Smartphone className="w-4 h-4 text-purple-400" />;
      default:
        return <Zap className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-xl">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            Notification Audit History
          </h2>
          <p className="text-xs text-slate-400">Total stored: {notifications.length}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
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
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh History"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="text-[10px] uppercase font-bold text-slate-500">Pending</div>
          <div className="text-lg font-bold text-amber-400">{stats.pending || 0}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="text-[10px] uppercase font-bold text-slate-500">Sending</div>
          <div className="text-lg font-bold text-blue-400">{stats.sending || 0}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="text-[10px] uppercase font-bold text-slate-500">Completed</div>
          <div className="text-lg font-bold text-emerald-400">{stats.completed || 0}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="text-[10px] uppercase font-bold text-slate-500">Failed</div>
          <div className="text-lg font-bold text-rose-400">{stats.failed || 0}</div>
        </div>
      </div>

      {/* Feed List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">
            No notifications matched current filter
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-indigo-500/30 transition-all flex items-start gap-4"
            >
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                {getTypeIcon(item.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap justify-between items-baseline mb-1 gap-2">
                  <h4 className="text-xs font-bold text-slate-200">{item.title}</h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(item.created_at || Date.now()).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-2">{item.body}</p>

                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                    ID: {item.id}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                    Target: {item.target?.type || 'all'}
                    {item.target?.ids?.length ? ` (${item.target.ids.join(', ')})` : ''}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                    Status: {item.status}
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
