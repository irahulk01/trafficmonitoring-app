'use client';

import React, { useState } from 'react';
import { usePWA } from '@/lib/pwa-context';

export function PwaControls() {
  const {
    isStandalone,
    isWakeLockActive,
    toggleWakeLock,
  } = usePWA();

  return (
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

      {/* Standalone Active Badge */}
      {isStandalone && (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>PWA App</span>
        </div>
      )}
    </div>
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
