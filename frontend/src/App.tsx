import React, { useState } from 'react';
import { NotificationProvider, useNotificationContext } from './context/NotificationContext';
import { NotificationBell } from './components/NotificationBell';
import { ToastContainer } from './components/ToastContainer';
import { MultiClientSandbox } from './components/MultiClientSandbox';
import { BroadcastForm } from './components/BroadcastForm';
import { NotificationList } from './components/NotificationList';
import { Radio, Send, History, Cpu, Zap, Database, Server, CheckCircle2 } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { wsStatus, userId, setUserId } = useNotificationContext();
  const [activeTab, setActiveTab] = useState<'sandbox' | 'dispatch' | 'history'>('sandbox');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 tracking-tight">
                GONotification_Engine
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">v2.0 • Go + NATS JetStream + WS</p>
            </div>
          </div>

          {/* Center Nav Tabs */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
            <button
              onClick={() => setActiveTab('sandbox')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'sandbox'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Multi-Client Sandbox
            </button>

            <button
              onClick={() => setActiveTab('dispatch')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'dispatch'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Dispatch API Form
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Audit History
            </button>
          </nav>

          {/* Right User Bar & Bell */}
          <div className="flex items-center gap-3">
            {/* User ID Selector */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <span className="text-[10px] text-slate-500 font-mono">User:</span>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-24 bg-transparent text-slate-200 font-mono text-xs focus:outline-none"
              />
            </div>

            {/* Notification Bell Popover */}
            <NotificationBell />
          </div>
        </div>

        {/* Mobile Nav Bar */}
        <div className="md:hidden flex justify-around border-t border-slate-800/60 py-2 bg-slate-950">
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`text-xs font-medium px-3 py-1 rounded-lg ${
              activeTab === 'sandbox' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Sandbox
          </button>
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`text-xs font-medium px-3 py-1 rounded-lg ${
              activeTab === 'dispatch' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Dispatch
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`text-xs font-medium px-3 py-1 rounded-lg ${
              activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            History
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

      {/* System Specs Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" /> Go 1.22 Server
            </span>
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-400" /> NATS JetStream Broker
            </span>
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" /> PostgreSQL 16
            </span>
          </div>

          <p>© 2026 GONotification_Engine • Real-Time Multi-Node WebSocket Tier</p>
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
