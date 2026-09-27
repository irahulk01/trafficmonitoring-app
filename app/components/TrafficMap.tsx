'use client';

/**
 * TrafficMap.tsx
 *
 * Renders a live TomTom map centered on Hazaribagh using @tomtom-org/maps-sdk/map.
 *
 * What this component does:
 *  1. Initialises a TomTomMap (MapLibre GL JS under the hood) on first mount.
 *  2. Loads TrafficFlowModule  → vector-tile traffic-flow colour layer from TomTom.
 *  3. Loads TrafficIncidentsModule → vector-tile incident icons from TomTom.
 *  4. Adds a MapLibre Marker + Popup for every entry in monitoredSegments,
 *     colour-coded by the live severity data the parent feeds in via segmentData.
 *  5. Re-colours / updates popups whenever segmentData changes (WebSocket push).
 *
 * Public-preview SDK flags
 * ────────────────────────
 * • TomTomMap requires apiKey in the constructor (via GlobalConfig partial).
 *   It is passed as NEXT_PUBLIC_TOMTOM_MAP_KEY — a *separate*, scope-restricted
 *   key that is intentionally browser-visible (see .env.example for why).
 * • TrafficFlowModule.get() and TrafficIncidentsModule.get() are static
 *   async factory methods; both modules bind to the vector-tile sources already
 *   baked into the standard style so no extra tile URL configuration is needed.
 * • The SDK is ESM-only; this file is a Client Component so Next.js bundles it
 *   for the browser without the serverExternalPackages exclusion interfering.
 */

import { useEffect, useRef, useCallback } from 'react';
import { monitoredSegments } from '@/lib/segments';
import type { LiveSegmentData } from '@/lib/tomtom';

// NOTE: maplibre-gl is NOT imported at the top level.
// maplibre-gl uses new URL('./worker', import.meta.url) which Turbopack
// cannot resolve from node_modules. Instead, Marker/Popup are destructured
// inside the async dynamic-import block at runtime (browser only).
// The maplibre CSS is injected via a <link> tag, also at runtime.

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  /** Live segment telemetry streamed from the WebSocket; may be empty initially. */
  segmentData: LiveSegmentData[];
  /** Currently selected corridor segment ID for auto-focus/highlight */
  selectedSegmentId?: string | null;
  /** Callback when user clicks on a map marker */
  onSelectSegment?: (id: string | null) => void;
  /** Optional custom container CSS classes */
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MarkerEntry = { el: HTMLDivElement; popup: any; segId: string };

// Injects the MapLibre CSS stylesheet once (idempotent).
function injectMaplibreCSS() {
  const id = 'maplibre-gl-css';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = '/maplibre-gl.css';
  document.head.appendChild(link);
}

// ─── Severity colour helpers ─────────────────────────────────────────────────

function severityColor(segId: string, data: LiveSegmentData[]): string {
  const seg = data.find((s) => s.id === segId);
  if (!seg) return '#64748b'; // slate – no data yet
  if (seg.status === 'heavy') return '#ef4444';
  if (seg.status === 'moderate') return '#f59e0b';
  return '#22c55e';
}

function buildMarkerEl(color: string): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'custom-map-marker';
  container.style.cssText = 'width:26px;height:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;';

  const dot = document.createElement('div');
  dot.className = 'marker-dot';
  dot.style.cssText = [
    'width:18px',
    'height:18px',
    'border-radius:50%',
    `background:${color}`,
    'border:3px solid rgba(255,255,255,0.92)',
    `box-shadow:0 0 0 2px ${color}66,0 2px 8px rgba(0,0,0,0.5)`,
    'transition:transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),box-shadow 0.2s ease',
    'transform-origin:center center',
  ].join(';');

  container.appendChild(dot);

  container.addEventListener('mouseenter', () => {
    dot.style.transform = 'scale(1.35)';
    dot.style.boxShadow = `0 0 0 4px ${color}88,0 4px 14px rgba(0,0,0,0.65)`;
  });

  container.addEventListener('mouseleave', () => {
    dot.style.transform = 'scale(1)';
    dot.style.boxShadow = `0 0 0 2px ${color}66,0 2px 8px rgba(0,0,0,0.5)`;
  });

  return container;
}

function buildPopupHTML(segId: string, data: LiveSegmentData[]): string {
  const live = data.find((s) => s.id === segId);
  const def = monitoredSegments.find((s) => s.id === segId)!;

  const statusLabel =
    live?.status === 'heavy'
      ? '🔴 Heavy Jam'
      : live?.isDeveloping
      ? '⚡ Jam Forming'
      : live?.status === 'moderate'
      ? '🟡 Slow Traffic'
      : live
      ? '🟢 Free Flow'
      : 'Awaiting data';

  const delaySec = live ? Math.max(0, (live.currentTravelTime || 0) - (live.freeFlowTravelTime || 0)) : 0;
  const delayText = delaySec > 45 ? `+${Math.round(delaySec / 60)} min delay` : delaySec > 15 ? `+${delaySec}s delay` : 'On Time';

  const rows = live
    ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:11px">
        <span style="color:#94a3b8">Speed:</span>
        <strong style="color:#f8fafc;font-family:monospace">${live.currentSpeed} km/h <span style="font-size:10px;color:#64748b;font-weight:normal">(opt ${live.freeFlowSpeed})</span></strong>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:11px">
        <span style="color:#94a3b8">Delay:</span>
        <strong style="color:${delaySec > 30 ? '#fbbf24' : '#34d399'};font-family:monospace">${delayText}</strong>
      </div>
      ${live.jamLengthMeters > 0 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:11px">
        <span style="color:#f87171">Queue:</span>
        <strong style="color:#f87171;font-family:monospace">${live.jamLengthMeters >= 1000 ? (live.jamLengthMeters/1000).toFixed(1) + ' km' : live.jamLengthMeters + ' m'}</strong>
      </div>` : ''}
    `
    : '<div style="color:#94a3b8;font-style:italic;font-size:11px;padding:4px 0">Awaiting live telemetry…</div>';

  return `
    <div style="min-width:200px;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif">
      <div style="font-weight:700;font-size:13px;color:#ffffff;margin-bottom:2px">${def.name}</div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:8px">${def.description ?? ''}</div>
      <div style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.04em;padding:2px 8px;border-radius:999px;margin-bottom:8px;background:rgba(30,41,59,0.9);border:1px solid rgba(71,85,105,0.7);color:#f1f5f9">
        ${statusLabel}
      </div>
      <div style="border-top:1px solid rgba(51,65,85,0.6);padding-top:6px">
        ${rows}
      </div>
    </div>
  `;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TrafficMap({
  segmentData,
  selectedSegmentId,
  onSelectSegment,
  className,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('@tomtom-org/maps-sdk/map').TomTomMap | null>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const initAttemptedRef = useRef(false);
  // Keep a stable ref to latest segmentData for the init closure
  const segmentDataRef = useRef<LiveSegmentData[]>(segmentData);
  segmentDataRef.current = segmentData;

  const onSelectSegmentRef = useRef(onSelectSegment);
  onSelectSegmentRef.current = onSelectSegment;

  // ── Initialise map (runs once after first mount) ─────────────────────────
  useEffect(() => {
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    const container = mapContainerRef.current;
    if (!container) return;

    const apiKey = process.env.NEXT_PUBLIC_TOMTOM_MAP_KEY;
    if (!apiKey) {
      console.error(
        '[TrafficMap] NEXT_PUBLIC_TOMTOM_MAP_KEY is not set.\n' +
          'Create a restricted TomTom API key scoped to Maps/Traffic-tile permissions only\n' +
          'and add it to .env as NEXT_PUBLIC_TOMTOM_MAP_KEY.\n' +
          'See .env.example — it explains why this must be a SEPARATE key from TOMTOM_API_KEY.'
      );
      return;
    }

    (async () => {
      try {
        // Inject MapLibre GL CSS at runtime (can't be a static import — see top comment)
        injectMaplibreCSS();

        // Dynamic import keeps the large SDK + maplibre-gl bundle browser-only.
        // We also destructure Marker and Popup here from maplibre-gl so they
        // are never touched by Turbopack's static analysis at module-graph time.
        const [{ TomTomMap, TrafficFlowModule }, maplibreGl] =
          await Promise.all([
            import('@tomtom-org/maps-sdk/map'),
            import('maplibre-gl'),
          ]);
        const { Marker, Popup } = maplibreGl;

        // Configure MapLibre web worker to prevent 404 in Next.js bundle
        if (typeof maplibreGl.setWorkerUrl === 'function') {
          maplibreGl.setWorkerUrl('/maplibre-gl-worker.mjs');
        } else if (maplibreGl.config) {
          maplibreGl.config.WORKER_URL = '/maplibre-gl-worker.mjs';
        }

        const map = new TomTomMap({
          apiKey,
          style: {
            type: 'standard',
            id: 'standardDark',
            include: ['trafficFlow'],
          },
          mapLibre: {
            container,
            center: [85.362, 23.996], // [lon, lat] – Hazaribagh town centre
            zoom: 13.5,
            minZoom: 12, // Prevents zooming out beyond Hazaribagh city area
            maxZoom: 18,
            maxBounds: [
              [85.25, 23.90], // Southwest bounds [lon, lat]
              [85.48, 24.08], // Northeast bounds [lon, lat]
            ],
          },
        });

        mapRef.current = map;

        // Poll mapReady instead of listening for a named event
        await new Promise<void>((resolve) => {
          if (map.mapReady) { resolve(); return; }
          const id = setInterval(() => { if (map.mapReady) { clearInterval(id); resolve(); } }, 80);
        });

        // Trigger mapLibre resize to ensure canvas matches container dimensions
        if (map.mapLibreMap) {
          map.mapLibreMap.resize();
        }

        // ── 2. Traffic Flow (colour-coded speed tiles) ───────────────────
        try {
          await TrafficFlowModule.get(map, { visible: true });
        } catch (e) {
          console.warn('[TrafficMap] TrafficFlowModule.get() failed (public-preview SDK):', e);
        }


        // ── 4. Monitored segment markers ─────────────────────────────────
        const mlMap = map.mapLibreMap;

        for (const seg of monitoredSegments) {
          const color = severityColor(seg.id, segmentDataRef.current);
          const el = buildMarkerEl(color);

          el.addEventListener('click', () => {
            onSelectSegmentRef.current?.(seg.id);
          });

          const popup = new Popup({
            closeButton: true,
            closeOnClick: false,
            offset: [0, -10],
            maxWidth: '280px',
          }).setHTML(buildPopupHTML(seg.id, segmentDataRef.current));

          const marker = new Marker({ element: el })
            .setLngLat([seg.lon, seg.lat])
            .setPopup(popup)
            .addTo(mlMap);

          // Patch popup background when it opens
          marker.getPopup().on('open', () => {
            const wrapper = popup.getElement();
            if (wrapper) {
              (wrapper as HTMLElement).style.setProperty('--popup-bg', '#0f172a');
              const content = wrapper.querySelector('.maplibregl-popup-content') as HTMLElement | null;
              if (content) {
                content.style.background = '#0f172a';
                content.style.border = '1px solid #1e293b';
                content.style.borderRadius = '10px';
                content.style.color = '#e2e8f0';
                content.style.padding = '12px 14px';
              }
              const tip = wrapper.querySelector('.maplibregl-popup-tip') as HTMLElement | null;
              if (tip) tip.style.borderTopColor = '#1e293b';
            }
          });

          markersRef.current.push({ el, popup, segId: seg.id });
        }
      } catch (err) {
        console.error('[TrafficMap] Fatal initialisation error:', err);
      }
    })();
  }, []);

  // ── ResizeObserver to keep canvas crisp on layout changes ───────────────
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || typeof window.ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (mapRef.current?.mapLibreMap) {
        mapRef.current.mapLibreMap.resize();
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Focus on selected segment if selectedSegmentId changes ──────────────
  useEffect(() => {
    if (!selectedSegmentId || !mapRef.current?.mapLibreMap) return;
    const seg = monitoredSegments.find((s) => s.id === selectedSegmentId);
    if (!seg) return;

    mapRef.current.mapLibreMap.flyTo({
      center: [seg.lon, seg.lat],
      zoom: 14.5,
      essential: true,
    });

    const match = markersRef.current.find((m) => m.segId === selectedSegmentId);
    if (match && !match.popup.isOpen()) {
      match.popup.addTo(mapRef.current.mapLibreMap);
    }
  }, [selectedSegmentId]);

  // ── Update markers whenever segmentData changes (WebSocket push) ─────────
  const updateMarkers = useCallback(() => {
    for (const { el, popup, segId } of markersRef.current) {
      const color = severityColor(segId, segmentData);
      const dot = el.querySelector('.marker-dot') as HTMLDivElement | null;
      if (dot) {
        dot.style.background = color;
        dot.style.boxShadow = `0 0 0 2px ${color}66,0 2px 8px rgba(0,0,0,0.5)`;
      } else {
        el.style.background = color;
      }
      if (popup.isOpen()) {
        popup.setHTML(buildPopupHTML(segId, segmentData));
      }
    }
  }, [segmentData]);

  useEffect(() => {
    if (mapRef.current?.mapReady) updateMarkers();
  }, [segmentData, updateMarkers]);

  const hasKey = !!process.env.NEXT_PUBLIC_TOMTOM_MAP_KEY;

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl bg-slate-950 ${className || 'h-[360px] sm:h-[480px] md:h-[540px] lg:h-[600px]'}`}>
      {/* Map GL canvas – always rendered so the GL context persists */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Map Control Buttons: Zoom In (+), Zoom Out (-), Recenter (🎯) */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-center gap-1.5 shadow-xl">
        {/* Zoom In (+) */}
        <button
          type="button"
          onClick={() => {
            if (mapRef.current?.mapLibreMap) {
              mapRef.current.mapLibreMap.zoomIn({ duration: 250 });
            }
          }}
          title="Zoom in (+)"
          aria-label="Zoom in"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-cyan-950 text-white hover:text-cyan-300 font-bold text-lg sm:text-xl border border-slate-700/80 backdrop-blur-md flex items-center justify-center transition active:scale-95 cursor-pointer touch-manipulation shadow-md select-none"
        >
          +
        </button>

        {/* Zoom Out (-) */}
        <button
          type="button"
          onClick={() => {
            if (mapRef.current?.mapLibreMap) {
              mapRef.current.mapLibreMap.zoomOut({ duration: 250 });
            }
          }}
          title="Zoom out (-)"
          aria-label="Zoom out"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-cyan-950 text-white hover:text-cyan-300 font-bold text-lg sm:text-xl border border-slate-700/80 backdrop-blur-md flex items-center justify-center transition active:scale-95 cursor-pointer touch-manipulation shadow-md leading-none select-none pb-0.5"
        >
          −
        </button>

        {/* Recenter Hazaribagh */}
        <button
          type="button"
          onClick={() => {
            if (mapRef.current?.mapLibreMap) {
              mapRef.current.mapLibreMap.flyTo({
                center: [85.362, 23.996],
                zoom: 13.5,
                essential: true,
              });
            }
          }}
          title="Recenter on Hazaribagh"
          aria-label="Recenter on Hazaribagh"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-cyan-950 text-slate-200 hover:text-white border border-slate-700/80 backdrop-blur-md flex items-center justify-center transition active:scale-95 cursor-pointer touch-manipulation shadow-md text-sm sm:text-base select-none"
        >
          🎯
        </button>
      </div>

      {/* Responsive Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-slate-950/90 backdrop-blur-md border border-slate-800/90 rounded-xl p-2.5 sm:p-3 shadow-xl max-w-[170px] sm:max-w-[220px]">
        <div className="font-bold uppercase tracking-wider text-[9px] sm:text-[10px] text-slate-400 mb-1.5 sm:mb-2">
          Monitored Segments
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-1 gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-slate-300 font-medium">
          {[
            { color: 'bg-emerald-500', label: 'Normal' },
            { color: 'bg-amber-500', label: 'Moderate' },
            { color: 'bg-rose-500', label: 'Heavy Jam' },
            { color: 'bg-slate-500', label: 'No data' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${color} ring-1 ring-white/40 shrink-0`} />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Attribution */}
      <div className="absolute bottom-2 right-2 z-10 text-[9px] text-slate-400 bg-slate-950/80 backdrop-blur-sm px-2 py-0.5 rounded-md border border-slate-800/60 hidden sm:block">
        © OpenStreetMap contributors
      </div>

      {/* Warning overlay when API key is absent */}
      {!hasKey && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-6 text-center">
          <div className="max-w-sm space-y-3">
            <div className="text-4xl">🗝️</div>
            <p className="text-white font-bold text-sm">Map API Key Missing</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              Add <code className="text-cyan-400 font-mono">NEXT_PUBLIC_TOMTOM_MAP_KEY</code> to <code className="text-cyan-400 font-mono">.env</code> and restart server.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
