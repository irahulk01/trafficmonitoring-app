'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.href = '/';
      } else {
        setIsRetrying(false);
      }
    }, 1200);
  };

  return (
    <main className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-4 selection:bg-cyan-500/30">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 shadow-2xl text-center">
        {/* Radar offline icon badge */}
        <div className="mx-auto w-20 h-20 mb-6 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-center relative shadow-inner">
          <span className="text-4xl select-none">📡</span>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 ring-4 ring-slate-900 animate-pulse" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Offline Mode Active
        </h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          You are currently disconnected from the live traffic network. Cached route telemetry and recent maps are stored locally on your device.
        </p>

        {/* Network status card */}
        <div className="rounded-xl bg-slate-950/60 border border-slate-800/70 p-4 mb-6 text-left">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-slate-400">CONNECTIVITY STATUS</span>
            <span className={`px-2 py-0.5 rounded-full font-semibold ${
              isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {isOnline ? 'ONLINE (READY)' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {isOnline 
              ? 'Network detected! You can now resume live telemetry stream.' 
              : 'Waiting for internet connection. The app will automatically restore live updates once connected.'}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition shadow-lg shadow-cyan-500/20 disabled:opacity-60 cursor-pointer"
          >
            {isRetrying ? (
              <>
                <svg className="animate-spin h-4 w-4 text-slate-950" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Checking...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry Connection
              </>
            )}
          </button>

          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 font-medium text-sm transition border border-slate-700/50"
          >
            Return to App
          </Link>
        </div>
      </div>
    </main>
  );
}
