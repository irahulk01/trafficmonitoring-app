'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTrafficStore, FilterType } from '@/lib/store';
import { LiveSegmentData, TrafficIncident } from '@/lib/mappls';
import PwaHeaderBanner, { PwaControls } from '@/app/components/PwaHeaderBanner';

// Dynamically imported to keep the heavy MapLibre / TomTom Maps SDK GL bundle
// out of the initial JS payload. The map is only instantiated when hydrated in browser.
const TrafficMap = dynamic(() => import('@/app/components/TrafficMap'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-[340px] sm:h-[440px] md:h-[520px] lg:h-[580px] rounded-2xl border border-slate-800/80 bg-slate-900/50 flex items-center justify-center"
    >
      <div className="text-center p-6">
        <div className="text-3xl sm:text-4xl mb-3 animate-pulse">🗺️</div>
        <p className="text-slate-400 text-xs sm:text-sm font-medium">Loading live traffic map…</p>
      </div>
    </div>
  ),
});

export default function TrafficDashboard() {
  const {
    segments,
    incidents,
    connectionStatus,
    lastUpdated,
    filter,
    selectedSegmentId,
    setSegments,
    setIncidents,
    setConnectionStatus,
    setLastUpdated,
    setSelectedSegmentId,
    setFilter,
  } = useTrafficStore();

  const [activeView, setActiveView] = useState<'overview' | 'map' | 'corridors'>('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [mounted, setMounted] = useState(false);
  const PAGE_SIZE = 10;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsFailCountRef = useRef(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fallback REST fetch to ensure instant render even before WebSocket handshake
  const fetchFallbackData = useCallback(async () => {
    try {
      const segRes = await fetch('/api/segments');
      if (segRes.ok) {
        const json = await segRes.json();
        if (json.data && json.data.length > 0) {
          setSegments(json.data);
          if (json.timestamp) setLastUpdated(json.timestamp);
          setConnectionStatus('connected');
        }
      }
    } catch (e) {
      console.warn('REST fallback fetch error:', e);
    }
  }, [setSegments, setLastUpdated, setConnectionStatus]);

  // Start polling fallback for serverless platforms like Vercel
  const startPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) return;
    setConnectionStatus('connected');
    pollingIntervalRef.current = setInterval(() => {
      fetchFallbackData();
    }, 10000);
  }, [fetchFallbackData, setConnectionStatus]);

  const connectWebSocket = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        wsFailCountRef.current = 0;
        setConnectionStatus('connected');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'TRAFFIC_UPDATE') {
            if (Array.isArray(message.data)) {
              setSegments(message.data);
            }
            if (Array.isArray(message.incidents)) {
              setIncidents(message.incidents);
            }
            if (message.timestamp) {
              setLastUpdated(message.timestamp);
            } else {
              setLastUpdated(new Date().toISOString());
            }
            setConnectionStatus('connected');
          }
        } catch (err) {
          console.error('Error parsing incoming WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          // If WebSockets fail repeatedly (e.g. running on Vercel Serverless), switch to auto-polling
          if (wsFailCountRef.current >= 2) {
            startPollingFallback();
          } else {
            setConnectionStatus('reconnecting');
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
          }
        }
      };

      ws.onerror = () => {
        wsFailCountRef.current += 1;
        if (wsFailCountRef.current >= 2) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          startPollingFallback();
        }
      };
    } catch {
      wsFailCountRef.current += 1;
      if (wsFailCountRef.current >= 2) {
        startPollingFallback();
      } else {
        setConnectionStatus('disconnected');
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      }
    }
  }, [setSegments, setIncidents, setLastUpdated, setConnectionStatus, startPollingFallback]);

  useEffect(() => {
    fetchFallbackData();
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };

    // iOS PWA Background Suspension Handler:
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connectWebSocket();
        }
      }
    };

    const handleWindowFocus = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }
    };

    const handleOnline = () => {
      connectWebSocket();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Helpers for human-centric formatting
  const formatDistance = (meters?: number): string => {
    if (!meters || meters <= 0) return '0 m';
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const formatTravelTime = (seconds?: number): string => {
    if (!seconds || seconds <= 0) return '--';
    if (seconds < 60) {
      return `${Math.round(seconds)} sec`;
    }
    const mins = Math.floor(seconds / 60);
    const remainingSecs = Math.round(seconds % 60);
    return remainingSecs > 0 ? `${mins}m ${remainingSecs}s` : `${mins} min`;
  };

  const getDelayImpact = (currentSec?: number, freeFlowSec?: number) => {
    if (!currentSec || !freeFlowSec) return { text: 'On Time', isDelayed: false, delaySec: 0 };
    const delaySec = Math.round(currentSec - freeFlowSec);
    if (delaySec <= 15) {
      return { text: 'On Time', isDelayed: false, delaySec: 0 };
    }
    if (delaySec < 60) {
      return { text: `+${delaySec}s delay`, isDelayed: true, delaySec };
    }
    const mins = Math.round(delaySec / 60);
    return { text: `+${mins} min delay`, isDelayed: true, delaySec };
  };

  // Dynamically sort segments so heavy traffic & bottlenecks float to the TOP
  const sortedSegments = [...segments].sort((a, b) => {
    // 1. Road closures float directly to top
    if (a.roadClosure !== b.roadClosure) return a.roadClosure ? -1 : 1;

    // 2. Traffic congestion priority score
    const getTrafficPriority = (s: LiveSegmentData) => {
      let score = 0;
      if (s.status === 'heavy') score += 1000;
      else if (s.status === 'moderate') score += 300;
      if (s.isDeveloping) score += 600;
      if (s.trend === 'worsening') score += 150;

      // Add travel delay in seconds
      const delay = Math.max(0, (s.currentTravelTime || 0) - (s.freeFlowTravelTime || 0));
      score += delay * 2;

      // Add speed slowdown penalty
      if (s.freeFlowSpeed > 0) {
        const slowdownRatio = Math.max(0, 1 - (s.currentSpeed / s.freeFlowSpeed));
        score += slowdownRatio * 400;
      }
      return score;
    };

    return getTrafficPriority(b) - getTrafficPriority(a);
  });

  const filteredSegments = sortedSegments.filter((s) => {
    if (filter === 'heavy') return s.status === 'heavy';
    if (filter === 'moderate') return s.status === 'moderate';
    if (filter === 'developing') return s.isDeveloping;
    return true;
  });

  // Pagination calculation (max 10 cards per page)
  const totalPages = Math.ceil(filteredSegments.length / PAGE_SIZE) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, filteredSegments.length);
  const paginatedSegments = filteredSegments.slice(startIndex, endIndex);

  const heavyCount = segments.filter((s) => s.status === 'heavy').length;
  const moderateCount = segments.filter((s) => s.status === 'moderate').length;
  const developingCount = segments.filter((s) => s.isDeveloping).length;
  const normalCount = segments.filter((s) => s.status === 'normal').length;
  const totalJamMeters = segments.reduce((acc, curr) => acc + (curr.jamLengthMeters || 0), 0);
  const networkEfficiency = segments.length > 0 ? Math.round((normalCount / segments.length) * 100) : 100;

  // Render individual corridor card (optimized for both side panel and wide view)
  const renderCorridorCard = (segment: LiveSegmentData, isSidePanel = false) => {
    const isSelected = selectedSegmentId === segment.id;
    const delayInfo = getDelayImpact(segment.currentTravelTime, segment.freeFlowTravelTime);

    // Flow efficiency percentage (actual speed vs free-flow speed)
    const flowEfficiency =
      segment.freeFlowSpeed > 0
        ? Math.min(100, Math.round((segment.currentSpeed / segment.freeFlowSpeed) * 100))
        : 100;

    const speedDrop = Math.max(0, segment.freeFlowSpeed - segment.currentSpeed);

    let badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    let badgeLabel = '🟢 Free Flow';
    let flowBarColor = 'bg-emerald-500';
    let cardBorder = 'border-slate-800/80 hover:border-slate-700 bg-slate-900/60';

    if (segment.status === 'heavy') {
      badgeStyle = 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/10';
      badgeLabel = '🔴 Heavy Jam';
      flowBarColor = 'bg-rose-500';
      cardBorder =
        'border-rose-900/50 hover:border-rose-700/70 bg-gradient-to-r from-rose-950/20 via-slate-900/80 to-slate-900/60 shadow-rose-950/20';
    } else if (segment.isDeveloping) {
      badgeStyle = 'bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse';
      badgeLabel = '⚡ Developing';
      flowBarColor = 'bg-amber-500';
      cardBorder =
        'border-amber-900/40 hover:border-amber-700/60 bg-gradient-to-r from-amber-950/15 via-slate-900/80 to-slate-900/60';
    } else if (segment.status === 'moderate') {
      badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      badgeLabel = '🟡 Slow Traffic';
      flowBarColor = 'bg-amber-500';
      cardBorder = 'border-amber-900/30 hover:border-amber-700/50 bg-slate-900/60';
    }

    return (
      <div
        key={segment.id}
        onClick={() => setSelectedSegmentId(isSelected ? null : segment.id)}
        className={`group relative rounded-xl p-2.5 sm:p-3 backdrop-blur-xl border transition-all duration-200 cursor-pointer shadow-md active:scale-[0.99] touch-manipulation ${cardBorder} ${
          isSelected ? 'ring-2 ring-cyan-500/50 border-cyan-500/60 shadow-cyan-950/30' : ''
        }`}
      >
        {/* Top Header: Corridor Name, Status Pill & Delay Badge */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <h2 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition truncate">
              {segment.name}
            </h2>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${badgeStyle}`}>
              {badgeLabel}
            </span>
            {segment.trend === 'worsening' && (
              <span className="text-[9px] font-medium text-rose-300 bg-rose-500/15 border border-rose-500/25 px-1 py-0.5 rounded flex items-center gap-0.5">
                <span>↗</span> Slowing
              </span>
            )}
            {segment.trend === 'improving' && (
              <span className="text-[9px] font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-1 py-0.5 rounded flex items-center gap-0.5">
                <span>↘</span> Clearing
              </span>
            )}
          </div>

          {/* Compact Delay Pill + Expansion Indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold font-mono border ${
                delayInfo.isDelayed
                  ? segment.status === 'heavy'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-950/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              {delayInfo.text}
            </span>
            <span className={`text-[10px] text-slate-500 transition-transform duration-200 ${isSelected ? 'rotate-180 text-cyan-400' : ''}`}>
              ▼
            </span>
          </div>
        </div>

        {/* Corridor Description (Subtle 1-line truncate) */}
        {segment.description && (
          <p className="text-[10px] text-slate-400 line-clamp-1 mb-1.5">
            {segment.description}
          </p>
        )}

        {/* Glanceable Inline Telemetry Strip: Speed, Time, Distance/Jam, Flow */}
        <div className="grid grid-cols-4 gap-1.5 py-1.5 px-2 rounded-lg bg-slate-950/70 border border-slate-800/80 font-mono text-center items-center">
          {/* 1. Speed */}
          <div className="min-w-0">
            <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold tracking-wider truncate">
              Speed
            </div>
            <div className="text-xs sm:text-sm font-bold text-white flex items-center justify-center gap-0.5 truncate">
              <span>{segment.currentSpeed}</span>
              <span className="text-[9px] text-slate-400 font-normal">kph</span>
              {speedDrop > 3 && (
                <span className="text-[9px] text-amber-400 font-normal">(-{speedDrop})</span>
              )}
            </div>
          </div>

          {/* 2. Travel Time */}
          <div className="min-w-0 border-l border-slate-800/80 pl-1">
            <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold tracking-wider truncate">
              Est. Time
            </div>
            <div className="text-xs sm:text-sm font-bold text-white truncate">
              {formatTravelTime(segment.currentTravelTime)}
            </div>
          </div>

          {/* 3. Distance or Queue */}
          <div className="min-w-0 border-l border-slate-800/80 pl-1">
            <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold tracking-wider truncate">
              {segment.jamLengthMeters > 0 ? 'Queue' : 'Distance'}
            </div>
            <div
              className={`text-xs sm:text-sm font-bold truncate ${
                segment.jamLengthMeters > 0 ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {segment.jamLengthMeters > 0
                ? formatDistance(segment.jamLengthMeters)
                : formatDistance(segment.segmentLengthMeters)}
            </div>
          </div>

          {/* 4. Flow % */}
          <div className="min-w-0 border-l border-slate-800/80 pl-1">
            <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold tracking-wider truncate">
              Flow
            </div>
            <div className="text-xs sm:text-sm font-bold flex items-center justify-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  flowEfficiency >= 85
                    ? 'bg-emerald-400'
                    : flowEfficiency >= 50
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
              />
              <span className="text-white">{flowEfficiency}%</span>
            </div>
          </div>
        </div>

        {/* Micro Flow Indicator Bar */}
        <div className="h-1 w-full bg-slate-950/80 rounded-full overflow-hidden mt-1.5 border border-slate-800/50">
          <div
            className={`h-full rounded-full transition-all duration-300 ${flowBarColor}`}
            style={{ width: `${Math.max(5, flowEfficiency)}%` }}
          />
        </div>

        {/* Extended Details (Smooth click drawer) */}
        {isSelected && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-950/80 -mx-2.5 sm:-mx-3 -mb-2.5 sm:-mb-3 p-2.5 sm:p-3 rounded-b-xl border-b border-cyan-500/20">
            <div>
              <span className="text-slate-500 font-medium text-[9px] uppercase tracking-wider block">Delay Impact</span>
              <p className={`font-mono text-xs font-semibold ${delayInfo.isDelayed ? 'text-amber-400' : 'text-emerald-400'}`}>
                {delayInfo.text}
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-medium text-[9px] uppercase tracking-wider block">Optimal Baseline</span>
              <p className="font-mono text-xs text-slate-300">
                {formatTravelTime(segment.freeFlowTravelTime)} ({segment.freeFlowSpeed} km/h)
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-medium text-[9px] uppercase tracking-wider block">Coordinates</span>
              <p className="font-mono text-[11px] text-cyan-400">
                {segment.lat.toFixed(4)}, {segment.lon.toFixed(4)}
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-medium text-[9px] uppercase tracking-wider block">Telemetry Sync</span>
              <p suppressHydrationWarning className="font-mono text-[11px] text-slate-400">
                {new Date(segment.lastUpdated).toLocaleTimeString()}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Reusable pagination footer
  const renderPaginationControls = () => {
    if (filteredSegments.length <= PAGE_SIZE) return null;
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2.5 p-3 sm:p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
        <div className="text-[11px] sm:text-xs text-slate-400 font-mono text-center sm:text-left">
          Showing <strong className="text-white">{startIndex + 1}</strong> – <strong className="text-white">{endIndex}</strong> of{' '}
          <strong className="text-white">{filteredSegments.length}</strong>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safeCurrentPage === 1}
            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold disabled:opacity-35 disabled:cursor-not-allowed transition border border-slate-700/60 cursor-pointer touch-manipulation"
          >
            ← Prev
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-xs font-bold transition cursor-pointer touch-manipulation flex items-center justify-center ${
                  safeCurrentPage === pageNum
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800/70 hover:bg-slate-700 text-slate-300 border border-slate-700/50'
                }`}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage === totalPages}
            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold disabled:opacity-35 disabled:cursor-not-allowed transition border border-slate-700/60 cursor-pointer touch-manipulation"
          >
            Next →
          </button>
        </div>
      </div>
    );
  };

  // Reusable compact KPI cards (placed below the map)
  const renderKpiCards = () => (
    <section className="grid grid-cols-3 gap-2 sm:gap-3">
      {/* Card 1: Network Flow */}
      <div className="p-2 sm:p-2.5 rounded-xl bg-slate-900/70 backdrop-blur-md border border-slate-800/80 flex flex-col justify-between">
        <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span className="truncate">Flow</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0 ml-1" />
        </div>
        <div className="text-base sm:text-xl font-bold font-mono text-white my-0.5">
          {networkEfficiency}%
        </div>
        <div className="text-[10px] text-slate-400 truncate">
          {normalCount}/{segments.length} optimal
        </div>
      </div>

      {/* Card 2: Active Bottlenecks */}
      <div className="p-2 sm:p-2.5 rounded-xl bg-slate-900/70 backdrop-blur-md border border-slate-800/80 flex flex-col justify-between">
        <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span className="truncate">Bottlenecks</span>
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1 ${
              heavyCount + developingCount > 0 ? 'bg-rose-400 animate-ping' : 'bg-slate-600'
            }`}
          />
        </div>
        <div
          className={`text-base sm:text-xl font-bold font-mono my-0.5 ${
            heavyCount + developingCount > 0 ? 'text-rose-400' : 'text-slate-200'
          }`}
        >
          {heavyCount + developingCount}
        </div>
        <div className="text-[10px] text-slate-400 truncate">
          {heavyCount} heavy &bull; {developingCount} forming
        </div>
      </div>

      {/* Card 3: Total Jam Queue */}
      <div className="p-2 sm:p-2.5 rounded-xl bg-slate-900/70 backdrop-blur-md border border-slate-800/80 flex flex-col justify-between">
        <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span className="truncate">Total Queue</span>
          <span className="text-[10px] ml-1">🚗</span>
        </div>
        <div className="text-base sm:text-xl font-bold font-mono text-white my-0.5">
          {totalJamMeters > 0 ? formatDistance(totalJamMeters) : '0 m'}
        </div>
        <div className="text-[10px] text-slate-400 truncate">
          {totalJamMeters > 0 ? 'Active jam' : 'Clear roads'}
        </div>
      </div>
    </section>
  );

  // Reusable View Switcher Tabs
  const renderViewSwitcherTabs = () => (
    <div className="flex items-center justify-between gap-2 p-1 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setActiveView('overview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap touch-manipulation ${
            activeView === 'overview'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>⚡</span>
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveView('map')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap touch-manipulation ${
            activeView === 'map'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🗺️</span>
          <span>Full Map</span>
        </button>

        <button
          onClick={() => setActiveView('corridors')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap touch-manipulation ${
            activeView === 'corridors'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🚗</span>
          <span>Corridors ({segments.length})</span>
        </button>
      </div>

      <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-mono pr-2">
        <span>Hazaribagh Telemetry Hub</span>
      </div>
    </div>
  );

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[#070b14] text-slate-100 selection:bg-cyan-500/30">
      {/* PWA Alerts, Update Notification & Offline Banner */}
      <PwaHeaderBanner />

      {/* Dynamic Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>

      <div suppressHydrationWarning className="relative max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-7 py-3 sm:py-4 space-y-3 sm:space-y-4">
        {/* Navigation & Header */}
        <header suppressHydrationWarning className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black text-base sm:text-lg shrink-0">
              🚦
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Live Traffic Monitor
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                Hazaribagh Telemetry & Incident Intelligence
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="relative flex h-2 w-2">
                {connectionStatus === 'connected' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-500'
                      : connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
              </span>
              <span className="font-medium capitalize text-slate-300 text-xs">
                {connectionStatus === 'connected' ? 'Live' : connectionStatus}
              </span>
            </div>

            {/* Timestamp */}
            {lastUpdated && (
              <div
                suppressHydrationWarning
                className="text-[11px] text-slate-400 bg-slate-800/40 px-2.5 py-1 rounded-lg border border-slate-800 font-mono hidden xs:block"
              >
                {new Date(lastUpdated).toLocaleTimeString()}
              </div>
            )}

            {/* PWA Action Controls: Stay Awake, Install App */}
            <PwaControls />

            {/* Manual reconnect button */}
            <button
              onClick={() => connectWebSocket()}
              title="Force reconnect"
              className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 hover:text-white transition border border-slate-700/50 cursor-pointer active:scale-95 touch-manipulation"
            >
              🔄
            </button>
          </div>
        </header>

        {/* ─── 1. OVERVIEW: MAP ON TOP OF SCREEN, KPI & CORRIDORS BELOW ─── */}
        {activeView === 'overview' && (
          <div className="space-y-3 sm:space-y-4">
            {/* ─── TOP: LIVE TRAFFIC MAP ─── */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 sm:p-3 rounded-xl bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 shadow-lg">
                <div>
                  <h2 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5">
                    <span>🗺️</span>
                    <span>Live Traffic Map — Hazaribagh</span>
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                   Real-time Mappls vector flow tiles &bull; Click any marker or corridor card below to inspect telemetry
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px]">
                    {segments.length} Corridors
                  </span>
                  {totalJamMeters > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px]">
                      Jam: {totalJamMeters > 1000 ? `${(totalJamMeters / 1000).toFixed(1)} km` : `${totalJamMeters} m`}
                    </span>
                  )}
                </div>
              </div>

              {/* Map Container */}
              <TrafficMap
                segmentData={segments}
                selectedSegmentId={selectedSegmentId}
                onSelectSegment={setSelectedSegmentId}
                className="h-[360px] sm:h-[460px] md:h-[500px] lg:h-[540px] rounded-2xl"
              />
            </div>

            {/* ─── BELOW THE MAP: VIEW SWITCHER TABS ─── */}
            {renderViewSwitcherTabs()}

            {/* ─── BELOW THE MAP: EXECUTIVE KPI OVERVIEW CARDS ─── */}
            {renderKpiCards()}

            {/* ─── BOTTOM: MONITORED CORRIDORS (Filters, Cards, Pagination) ─── */}
            <div className="space-y-3.5">
              {/* Filter Pills and Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 p-3.5 sm:p-4 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 shadow-lg">
                <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-xl overflow-x-auto no-scrollbar w-full sm:w-auto touch-pan-x">
                  {(
                    [
                      { id: 'all', label: `All (${segments.length})` },
                      { id: 'developing', label: `Developing (${developingCount})` },
                      { id: 'heavy', label: `Heavy (${heavyCount})` },
                      { id: 'moderate', label: `Moderate (${moderateCount})` },
                    ] as { id: FilterType; label: string }[]
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setFilter(item.id);
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap cursor-pointer touch-manipulation ${
                        filter === item.id
                          ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto text-[11px] sm:text-xs text-slate-400 font-mono">
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                    Page {safeCurrentPage} of {totalPages}
                  </span>
                  <span>📋 {filteredSegments.length} Corridors</span>
                </div>
              </div>

              {/* Paginated Cards Grid: 2 columns on desktop/tablet, 1 column on mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {filteredSegments.length === 0 ? (
                  <div className="col-span-full text-center py-12 rounded-2xl border border-slate-800 bg-slate-900/30">
                    <div className="text-2xl mb-1.5">📡</div>
                    <p className="text-slate-400 text-xs">
                      {connectionStatus === 'connecting'
                        ? 'Connecting to telemetry stream...'
                        : 'No segments matching filter criteria.'}
                    </p>
                  </div>
                ) : (
                  paginatedSegments.map((segment) => renderCorridorCard(segment, false))
                )}
              </div>

              {/* Pagination Controls */}
              {renderPaginationControls()}
            </div>
          </div>
        )}

        {/* ─── 2. FULL MAP VIEW ─── */}
        {activeView === 'map' && (
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-4 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 shadow-lg">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-white">Full-Screen Traffic Map — Hazaribagh</h2>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  Real-time vector flow tiles + monitored corridor markers · Click any marker for telemetry
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px]">
                  {segments.length} Monitored Corridors
                </span>
                {totalJamMeters > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px]">
                    Jam: {totalJamMeters > 1000 ? `${(totalJamMeters / 1000).toFixed(1)} km` : `${totalJamMeters} m`}
                  </span>
                )}
              </div>
            </div>

            <TrafficMap
              segmentData={segments}
              selectedSegmentId={selectedSegmentId}
              onSelectSegment={setSelectedSegmentId}
              className="h-[calc(100vh-220px)] min-h-[520px]"
            />

            {/* Below the map: View Switcher Tabs */}
            {renderViewSwitcherTabs()}
          </section>
        )}

        {/* ─── 3. CORRIDORS VIEW ─── */}
        {activeView === 'corridors' && (
          <section className="space-y-3 sm:space-y-4">
            {renderViewSwitcherTabs()}
            {renderKpiCards()}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 shadow-lg">
              <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-xl overflow-x-auto no-scrollbar w-full sm:w-auto touch-pan-x">
                {(
                  [
                    { id: 'all', label: `All (${segments.length})` },
                    { id: 'developing', label: `Developing (${developingCount})` },
                    { id: 'heavy', label: `Heavy (${heavyCount})` },
                    { id: 'moderate', label: `Moderate (${moderateCount})` },
                  ] as { id: FilterType; label: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setFilter(item.id);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap cursor-pointer touch-manipulation ${
                      filter === item.id
                        ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="text-[11px] sm:text-xs text-slate-400 font-mono self-start sm:self-auto">
                📋 {filteredSegments.length} Corridors (Sorted by Congestion Priority)
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredSegments.length === 0 ? (
                <div className="col-span-full text-center py-14 rounded-2xl border border-slate-800 bg-slate-900/30">
                  <p className="text-slate-400 text-xs sm:text-sm">
                    No segments matching filter criteria.
                  </p>
                </div>
              ) : (
                paginatedSegments.map((segment) => renderCorridorCard(segment, false))
              )}
            </div>

            {renderPaginationControls()}
          </section>
        )}

        {/* Footer info */}
        <footer className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 text-center sm:text-left">
          <p>
            Continuous polling: <span className="text-slate-400">Traffic Flow Engine</span> &bull; Key server-side only
          </p>
        </footer>
      </div>
    </div>
  );
}
