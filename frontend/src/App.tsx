import React, { useState } from 'react';
import { NotificationProvider, useNotificationContext } from './context/NotificationContext';
import { NotificationBell } from './components/NotificationBell';
import { ToastContainer } from './components/ToastContainer';
import { MultiClientSandbox } from './components/MultiClientSandbox';
import { BroadcastForm } from './components/BroadcastForm';
import { NotificationList } from './components/NotificationList';

type TabKey = 'sandbox' | 'dispatch' | 'history';

const TAB_ITEMS: { key: TabKey; label: string }[] = [
  { key: 'sandbox', label: 'Multi-Client Sandbox' },
  { key: 'dispatch', label: 'Dispatch API' },
  { key: 'history', label: 'Audit History' },
];

const DashboardContent: React.FC = () => {
  const { wsStatus, userId, setUserId } = useNotificationContext();
  const [activeTab, setActiveTab] = useState<TabKey>('sandbox');

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ===== Navbar Header ===== */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#e0e0e0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#4990e2] flex items-center justify-center">
              <span className="text-white font-extrabold text-sm leading-none">GN</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#1b1b1b] tracking-tight leading-tight">
                GONotification Engine
              </h1>
              <p className="text-[10px] text-[#8a8a8a] font-mono leading-tight">
                v2.0 • Go + NATS JetStream + WS
              </p>
            </div>
          </div>

          {/* Center Nav Tabs */}
          <nav className="hidden md:flex items-center gap-0.5 p-1 rounded-md bg-[#f7f7f7] border border-[#e8e8e8]">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#4990e2] text-white shadow-sm'
                    : 'text-[#6b7280] hover:text-[#3b4151] hover:bg-[#eeeeee]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right User Bar & Bell */}
          <div className="flex items-center gap-3">
            {/* User ID Selector */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#f7f7f7] border border-[#e0e0e0] text-xs">
              <span className="text-[10px] text-[#8a8a8a] font-semibold uppercase">User:</span>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-24 bg-transparent text-[#3b4151] font-mono text-xs focus:outline-none"
              />
            </div>

            {/* WS Status Indicator */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold uppercase">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsStatus === 'CONNECTED'
                    ? 'bg-[#49cc90]'
                    : wsStatus === 'CONNECTING' || wsStatus === 'RECONNECTING'
                    ? 'bg-[#fca130] animate-pulse'
                    : 'bg-[#f93e3e]'
                }`}
              />
              <span className="text-[#8a8a8a] hidden lg:inline">{wsStatus}</span>
            </div>

            {/* Notification Bell */}
            <NotificationBell />
          </div>
        </div>

        {/* Mobile Nav Bar */}
        <div className="md:hidden flex justify-around border-t border-[#e8e8e8] py-2 bg-white">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-xs font-semibold px-3 py-1 rounded ${
                activeTab === tab.key
                  ? 'bg-[#4990e2] text-white'
                  : 'text-[#6b7280]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ===== Main Container ===== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'sandbox' && <MultiClientSandbox />}
        {activeTab === 'dispatch' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <BroadcastForm />
            </div>
            <div className="lg:col-span-2">
              <NotificationList />
            </div>
          </div>
        )}
        {activeTab === 'history' && <NotificationList />}
      </main>

      {/* ===== Footer ===== */}
      <footer className="border-t border-[#e0e0e0] bg-[#fafafa] py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#8a8a8a]">
          <div className="flex items-center gap-4">
            <span className="font-medium">Go 1.22 Server</span>
            <span className="text-[#d1d5db]">•</span>
            <span className="font-medium">NATS JetStream Broker</span>
            <span className="text-[#d1d5db]">•</span>
            <span className="font-medium">PostgreSQL 16</span>
          </div>
          <p>© 2026 GONotification Engine • Real-Time WebSocket Tier</p>
        </div>
      </footer>

      {/* Toast Alert Popups */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <NotificationProvider>
      <DashboardContent />
    </NotificationProvider>
  );
}
