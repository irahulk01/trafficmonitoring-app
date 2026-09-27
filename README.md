# Real-Time Traffic Congestion Monitoring Dashboard (Next.js & TomTom SDK)

A unified Next.js (App Router, TypeScript) real-time traffic monitoring application powered by official **TomTom SDKs** (`@tomtom-org/maps-sdk` and `@tomtom-international/web-sdk-services`), server-side continuous polling, and WebSocket telemetry push.

## Architectural Overview

Next.js standard serverless API routes do not support persistent long-running background polling loops or WebSocket servers. This application uses Next.js's **custom server pattern** (`server.ts` using Node's `http` module):
1. **Official TomTom SDK Integration**:
   - Uses `@tomtom-org/maps-sdk/services` for typed GeoJSON incident details (`trafficIncidentDetails`) and global configuration (`TomTomConfig`).
   - Uses `@tomtom-international/web-sdk-services` for high-frequency traffic flow segment data (`trafficFlowSegmentData`).
2. **Modular Architecture (`lib/tomtom/`)**:
   - `client.ts`: Configures and initializes TomTom SDK instances securely server-side.
   - `flow-service.ts`: Queries segment flow metrics (speeds, travel times, confidence, geometry).
   - `incident-service.ts`: Fetches corridor hazard events, road closures, accidents, and delay magnitudes.
   - `poller.ts`: Background polling daemon that broadcasts real-time telemetry over WebSockets.
   - `types.ts`: Strongly typed interfaces for live segments, incidents, and telemetry states.
3. **Next Request Handler**: Serves App Router pages (`app/page.tsx`), metadata, and REST endpoints (`/api/segments` and `/api/incidents`).
4. **WebSocket Server (`ws`)**: Attached directly to the same HTTP server port, pushing live telemetry and incidents without client-side polling.
5. **Server-Side API Key Isolation**: `TOMTOM_API_KEY` stays exclusively on the server process (without `NEXT_PUBLIC_` prefix) and is never leaked to the client bundle or network tab.
6. **iOS PWA Suspended-Socket Handling**: Foreground resume listeners (`visibilitychange`, `window.focus`, and `window.online`) automatically reconnect dropped sockets when coming back from background suspension.

---

## File Structure

```
├── server.ts                  # Custom Next.js + HTTP + WebSocket server
├── lib/
│   ├── tomtom/                # Modular TomTom SDK Architecture
│   │   ├── client.ts          # SDK configuration & client provider
│   │   ├── flow-service.ts    # Traffic Flow Segment Data SDK service
│   │   ├── incident-service.ts# Incident Details SDK service (@tomtom-org/maps-sdk)
│   │   ├── poller.ts          # Continuous background poller & WebSocket broadcaster
│   │   ├── types.ts           # Telemetry and incident TypeScript interfaces
│   │   └── index.ts           # Unified SDK barrel export
│   ├── tomtom.ts              # Backward-compatible facade re-exporting lib/tomtom
│   ├── detection.ts           # Severity scoring, developing trend detection, geometry jam length
│   ├── segments.ts            # Monitored road corridors configuration
│   └── store.ts               # Zustand store for live client state management
├── app/
│   ├── layout.tsx             # Root layout with PWA iOS status bar & viewport tags
│   ├── page.tsx               # Real-time reactive dashboard UI (WebSocket listener + SDK Incidents tab)
│   ├── globals.css            # Tailwind / modern styling
│   └── api/
│       ├── segments/route.ts  # REST fallback endpoint for segment flow telemetry
│       └── incidents/route.ts # REST endpoint for TomTom SDK incident alerts
├── public/
│   └── manifest.json          # PWA Web App Manifest
├── .env                       # Server-side environment variables (TomTom API Key)
└── .env.example               # Environment variables template
```

---

## Environment Configuration

Create a `.env` file in the root directory:

```env
# TomTom API Configuration (Server-Side Only - NEVER expose to client)
TOMTOM_API_KEY=your_tomtom_api_key_here
POLL_INTERVAL_MS=60000
PORT=3000
```

---

## Running the Application

### Development
```bash
npm run dev
```
Starts `tsx server.ts`, which compiles Next.js, launches the WebSocket server, and immediately starts polling the TomTom API via the SDKs.

### Production
```bash
npm run build
npm start
```

---

## Sanity Check & API Verification

1. **Verify WebSocket Live Push**:
   - Open `http://localhost:3000`. The header badge shows **WebSocket Live** with a pulsing green indicator.
   - Connected clients receive instant segment telemetry and live hazard events.

2. **Verify REST Endpoints**:
   - `curl http://localhost:3000/api/segments`: returns current speed, severity score, and geometry nodes from the SDK.
   - `curl http://localhost:3000/api/incidents`: returns live incidents (accidents, jams, delays) from `@tomtom-org/maps-sdk/services`.

3. **Verify Server Polling**:
   - Check the server console log:
     ```
     🚀 [TrafficApp] Server running on http://0.0.0.0:3000
     🔌 [TrafficApp] WebSocket endpoint ready
     🛰️ [TrafficApp] Persistent TomTom polling active
     📡 [TomTom SDK] Broadcasted 5 segment(s) and X incident(s) to Y client(s).
     ```
