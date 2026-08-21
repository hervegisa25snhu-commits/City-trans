import React, { useState, useEffect } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import { BusTelemetry, BusStop, TransitRoute } from '../types';
import { KIGALI_BUS_STOPS, KIGALI_ROUTES } from '../data/kigaliTransitData';
import GoogleMapsPolyline from './GoogleMapsPolyline';
import GoogleMapsTrafficLayer from './GoogleMapsTrafficLayer';
import {
  Layers,
  Compass,
  Bus as BusIcon,
  MapPin,
  Radio,
  Eye,
  Key,
  ShieldCheck,
  Zap,
  Info,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface GoogleTransitMapProps {
  buses: BusTelemetry[];
  routes?: TransitRoute[];
  selectedBus: BusTelemetry | null;
  selectedStop: BusStop | null;
  activeRouteId: string | null;
  onSelectBus: (bus: BusTelemetry | null) => void;
  onSelectStop: (stop: BusStop | null) => void;
  userLocation: { lat: number; lng: number } | null;
  onLocateUser: () => void;
}

function MapCameraController({
  selectedBus,
  selectedStop,
  userLocation,
}: {
  selectedBus: BusTelemetry | null;
  selectedStop: BusStop | null;
  userLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !selectedBus) return;
    map.panTo({ lat: selectedBus.currentLat, lng: selectedBus.currentLng });
  }, [map, selectedBus?.id, selectedBus?.currentLat, selectedBus?.currentLng]);

  useEffect(() => {
    if (!map || !selectedStop) return;
    map.panTo({ lat: selectedStop.lat, lng: selectedStop.lng });
  }, [map, selectedStop?.id, selectedStop?.lat, selectedStop?.lng]);

  return null;
}

export default function GoogleTransitMap({
  buses,
  routes = KIGALI_ROUTES,
  selectedBus,
  selectedStop,
  activeRouteId,
  onSelectBus,
  onSelectStop,
  userLocation,
  onLocateUser,
}: GoogleTransitMapProps) {
  // Read key from environment or local storage fallback
  const envKey = ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('kigali_gmaps_key') || envKey;
  });
  const [keyInput, setKeyInput] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);

  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
  const [showTraffic, setShowTraffic] = useState(true);
  const [showStops, setShowStops] = useState(true);
  const [activeStopInfoWindow, setActiveStopInfoWindow] = useState<BusStop | null>(null);

  useEffect(() => {
    if (selectedStop) {
      setActiveStopInfoWindow(selectedStop);
    }
  }, [selectedStop]);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyInput.trim()) {
      localStorage.setItem('kigali_gmaps_key', keyInput.trim());
      setApiKey(keyInput.trim());
      setShowKeyModal(false);
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden">
      {/* Top Map Action & Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Google Maps Brand & Active Filter Pill */}
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-xl pointer-events-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold text-xs">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            <span>Google Maps Platform</span>
          </div>

          {activeRouteId ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-200 px-2 font-mono">
              <span>Corridor:</span>
              <span className="font-bold text-blue-400">
                Line {routes.find((r) => r.id === activeRouteId)?.code}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 px-2 font-medium">All Transit Corridors</span>
          )}
        </div>

        {/* Layer Controls & Key Config */}
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-xl pointer-events-auto text-xs">
          {/* Map Type Switcher */}
          <select
            value={mapTypeId}
            onChange={(e) => setMapTypeId(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="roadmap">Vector Roads</option>
            <option value="terrain">Terrain Map</option>
            <option value="satellite">Satellite</option>
            <option value="hybrid">Hybrid</option>
          </select>

          {/* Traffic Toggle */}
          <button
            onClick={() => setShowTraffic(!showTraffic)}
            className={`px-2.5 py-1 rounded-xl font-medium transition flex items-center gap-1.5 ${
              showTraffic
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800'
            }`}
            title="Toggle Live Google Traffic Layer"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Traffic</span>
          </button>

          {/* Bus Stops Toggle */}
          <button
            onClick={() => setShowStops(!showStops)}
            className={`px-2.5 py-1 rounded-xl font-medium transition flex items-center gap-1.5 ${
              showStops
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800'
            }`}
            title="Toggle Bus Terminals & Stops"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Stops</span>
          </button>

          {/* Locate Me */}
          <button
            onClick={onLocateUser}
            className="px-2.5 py-1 rounded-xl text-slate-300 hover:text-white bg-slate-950 border border-slate-800 hover:border-blue-500 transition flex items-center gap-1"
            title="Locate Current Position"
          >
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Locate</span>
          </button>

          {/* Key Settings Button */}
          <button
            onClick={() => setShowKeyModal(true)}
            className="p-1 rounded-xl text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition"
            title="Configure Google Maps API Key"
          >
            <Key className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Google Maps Viewport using @vis.gl/react-google-maps */}
      <div className="w-full h-full flex-1 relative">
        <APIProvider apiKey={apiKey} libraries={['maps', 'marker', 'geometry']}>
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={{ lat: -1.9441, lng: 30.0619 }} // Kigali CBD coordinates
            defaultZoom={13}
            mapTypeId={mapTypeId}
            gestureHandling="greedy"
            disableDefaultUI={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            className="w-full h-full"
          >
            {/* Camera Synchronizer */}
            <MapCameraController
              selectedBus={selectedBus}
              selectedStop={selectedStop}
              userLocation={userLocation}
            />

            {/* Google Maps Traffic Layer */}
            <GoogleMapsTrafficLayer enabled={showTraffic} />

            {/* Kigali Transit Corridors Polylines */}
            {routes.map((route) => {
              const isHighlighted = !activeRouteId || activeRouteId === route.id;
              const opacity = isHighlighted ? (activeRouteId ? 0.95 : 0.75) : 0.2;
              const weight = isHighlighted ? (activeRouteId ? 6 : 4) : 2.5;

              return (
                <GoogleMapsPolyline
                  key={route.id}
                  path={route.waypoints.map(([lat, lng]) => ({ lat, lng }))}
                  color={route.color}
                  weight={weight}
                  opacity={opacity}
                  isHighlighted={isHighlighted}
                  onClick={() => {
                    const firstBus = buses.find((b) => b.routeId === route.id);
                    if (firstBus) onSelectBus(firstBus);
                  }}
                />
              );
            })}

            {/* Bus Stops & Terminal Markers */}
            {showStops &&
              KIGALI_BUS_STOPS.map((stop) => {
                const isMajorTerminal =
                  stop.id === 'stop_downtown' ||
                  stop.id === 'stop_nyabugogo' ||
                  stop.id === 'stop_kimironko' ||
                  stop.id === 'stop_remera_giporoso';

                return (
                  <AdvancedMarker
                    key={stop.id}
                    position={{ lat: stop.lat, lng: stop.lng }}
                    title={stop.name}
                    onClick={() => {
                      onSelectStop(stop);
                      setActiveStopInfoWindow(stop);
                    }}
                  >
                    <div className="group relative flex items-center justify-center cursor-pointer transform hover:scale-125 transition">
                      <div
                        className={`absolute -inset-1 rounded-full ${
                          isMajorTerminal ? 'bg-amber-400/40 animate-ping' : 'bg-slate-400/20'
                        }`}
                      />
                      <div
                        className={`relative w-5 h-5 rounded-full ${
                          isMajorTerminal
                            ? 'bg-amber-500 border-2 border-white'
                            : 'bg-slate-800 border border-slate-300'
                        } flex items-center justify-center text-[10px] text-white shadow-md`}
                      >
                        <span className="font-bold">{isMajorTerminal ? '★' : '•'}</span>
                      </div>
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* InfoWindow for Selected Bus Stop */}
            {activeStopInfoWindow && (
              <InfoWindow
                position={{
                  lat: activeStopInfoWindow.lat,
                  lng: activeStopInfoWindow.lng,
                }}
                onCloseClick={() => setActiveStopInfoWindow(null)}
                pixelOffset={[0, -10]}
              >
                <div className="p-1 max-w-xs text-slate-900">
                  <div className="flex items-center gap-1.5 mb-1 font-bold text-sm text-slate-900 border-b pb-1">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <span>{activeStopInfoWindow.name}</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-700">
                    <p className="font-semibold text-slate-800">
                      Zone: <span className="font-normal text-slate-600">{activeStopInfoWindow.zone}</span>
                    </p>
                    <p>
                      Connected Lines:{' '}
                      <span className="font-mono font-bold text-blue-600">
                        {activeStopInfoWindow.connectedRouteIds
                          .map((id) => routes.find((r) => r.id === id)?.code)
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </p>
                    <div className="pt-1 flex items-center justify-between text-[11px] text-emerald-700 font-medium">
                      <span>Waiting Passengers: ~{activeStopInfoWindow.waitingPassengers}</span>
                      <span>Card Tap: Active</span>
                    </div>
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* Active Live Buses Advanced Markers */}
            {buses.map((bus) => {
              const route = routes.find((r) => r.id === bus.routeId);
              const isSelected = selectedBus?.id === bus.id;
              const operatorColor =
                bus.operator === 'KBS' ? '#2563eb' : bus.operator === 'Royal Express' ? '#dc2626' : '#059669';

              return (
                <AdvancedMarker
                  key={bus.id}
                  position={{ lat: bus.currentLat, lng: bus.currentLng }}
                  title={`${bus.plateNumber} (Line ${route?.code})`}
                  onClick={() => onSelectBus(isSelected ? null : bus)}
                  zIndex={isSelected ? 50 : 20}
                >
                  <div
                    className={`relative cursor-pointer transition-all duration-300 transform ${
                      isSelected ? 'scale-125 z-40' : 'hover:scale-110 z-20'
                    }`}
                  >
                    {/* Direction Cone Pulse */}
                    <div
                      className="absolute -inset-2 rounded-full opacity-30 animate-pulse"
                      style={{ backgroundColor: operatorColor }}
                    />

                    {/* Bus Pill Marker */}
                    <div
                      className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white font-bold text-xs shadow-xl border-2 ${
                        isSelected ? 'border-amber-300 ring-4 ring-amber-400/30' : 'border-white'
                      }`}
                      style={{ backgroundColor: operatorColor }}
                    >
                      {/* Heading Arrow */}
                      <div
                        style={{
                          transform: `rotate(${bus.headingDeg}deg)`,
                          transition: 'transform 0.5s ease-out',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L4 20L12 16L20 20L12 2Z" />
                        </svg>
                      </div>

                      <span className="tracking-tight font-mono text-[11px]">
                        {route?.code || 'BUS'}
                      </span>

                      {/* Speed */}
                      <span className="text-[9px] font-medium bg-black/30 px-1 py-0.2 rounded">
                        {bus.speedKmh}k
                      </span>
                    </div>

                    {/* Plate Tag */}
                    <div
                      className={`absolute -bottom-5 left-1/2 -translate-x-1/2 ${
                        isSelected ? 'opacity-100' : 'opacity-0'
                      } bg-slate-900 text-slate-100 text-[10px] font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap pointer-events-none border border-slate-700`}
                    >
                      {bus.plateNumber}
                    </div>
                  </div>
                </AdvancedMarker>
              );
            })}

            {/* User Location Beacon */}
            {userLocation && (
              <AdvancedMarker
                position={{ lat: userLocation.lat, lng: userLocation.lng }}
                title="Your Current Location"
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping" />
                  <div className="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg" />
                </div>
              </AdvancedMarker>
            )}
          </Map>
        </APIProvider>
      </div>

      {/* Floating Bottom Legend */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700 shadow-xl text-xs text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
          <span>KBS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
          <span>Royal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
          <span>RFTC</span>
        </div>
        <div className="w-px h-3 bg-slate-700 mx-1"></div>
        <div className="flex items-center gap-1 text-[11px] text-amber-400">
          <span>★ Terminals</span>
        </div>
      </div>

      {/* Key Configuration Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl max-w-md w-full shadow-2xl text-slate-200">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <Key className="w-4 h-4 text-blue-400" />
                <span>Google Maps Platform API Key</span>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded-lg bg-slate-800"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Google Maps Platform provides vector roadmaps, real-time traffic overlays, satellite imagery, and advanced markers.
            </p>

            <form onSubmit={handleSaveKey} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  API Key or Maps Demo Key
                </label>
                <input
                  type="text"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="AIzaSy... or Maps Demo Key"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition shadow"
                >
                  Apply Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
