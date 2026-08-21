import React, { useState, useEffect } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import { BusTelemetry, BusStop, TransitRoute, TransitChokePoint, DedicatedBusCorridor } from '../types';
import { KIGALI_BUS_STOPS, KIGALI_ROUTES, KIGALI_CHOKE_POINTS, KIGALI_DEDICATED_BUS_LANES } from '../data/kigaliTransitData';
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
  AlertTriangle,
  Flame,
  Leaf,
  Route as RouteIcon,
} from 'lucide-react';

interface GoogleTransitMapProps {
  buses: BusTelemetry[];
  routes?: TransitRoute[];
  chokePoints?: TransitChokePoint[];
  dedicatedCorridors?: DedicatedBusCorridor[];
  selectedBus: BusTelemetry | null;
  selectedStop: BusStop | null;
  selectedChokePoint?: TransitChokePoint | null;
  activeRouteId: string | null;
  onSelectBus: (bus: BusTelemetry | null) => void;
  onSelectStop: (stop: BusStop | null) => void;
  onSelectChokePoint?: (chokePoint: TransitChokePoint | null) => void;
  userLocation: { lat: number; lng: number } | null;
  onLocateUser: () => void;
}

function MapCameraController({
  selectedBus,
  selectedStop,
  selectedChokePoint,
  activeRouteId,
  userLocation,
}: {
  selectedBus: BusTelemetry | null;
  selectedStop: BusStop | null;
  selectedChokePoint?: TransitChokePoint | null;
  activeRouteId?: string | null;
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
    map.setZoom(15);
  }, [map, selectedStop?.id, selectedStop?.lat, selectedStop?.lng]);

  useEffect(() => {
    if (!map || !selectedChokePoint) return;
    map.panTo({ lat: selectedChokePoint.lat, lng: selectedChokePoint.lng });
    map.setZoom(15);
  }, [map, selectedChokePoint?.id, selectedChokePoint?.lat, selectedChokePoint?.lng]);

  useEffect(() => {
    if (!map || !activeRouteId) return;
    const route = KIGALI_ROUTES.find((r) => r.id === activeRouteId);
    if (route && route.waypoints.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      route.waypoints.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
      map.fitBounds(bounds, 50);
    }
  }, [map, activeRouteId]);

  return null;
}

export default function GoogleTransitMap({
  buses,
  routes = KIGALI_ROUTES,
  chokePoints = KIGALI_CHOKE_POINTS,
  dedicatedCorridors = KIGALI_DEDICATED_BUS_LANES,
  selectedBus,
  selectedStop,
  selectedChokePoint,
  activeRouteId,
  onSelectBus,
  onSelectStop,
  onSelectChokePoint,
  userLocation,
  onLocateUser,
}: GoogleTransitMapProps) {
  const envKey = ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('kigali_gmaps_key') || envKey;
  });
  const [keyInput, setKeyInput] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);

  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
  const [showTraffic, setShowTraffic] = useState(false);
  const [showStops, setShowStops] = useState(true);
  const [showChokePoints, setShowChokePoints] = useState(true);
  const [showDedicatedLanes, setShowDedicatedLanes] = useState(false);
  const [showRouteLines, setShowRouteLines] = useState(false);

  const [activeStopInfoWindow, setActiveStopInfoWindow] = useState<BusStop | null>(null);
  const [activeChokeInfoWindow, setActiveChokeInfoWindow] = useState<TransitChokePoint | null>(null);

  useEffect(() => {
    if (selectedStop) {
      setActiveStopInfoWindow(selectedStop);
      setActiveChokeInfoWindow(null);
    }
  }, [selectedStop]);

  useEffect(() => {
    if (selectedChokePoint) {
      setActiveChokeInfoWindow(selectedChokePoint);
      setActiveStopInfoWindow(null);
    }
  }, [selectedChokePoint]);

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

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Leaf className="w-3 h-3" />
            <span className="hidden sm:inline">EcoFleet Kigali Network</span>
          </div>

          {activeRouteId ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-200 px-2 font-mono">
              <span>Line:</span>
              <span className="font-bold text-blue-400">
                {routes.find((r) => r.id === activeRouteId)?.code}
              </span>
            </div>
          ) : null}
        </div>

        {/* Layer Controls & Key Config */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-xl pointer-events-auto text-xs flex-wrap">
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
            <span className="hidden sm:inline">Traffic</span>
          </button>

          {/* Choke Points Toggle */}
          <button
            onClick={() => setShowChokePoints(!showChokePoints)}
            className={`px-2.5 py-1 rounded-xl font-medium transition flex items-center gap-1.5 ${
              showChokePoints
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800'
            }`}
            title="Toggle Kigali Major Transit Choke Points"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Choke Points</span>
          </button>

          {/* Route Lines Toggle */}
          <button
            onClick={() => setShowRouteLines(!showRouteLines)}
            className={`px-2.5 py-1 rounded-xl font-medium transition flex items-center gap-1.5 ${
              showRouteLines || activeRouteId
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800'
            }`}
            title="Toggle Kigali Route Alignment Lines"
          >
            <RouteIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Route Lines</span>
          </button>

          {/* Dedicated Bus Lanes Toggle */}
          <button
            onClick={() => setShowDedicatedLanes(!showDedicatedLanes)}
            className={`px-2.5 py-1 rounded-xl font-medium transition flex items-center gap-1.5 ${
              showDedicatedLanes
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800'
            }`}
            title="Toggle Dedicated Bus Priority Lanes"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bus Lanes</span>
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
            <span className="hidden sm:inline">Stops</span>
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
            className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-950 border border-slate-800 hover:border-blue-500 transition"
            title="Configure Google Maps API Key"
          >
            <Key className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Primary Map View Container */}
      <div className="w-full h-full flex-1 relative">
        <APIProvider apiKey={apiKey} libraries={['maps', 'marker', 'geometry']}>
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={{ lat: -1.9441, lng: 30.0619 }} // Kigali CBD
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
              selectedChokePoint={selectedChokePoint}
              activeRouteId={activeRouteId}
              userLocation={userLocation}
            />

            {/* Google Maps Traffic Layer */}
            <GoogleMapsTrafficLayer enabled={showTraffic} />

            {/* Dedicated Bus Priority Lanes (City of Kigali & EcoFleet) */}
            {showDedicatedLanes &&
              dedicatedCorridors.map((corridor) => (
                <GoogleMapsPolyline
                  key={`corridor_${corridor.id}`}
                  path={corridor.waypoints.map(([lat, lng]) => ({ lat, lng }))}
                  color={corridor.color}
                  weight={5}
                  opacity={0.85}
                  isHighlighted={true}
                />
              ))}

            {/* Kigali Transit Corridors Polylines - only rendered when a specific route is selected OR when 'Route Lines' is explicitly turned on */}
            {routes
              .filter((route) => (activeRouteId ? route.id === activeRouteId : showRouteLines))
              .map((route) => {
                const isSelected = activeRouteId === route.id;
                const opacity = isSelected ? 0.95 : 0.75;
                const weight = isSelected ? 6 : 4;

                return (
                  <GoogleMapsPolyline
                    key={route.id}
                    path={route.waypoints.map(([lat, lng]) => ({ lat, lng }))}
                    color={route.color}
                    weight={weight}
                    opacity={opacity}
                    isHighlighted={true}
                    onClick={() => {
                      const firstBus = buses.find((b) => b.routeId === route.id);
                      if (firstBus) onSelectBus(firstBus);
                    }}
                  />
                );
              })}

            {/* Major Transit Choke Points */}
            {showChokePoints &&
              chokePoints.map((cp) => {
                const isSelected = selectedChokePoint?.id === cp.id;
                const isCritical = cp.severity === 'critical';
                const isHigh = cp.severity === 'high';

                return (
                  <AdvancedMarker
                    key={cp.id}
                    position={{ lat: cp.lat, lng: cp.lng }}
                    title={`Choke Point: ${cp.name}`}
                    onClick={() => {
                      if (onSelectChokePoint) onSelectChokePoint(cp);
                      setActiveChokeInfoWindow(cp);
                    }}
                    zIndex={isSelected ? 45 : 30}
                  >
                    <div className="relative group cursor-pointer flex items-center justify-center">
                      {/* Pulsing Bottleneck Area Ring */}
                      <div
                        className={`absolute -inset-3 rounded-full animate-ping opacity-40 ${
                          isCritical ? 'bg-rose-500' : isHigh ? 'bg-amber-500' : 'bg-blue-500'
                        }`}
                      />

                      {/* Choke Point Badge */}
                      <div
                        className={`relative flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-bold shadow-xl border-2 ${
                          isCritical
                            ? 'bg-rose-600 border-white'
                            : isHigh
                            ? 'bg-amber-600 border-amber-200'
                            : 'bg-blue-600 border-white'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3 text-white" />
                        <span className="tracking-tight whitespace-nowrap">+{cp.avgDelayMinutes}m</span>
                      </div>
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* Bus Stops & Terminal Markers */}
            {showStops &&
              KIGALI_BUS_STOPS.map((stop) => {
                const isBusPark = stop.isBusPark;
                const isSelected = selectedStop?.id === stop.id;

                return (
                  <AdvancedMarker
                    key={stop.id}
                    position={{ lat: stop.lat, lng: stop.lng }}
                    title={`${stop.name} (${stop.kinyarwandaName || ''})`}
                    onClick={() => {
                      onSelectStop(stop);
                      setActiveStopInfoWindow(stop);
                    }}
                  >
                    <div className="group relative flex items-center justify-center cursor-pointer transform hover:scale-125 transition">
                      {isBusPark ? (
                        <div className="relative flex items-center">
                          <div className={`absolute -inset-1 rounded-2xl ${isSelected ? 'bg-amber-400 animate-ping' : 'bg-emerald-500/30'}`} />
                          <div
                            className={`relative px-2 py-1 rounded-xl shadow-lg border flex items-center gap-1.5 transition ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold scale-110'
                                : stop.isEvChargingHub
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-400/80 font-bold'
                                : 'bg-slate-900 text-amber-400 border-amber-500/60 font-semibold'
                            }`}
                          >
                            <span className="text-[11px]">🏛️</span>
                            <span className="text-[11px] font-mono tracking-tight whitespace-nowrap">
                              {stop.kinyarwandaName ? stop.kinyarwandaName.split('/')[0].trim() : stop.name}
                            </span>
                            {stop.isEvChargingHub && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="EV Hub" />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <div
                            className={`w-3.5 h-3.5 rounded-full border shadow-sm transition ${
                              isSelected
                                ? 'bg-amber-400 border-white scale-125 ring-4 ring-amber-400/40'
                                : stop.isEvChargingHub
                                ? 'bg-emerald-500 border-emerald-200'
                                : 'bg-slate-700 border-slate-300 hover:bg-amber-400'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* InfoWindow for Selected Choke Point */}
            {activeChokeInfoWindow && (
              <InfoWindow
                position={{
                  lat: activeChokeInfoWindow.lat,
                  lng: activeChokeInfoWindow.lng,
                }}
                onCloseClick={() => setActiveChokeInfoWindow(null)}
                pixelOffset={[0, -10]}
              >
                <div className="p-1.5 max-w-xs text-slate-900">
                  <div className="flex items-center gap-1.5 mb-1.5 font-bold text-sm text-rose-700 border-b pb-1">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{activeChokeInfoWindow.name}</span>
                  </div>
                  <div className="text-xs space-y-1.5 text-slate-700">
                    <p className="font-mono text-emerald-800 text-[11px]">
                      {activeChokeInfoWindow.kinyarwandaName}
                    </p>
                    <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1.5 rounded text-[11px]">
                      <div>
                        <span className="text-slate-500">Live Speed: </span>
                        <strong className="text-slate-800">{activeChokeInfoWindow.currentSpeedKmh} km/h</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Peak Delay: </span>
                        <strong className="text-rose-600">+{activeChokeInfoWindow.avgDelayMinutes} min</strong>
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      <span className="font-semibold text-slate-800">Cause: </span>
                      {activeChokeInfoWindow.cause}
                    </p>
                    <p className="text-[11px] leading-relaxed text-emerald-800">
                      <span className="font-semibold">EcoFleet Bypass: </span>
                      {activeChokeInfoWindow.ecofleetBypassRecommendation}
                    </p>
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* InfoWindow for Selected Bus Stop / Bus Park */}
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
                  <div className="flex items-center justify-between gap-1 mb-1 border-b pb-1">
                    <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                      <MapPin className={`w-4 h-4 ${activeStopInfoWindow.isBusPark ? 'text-amber-600' : 'text-blue-600'}`} />
                      <span className="truncate">{activeStopInfoWindow.name}</span>
                    </div>
                    {activeStopInfoWindow.isBusPark && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        GARE
                      </span>
                    )}
                  </div>
                  <div className="text-xs space-y-1.5 text-slate-700">
                    <p className="font-mono text-emerald-800 text-[11px] font-semibold">
                      {activeStopInfoWindow.kinyarwandaName}
                    </p>
                    <p className="text-[11px]">
                      <span className="font-semibold text-slate-800">Zone / District: </span>
                      {activeStopInfoWindow.zone} {activeStopInfoWindow.district ? `• ${activeStopInfoWindow.district}` : ''}
                    </p>
                    {activeStopInfoWindow.isBusPark && activeStopInfoWindow.bayCapacity && (
                      <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1.5 rounded text-[11px]">
                        <div>
                          <span className="text-slate-500">Bay Capacity: </span>
                          <strong className="text-slate-900">{activeStopInfoWindow.bayCapacity} bays</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Daily Flow: </span>
                          <strong className="text-emerald-700">{activeStopInfoWindow.dailyPassengerVolume || 'High'}</strong>
                        </div>
                      </div>
                    )}
                    {activeStopInfoWindow.popularLandmark && (
                      <p className="text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-800">Landmark: </span>
                        {activeStopInfoWindow.popularLandmark}
                      </p>
                    )}
                    <p className="text-[11px]">
                      <span className="font-semibold text-slate-800">Connected Lines: </span>
                      <span className="font-mono font-bold text-blue-700">
                        {(activeStopInfoWindow.connectingLines?.map((c) => `Line ${c}`).join(', ')) ||
                          routes
                            .filter((r) => r.stopIds.includes(activeStopInfoWindow.id))
                            .map((r) => `Line ${r.code}`)
                            .join(', ') || 'Direct Corridor'}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {activeStopInfoWindow.facilities.map((fac) => (
                        <span
                          key={fac}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200"
                        >
                          {fac}
                        </span>
                      ))}
                    </div>
                    {activeStopInfoWindow.isEvChargingHub && (
                      <div className="p-1 bg-emerald-50 rounded text-emerald-800 font-semibold text-[11px] flex items-center gap-1 border border-emerald-200">
                        <Zap className="w-3.5 h-3.5 text-emerald-600" />
                        <span>EcoFleet EV Fast Charging Hub</span>
                      </div>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* Active Live Buses Advanced Markers */}
            {buses.map((bus) => {
              const route = routes.find((r) => r.id === bus.routeId);
              const isSelected = selectedBus?.id === bus.id;
              const operatorColor =
                bus.operator === 'EcoFleet' || bus.isElectric
                  ? '#10b981'
                  : bus.operator === 'KBS'
                  ? '#2563eb'
                  : bus.operator === 'Royal Express'
                  ? '#dc2626'
                  : '#059669';

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
                        {bus.isElectric ? '⚡' : ''}
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
                      {bus.plateNumber} {bus.batterySocPercent ? `(${bus.batterySocPercent}%)` : ''}
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
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700 shadow-xl text-xs text-slate-300 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>EcoFleet EV</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
          <span>KBS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
          <span>Royal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
          <span>RFTC</span>
        </div>
        <div className="w-px h-3 bg-slate-700 mx-1"></div>
        <div className="flex items-center gap-1 text-[11px] text-rose-400">
          <AlertTriangle className="w-3 h-3" />
          <span>Choke Points</span>
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
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-600/30"
                >
                  Save Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
