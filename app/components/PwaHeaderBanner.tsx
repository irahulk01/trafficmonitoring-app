'use client';

import React, { useState } from 'react';
import { usePWA } from '@/lib/pwa-context';

export function PwaControls() {
  const {
    isStandalone,
    isInstallable,
    isIOS,
    isWakeLockActive,
    promptInstall,
    toggleWakeLock,
  } = usePWA();

  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showInstallSuccess, setShowInstallSuccess] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const installed = await promptInstall();
      if (installed) {
        setShowInstallSuccess(true);
        setTimeout(() => setShowInstallSuccess(false), 4000);
      }
    } else if (isIOS && !isStandalone) {
      setShowIosGuide(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Wake Lock Button (Keep Screen Awake during driving/monitoring) */}
        <button
          onClick={toggleWakeLock}
          title={
            isWakeLockActive
              ? "Screen Wake Lock is active (Screen won't sleep)"
              : 'Keep screen awake while monitoring'
          }
          className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition border cursor-pointer ${
            isWakeLockActive
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
              : 'bg-slate-800/60 text-slate-300 border-slate-700/60 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span className={`text-xs ${isWakeLockActive ? 'animate-pulse' : ''}`}>
            {isWakeLockActive ? '🔆' : '🌙'}
          </span>
          <span className="hidden sm:inline">
            {isWakeLockActive ? 'Awake Active' : 'Keep Awake'}
          </span>
        </button>

        {/* PWA Install Button */}
        {(isInstallable || (isIOS && !isStandalone)) && (
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Install App</span>
          </button>
        )}

        {/* Standalone Active Badge */}
        {isStandalone && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>PWA App</span>
          </div>
        )}
      </div>

      {/* iOS Install Instructions Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative text-slate-200 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowIosGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
            >
              ✕
            </button>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center mb-4">
              <span className="text-2xl">📱</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Install on iOS Safari</h3>
            <p className="text-xs text-slate-400 mb-4">
              Install TrafficFlow on your home screen for full-screen view and quick access:
            </p>
            <ol className="text-xs space-y-3 text-slate-300 font-medium">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <span>Tap the <strong className="text-cyan-300">Share</strong> button in Safari toolbar.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span>Scroll down and tap <strong className="text-cyan-300">"Add to Home Screen"</strong> ➕</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <span>Tap <strong className="text-cyan-300">Add</strong> in top right.</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIosGuide(false)}
              className="mt-6 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Install Success Toast */}
      {showInstallSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 px-4 py-3 rounded-xl shadow-2xl font-semibold text-xs flex items-center gap-2 animate-bounce">
          <span>🎉</span>
          <span>TrafficFlow installed to your device!</span>
        </div>
      )}
    </>
  );
}

export default function PwaHeaderBanner() {
  const { isOnline, updateAvailable, applyUpdate } = usePWA();

  return (
    <>
      {/* 1. Offline Indicator Bar */}
      {!isOnline && (
        <div className="w-full bg-gradient-to-r from-amber-600/90 via-rose-600/90 to-amber-600/90 text-white text-xs font-semibold py-2 px-4 flex items-center justify-center gap-2 shadow-lg backdrop-blur-md sticky top-0 z-50">
          <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-2.828-6.364m0 0a9 9 0 012.828-6.364m0 0l2.829 2.829M3 3l18 18" />
          </svg>
          <span>Offline Mode Active — Displaying cached traffic telemetry & map data</span>
        </div>
      )}

      {/* 2. New Version Available Toast */}
      {updateAvailable && (
        <div className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-medium py-2.5 px-4 flex items-center justify-between shadow-xl backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-200 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
            <span>A new version of TrafficFlow is available!</span>
          </div>
          <button
            onClick={applyUpdate}
            className="px-3 py-1 bg-slate-950/80 hover:bg-slate-950 text-cyan-300 rounded-lg font-semibold text-xs tracking-wide transition border border-cyan-400/40 cursor-pointer"
          >
            Reload & Update
          </button>
        </div>
      )}
    </>
  );
}
