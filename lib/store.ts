import { create } from 'zustand';
import { LiveSegmentData, TrafficIncident } from './mappls';

export type FilterType = 'all' | 'heavy' | 'moderate' | 'developing';

interface TrafficState {
  segments: LiveSegmentData[];
  incidents: TrafficIncident[];
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
  lastUpdated: string | null;
  selectedSegmentId: string | null;
  filter: FilterType;
  setSegments: (segments: LiveSegmentData[]) => void;
  setIncidents: (incidents: TrafficIncident[]) => void;
  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting') => void;
  setLastUpdated: (timestamp: string) => void;
  setSelectedSegmentId: (id: string | null) => void;
  setFilter: (filter: FilterType) => void;
}

export const useTrafficStore = create<TrafficState>((set) => ({
  segments: [],
  incidents: [],
  connectionStatus: 'connecting',
  lastUpdated: null,
  selectedSegmentId: null,
  filter: 'all',
  setSegments: (segments) => set({ segments }),
  setIncidents: (incidents) => set({ incidents }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setLastUpdated: (lastUpdated) => set({ lastUpdated }),
  setSelectedSegmentId: (selectedSegmentId) => set({ selectedSegmentId }),
  setFilter: (filter) => set({ filter }),
}));
