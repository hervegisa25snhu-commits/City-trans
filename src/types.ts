export type TransitOperator = 'KBS' | 'Royal Express' | 'RFTC';

export type BusOccupancy = 'low' | 'medium' | 'high' | 'full';

export type TrafficCondition = 'clear' | 'moderate' | 'heavy' | 'storm_rain';

export interface BusStop {
  id: string;
  name: string;
  kinyarwandaName?: string;
  zone: string;
  lat: number;
  lng: number;
  facilities: string[]; // e.g. ['Shelter', 'Tap&Go Agent', 'Lighting', 'Wheelchair Access']
  popularLandmark?: string;
}

export interface TransitRoute {
  id: string;
  code: string; // e.g. "101", "102"
  name: string;
  operator: TransitOperator;
  color: string;
  originId: string;
  destinationId: string;
  originName: string;
  destinationName: string;
  stopIds: string[];
  waypoints: [number, number][]; // [lat, lng] polyline coordinates
  standardFareRwf: number;
  averageFrequencyMin: number;
  description: string;
}

export interface BusTelemetry {
  id: string;
  plateNumber: string; // e.g. "RAD 482 B"
  fleetNumber: string; // e.g. "KBS-042"
  routeId: string;
  operator: TransitOperator;
  driverName: string;
  currentLat: number;
  currentLng: number;
  speedKmh: number;
  headingDeg: number;
  occupancy: BusOccupancy;
  passengerCount: number;
  capacity: number;
  nextStopId: string;
  etaToNextStopSec: number;
  status: 'in_transit' | 'at_stop' | 'delayed' | 'depot';
  delayMinutes: number;
  hasWifi: boolean;
  hasAirConditioning: boolean;
  isWheelchairAccessible: boolean;
  tapAndGoValidatorOnline: boolean;
  lastUpdated: string;
  pathProgress: number; // 0 to 1 along route waypoints
  direction: 'outbound' | 'inbound';
}

export interface StopArrivalPrediction {
  busId: string;
  plateNumber: string;
  routeCode: string;
  routeName: string;
  operator: TransitOperator;
  routeColor: string;
  destinationName: string;
  etaMinutes: number;
  etaSeconds: number;
  occupancy: BusOccupancy;
  delayMinutes: number;
  distanceKm: number;
}

export interface TapGoCard {
  cardNumber: string;
  holderName: string;
  balanceRwf: number;
  lastTappedStop?: string;
  lastTappedTime?: string;
  tripsToday: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface TransitAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: 'maps_grounding' | 'search_grounding' | 'high_thinking';
  groundingSources?: GroundingSource[];
  thinkingDurationSec?: number;
}
