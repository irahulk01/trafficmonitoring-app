export interface MonitoredSegment {
  id: string;
  name: string;
  lat: number;
  lon: number;
  description?: string;
}

export const monitoredSegments: MonitoredSegment[] = [
  // Already in your list
  { id: 'hzb-1', name: 'Jhanda Chowk', lat: 23.9917, lon: 85.3606, description: 'Central town intersection, Matwari' },
  { id: 'hzb-2', name: 'Bansilal Chowk', lat: 23.9936, lon: 85.3609, description: 'Nawabganj market intersection' },

  // Town chowks / junctions
  { id: 'hzb-9', name: 'Annada Chowk', lat: 23.9966, lon: 85.3595, description: 'Nawabganj intersection' },
  { id: 'hzb-10', name: 'Budhwa Mahadev Chowk', lat: 23.9925, lon: 85.3636, description: 'Nawabganj, near old bus stand cluster' },
  { id: 'hzb-11', name: 'Kutchery Chowk', lat: 23.9965, lon: 85.3654, description: 'Suresh Colony' },
  { id: 'hzb-12', name: 'Korra Chowk', lat: 23.9925, lon: 85.3862, description: 'New Colony, ~2km east of town center' },
  { id: 'hzb-13', name: 'Purana Bus Stand / Bus Stand Chowk', lat: 23.9932, lon: 85.3638, description: 'NH 33, Suresh Colony' },
  { id: 'hzb-14', name: 'Rasuliganj Chowk', lat: 23.9654, lon: 85.3546, description: 'Jaiprabha Nagar, southern town' },
  { id: 'hzb-15', name: 'Bharat Mata Chowk (Bypass More)', lat: 23.9659, lon: 85.3737, description: 'Hazaribagh Bypass, Masipirhi' },

  // Named roads
  { id: 'hzb-16', name: 'Guru Govind Singh Road', lat: 23.9968, lon: 85.3598, description: 'Nawabganj' },
  { id: 'hzb-17', name: 'Nawabganj Road', lat: 23.9950, lon: 85.3560, description: 'Nawabganj locality' },
  { id: 'hzb-18', name: 'Columbus College More', lat: 23.9853, lon: 85.3742, description: 'St. Columba\'s College, southern approach ~3km from center' },
  { id: 'hzb-19', name: 'Patratu Road', lat: 23.9710, lon: 85.3790, description: 'Southern town road' },

  // Wider district — further out, NOT town-core traffic
  { id: 'hzb-20', name: 'Singhani More', lat: 23.9944, lon: 85.4066, description: 'NH-100 junction, ~5km east of center' },
  { id: 'hzb-21', name: 'Nagwan Toll Plaza Bypass More', lat: 24.0445, lon: 85.3861, description: 'NH toll plaza, ~7km north of center' },
  { id: 'hzb-22', name: 'Sindoor Bypass', lat: 24.0278, lon: 85.3724, description: 'Kolghatti, ~7km north — NH-20 corridor endpoint' },
  { id: 'hzb-23', name: 'Katkamsandi (approximate)', lat: 24.1090, lon: 85.2037, description: 'Town centroid only — replace with exact checkpoint coordinates' },

  // Regional highway waypoints — 35km+ from Hazaribagh town
  { id: 'hzb-24', name: 'Barhi (NH-2/GT Road)', lat: 24.3006, lon: 85.4163, description: '~40km north — GT Road waypoint' },
  { id: 'hzb-25', name: 'Chauparan (NH-2/GT Road)', lat: 24.3799, lon: 85.2652, description: '~60km north — GT Road waypoint' },
  { id: 'hzb-26', name: 'Bagodar (NH-522)', lat: 24.0784, lon: 85.8307, description: '~50km east — Bagodar-Chatra Road waypoint' },
  { id: 'hzb-27', name: 'Chatra Road (town exit)', lat: 23.9792, lon: 85.3244, description: 'Chatra Road as it leaves Hazaribagh town' },
];