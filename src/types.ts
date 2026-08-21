export type TransitOperator = 'EcoFleet' | 'KBS' | 'Royal Express' | 'RFTC';

export type BusOccupancy = 'low' | 'medium' | 'high' | 'full';

export type TrafficCondition = 'clear' | 'moderate' | 'heavy' | 'storm_rain';

export type ChokePointSeverity = 'low' | 'moderate' | 'high' | 'critical';

export interface TransitChokePoint {
  id: string;
  name: string;
  kinyarwandaName: string;
  corridorName: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  severity: ChokePointSeverity;
  currentSpeedKmh: number;
  avgDelayMinutes: number;
  peakHours: string; // e.g. "06:30 - 08:30 & 17:00 - 20:00"
  cause: string;
  affectedLines: string[];
  mitigation: string;
  ecofleetBypassRecommendation: string;
  lastUpdated?: string;
}

export interface DedicatedBusCorridor {
  id: string;
  name: string;
  kinyarwandaName?: string;
  color: string;
  waypoints: [number, number][];
  distanceKm: number;
  peakHours: string; // e.g. "06:00 - 07:00 & 17:00 - 21:00"
  enforcementStatus: 'Active Enforcement' | 'Off-Peak Shared' | 'Pilot Priority';
  timeSavedMinutes: number;
  description: string;
}

export interface BusStop {
  id: string;
  name: string;
  kinyarwandaName?: string;
  zone: string; // e.g. "Zone 1 (Nyarugenge)", "Zone 2 (Gasabo)", "Zone 3 (Kicukiro)"
  district?: 'Nyarugenge' | 'Gasabo' | 'Kicukiro' | 'Outer Kigali';
  lat: number;
  lng: number;
  isBusPark?: boolean; // True for official Gares / Bus Terminals (e.g. Gare ya Nyabugogo, Gare ya Remera, etc.)
  parkType?: 'major_hub' | 'regional_terminal' | 'feeder_park' | 'waypoint_stop';
  bayCapacity?: number; // Estimated number of simultaneous bus parking bays
  facilities: string[]; // e.g. ['Shelter', 'Tap&Go Agent', 'Lighting', 'Wheelchair Access', 'Restrooms', 'EV Supercharger']
  popularLandmark?: string;
  isEvChargingHub?: boolean;
  connectingLines?: string[]; // e.g. ['101', '102', '205', '308']
  dailyPassengerVolume?: string; // e.g. "45,000+ commuters/day"
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
  isEcoFleetElectrified?: boolean;
}

export interface BusTelemetry {
  id: string;
  plateNumber: string; // e.g. "RAD 482 B"
  fleetNumber: string; // e.g. "KBS-042" or "ECO-01"
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
  isElectric?: boolean;
  batterySocPercent?: number;
  co2SavedKg?: number;
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
  isElectric?: boolean;
}

export interface TapGoCard {
  cardNumber: string;
  holderName: string;
  balanceRwf: number;
  lastTappedStop?: string;
  lastTappedTime?: string;
  tripsToday: number;
  cardType?: string;
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
