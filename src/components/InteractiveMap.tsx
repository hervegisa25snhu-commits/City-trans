import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { BusTelemetry, BusStop, TransitRoute, TransitChokePoint, DedicatedBusCorridor } from '../types';
import { KIGALI_BUS_STOPS, KIGALI_ROUTES, KIGALI_CHOKE_POINTS, KIGALI_DEDICATED_BUS_LANES } from '../data/kigaliTransitData';
import {
  MapPin,
  Navigation,
  Layers,
  Compass,
  Eye,
  Volume2,
  ShieldCheck,
  Bus as BusIcon,
  Radio,
  AlertTriangle,
  Zap,
  Leaf,
  Route as RouteIcon,
} from 'lucide-react';

interface InteractiveMapProps {
  buses: BusTelemetry[];
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

type MapStyle = 'voyager' | 'dark' | 'streets' | 'satellite';

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string }> = {
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
  },
  streets: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
  },
};

export default function InteractiveMap({
  buses,
  selectedBus,
  selectedStop,
  selectedChokePoint,
  activeRouteId,
  onSelectBus,
  onSelectStop,
  onSelectChokePoint,
  userLocation,
  onLocateUser,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const busMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const stopMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const chokeMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const corridorPolylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>('voyager');
  const [showStops, setShowStops] = useState(true);
  const [showChokePoints, setShowChokePoints] = useState(true);
  const [showDedicatedLanes, setShowDedicatedLanes] = useState(false);
  const [showRouteLines, setShowRouteLines] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-1.9441, 30.0619], // Kigali CBD center
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    const tile = L.tileLayer(TILE_LAYERS[mapStyle].url, {
      maxZoom: 19,
      attribution: TILE_LAYERS[mapStyle].attribution,
    }).addTo(map);

    tileLayerRef.current = tile;
    mapRef.current = map;

    // Add scale control
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    // Initial render of corridors, routes, choke points, stops
    renderDedicatedCorridors(map, false);
    renderRoutes(map, activeRouteId, false);
    renderChokePoints(map);
    renderStops(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Switch Map Style
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    const tile = L.tileLayer(TILE_LAYERS[mapStyle].url, {
      maxZoom: 19,
      attribution: TILE_LAYERS[mapStyle].attribution,
    }).addTo(mapRef.current);
    tileLayerRef.current = tile;
  }, [mapStyle]);

  // Update Dedicated Bus Lanes
  useEffect(() => {
    if (!mapRef.current) return;
    renderDedicatedCorridors(mapRef.current, showDedicatedLanes);
  }, [showDedicatedLanes]);

  // Update Route Polylines and zoom when activeRouteId or showRouteLines changes
  useEffect(() => {
    if (!mapRef.current) return;
    renderRoutes(mapRef.current, activeRouteId, showRouteLines);
    if (activeRouteId) {
      const route = KIGALI_ROUTES.find((r) => r.id === activeRouteId);
      if (route && route.waypoints.length > 0) {
        const bounds = L.latLngBounds(route.waypoints as [number, number][]);
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [activeRouteId, showRouteLines]);

  function renderDedicatedCorridors(map: L.Map, enabled: boolean) {
    corridorPolylinesRef.current.forEach((pl) => map.removeLayer(pl));
    corridorPolylinesRef.current.clear();

    if (!enabled) return;

    KIGALI_DEDICATED_BUS_LANES.forEach((lane) => {
      const polyline = L.polyline(lane.waypoints, {
        color: lane.color,
        weight: 6,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '8, 8',
      }).addTo(map);

      polyline.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px; max-width: 220px;">
          <h4 style="font-weight: bold; margin: 0 0 4px 0; color: #0f766e; font-size: 13px;">${lane.name}</h4>
          <p style="font-size: 11px; margin: 0 0 4px 0; color: #475569;">${lane.kinyarwandaName}</p>
          <div style="font-size: 11px; background: #f0fdf4; padding: 4px; border-radius: 4px; color: #166534; font-weight: bold; margin-bottom: 4px;">
            Peak: ${lane.peakHours}
          </div>
          <p style="font-size: 11px; color: #334155; margin: 0;">${lane.description}</p>
        </div>
      `);

      corridorPolylinesRef.current.set(lane.id, polyline);
    });
  }

  function renderRoutes(map: L.Map, highlightedRouteId: string | null, forceShowAll: boolean) {
    polylinesRef.current.forEach((pl) => map.removeLayer(pl));
    polylinesRef.current.clear();

    // If no route is selected and forceShowAll is false, do not draw any lines
    const routesToRender = highlightedRouteId
      ? KIGALI_ROUTES.filter((r) => r.id === highlightedRouteId)
      : forceShowAll
      ? KIGALI_ROUTES
      : [];

    routesToRender.forEach((route) => {
      const isSelected = highlightedRouteId === route.id;
      const opacity = isSelected ? 0.95 : 0.7;
      const weight = isSelected ? 6 : 4;

      const polyline = L.polyline(route.waypoints, {
        color: route.color,
        weight,
        opacity,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      polyline.on('click', () => {
        const firstBus = buses.find((b) => b.routeId === route.id);
        if (firstBus) onSelectBus(firstBus);
      });

      polylinesRef.current.set(route.id, polyline);
    });
  }

  function renderChokePoints(map: L.Map) {
    chokeMarkersRef.current.forEach((m) => map.removeLayer(m));
    chokeMarkersRef.current.clear();

    KIGALI_CHOKE_POINTS.forEach((cp) => {
      const isCritical = cp.severity === 'critical';
      const isHigh = cp.severity === 'high';
      const colorBg = isCritical ? '#e11d48' : isHigh ? '#d97706' : '#2563eb';

      const customIcon = L.divIcon({
        className: 'custom-choke-icon',
        html: `
          <div class="group relative flex items-center justify-center cursor-pointer">
            <div class="absolute -inset-2 rounded-full animate-ping opacity-40" style="background-color: ${colorBg};"></div>
            <div class="relative flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-bold shadow-lg border-2 border-white" style="background-color: ${colorBg};">
              <span>⚠️</span>
              <span>+${cp.avgDelayMinutes}m</span>
            </div>
          </div>
        `,
        iconSize: [60, 24],
        iconAnchor: [30, 12],
      });

      const marker = L.marker([cp.lat, cp.lng], { icon: customIcon }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px; max-width: 250px;">
          <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
            <strong style="color: ${colorBg}; font-size: 13px;">${cp.name}</strong>
          </div>
          <p style="font-size: 11px; color: #059669; font-weight: bold; margin: 0 0 6px 0;">${cp.kinyarwandaName}</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #f8fafc; padding: 6px; border-radius: 6px; margin-bottom: 6px; font-size: 11px;">
            <div>Speed: <strong>${cp.currentSpeedKmh} km/h</strong></div>
            <div>Delay: <strong style="color: #e11d48;">+${cp.avgDelayMinutes} min</strong></div>
          </div>
          <p style="font-size: 11px; margin: 0 0 4px 0; color: #334155;"><strong>Cause:</strong> ${cp.cause}</p>
          <p style="font-size: 11px; margin: 0; color: #0f766e;"><strong>EcoFleet:</strong> ${cp.ecofleetBypassRecommendation}</p>
        </div>
      `);

      marker.on('click', () => {
        if (onSelectChokePoint) onSelectChokePoint(cp);
      });

      chokeMarkersRef.current.set(cp.id, marker);
    });
  }

  function renderStops(map: L.Map) {
    stopMarkersRef.current.forEach((m) => map.removeLayer(m));
    stopMarkersRef.current.clear();

    KIGALI_BUS_STOPS.forEach((stop) => {
      const isBusPark = stop.isBusPark;
      const gareLabel = stop.kinyarwandaName ? stop.kinyarwandaName.split('/')[0].trim() : stop.name;

      const customIcon = L.divIcon({
        className: 'custom-stop-icon',
        html: isBusPark
          ? `
          <div class="group relative flex items-center justify-center cursor-pointer">
            <div class="absolute -inset-1 rounded-2xl ${stop.isEvChargingHub ? 'bg-emerald-500/40 animate-pulse' : 'bg-amber-400/30'}"></div>
            <div class="relative px-2 py-0.5 rounded-xl shadow-lg border flex items-center gap-1 transition-transform transform group-hover:scale-110 ${
              stop.isEvChargingHub
                ? 'bg-emerald-950 text-emerald-300 border-emerald-400'
                : 'bg-slate-900 text-amber-400 border-amber-500'
            }">
              <span class="text-[10px]">🏛️</span>
              <span class="text-[10px] font-mono font-bold whitespace-nowrap">${gareLabel}</span>
              ${stop.isEvChargingHub ? '<span class="text-[10px] text-emerald-300">⚡</span>' : ''}
            </div>
          </div>
        `
          : `
          <div class="group relative flex items-center justify-center cursor-pointer">
            <div class="w-3 h-3 rounded-full ${
              stop.isEvChargingHub ? 'bg-emerald-500 border border-white' : 'bg-slate-700 border border-slate-300'
            } shadow-sm group-hover:scale-125 transition"></div>
            <div class="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-medium px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap pointer-events-none z-50 border border-slate-700">
              ${stop.name}
            </div>
          </div>
        `,
        iconSize: isBusPark ? [110, 24] : [14, 14],
        iconAnchor: isBusPark ? [55, 12] : [7, 7],
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: customIcon }).addTo(map);
      marker.on('click', () => {
        onSelectStop(stop);
        map.flyTo([stop.lat, stop.lng], 15, { duration: 0.8 });
      });

      // Bind detailed popup
      marker.bindPopup(`
        <div class="p-1 text-slate-900 max-w-xs font-sans">
          <div class="flex items-center justify-between border-b pb-1 mb-1">
            <strong class="text-xs ${isBusPark ? 'text-amber-800' : 'text-slate-800'}">${stop.name}</strong>
            ${isBusPark ? '<span class="bg-amber-100 text-amber-800 text-[9px] px-1 py-0.2 rounded font-bold">GARE</span>' : ''}
          </div>
          <p class="text-[11px] text-emerald-800 font-mono font-semibold">${stop.kinyarwandaName || ''}</p>
          <p class="text-[11px] text-slate-600"><strong>Zone:</strong> ${stop.zone}</p>
          ${isBusPark && stop.bayCapacity ? `<p class="text-[11px] text-slate-700"><strong>Capacity:</strong> ${stop.bayCapacity} bus bays</p>` : ''}
          ${stop.popularLandmark ? `<p class="text-[11px] text-slate-600"><strong>Landmark:</strong> ${stop.popularLandmark}</p>` : ''}
          ${stop.connectingLines?.length ? `<p class="text-[11px] text-blue-700"><strong>Lines:</strong> ${stop.connectingLines.map((c: string) => `Line ${c}`).join(', ')}</p>` : ''}
          ${stop.isEvChargingHub ? '<div class="mt-1 p-1 bg-emerald-50 text-emerald-800 text-[10px] rounded font-bold">⚡ EcoFleet EV Supercharging Hub</div>' : ''}
        </div>
      `);

      stopMarkersRef.current.set(stop.id, marker);
    });
  }

  // Toggle Visibility for layers
  useEffect(() => {
    if (!mapRef.current) return;
    stopMarkersRef.current.forEach((marker) => {
      if (showStops) {
        if (!mapRef.current?.hasLayer(marker)) mapRef.current?.addLayer(marker);
      } else {
        if (mapRef.current?.hasLayer(marker)) mapRef.current?.removeLayer(marker);
      }
    });
  }, [showStops]);

  useEffect(() => {
    if (!mapRef.current) return;
    chokeMarkersRef.current.forEach((marker) => {
      if (showChokePoints) {
        if (!mapRef.current?.hasLayer(marker)) mapRef.current?.addLayer(marker);
      } else {
        if (mapRef.current?.hasLayer(marker)) mapRef.current?.removeLayer(marker);
      }
    });
  }, [showChokePoints]);

  useEffect(() => {
    if (!mapRef.current) return;
    corridorPolylinesRef.current.forEach((pl) => {
      if (showDedicatedLanes) {
        if (!mapRef.current?.hasLayer(pl)) mapRef.current?.addLayer(pl);
      } else {
        if (mapRef.current?.hasLayer(pl)) mapRef.current?.removeLayer(pl);
      }
    });
  }, [showDedicatedLanes]);

  // Update Live Buses Markers on Map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    buses.forEach((bus) => {
      const route = KIGALI_ROUTES.find((r) => r.id === bus.routeId);
      const isSelected = selectedBus?.id === bus.id;
      const operatorColor =
        bus.operator === 'EcoFleet' || bus.isElectric
          ? '#10b981'
          : bus.operator === 'KBS'
          ? '#2563eb'
          : bus.operator === 'Royal Express'
          ? '#dc2626'
          : '#059669';

      const iconHtml = `
        <div class="relative cursor-pointer transition-all duration-300 transform ${
          isSelected ? 'scale-125 z-40' : 'hover:scale-110 z-20'
        }">
          <div class="absolute -inset-2 rounded-full opacity-30 animate-pulse" style="background-color: ${operatorColor}"></div>
          
          <div class="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white font-bold text-xs shadow-xl border-2 ${
            isSelected ? 'border-amber-300 ring-4 ring-amber-400/30' : 'border-white'
          }" style="background-color: ${operatorColor}">
            <div style="transform: rotate(${bus.headingDeg}deg); transition: transform 0.5s ease-out;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L4 20L12 16L20 20L12 2Z"/>
              </svg>
            </div>
            
            <span class="tracking-tight font-mono text-[11px]">${bus.isElectric ? '⚡' : ''}${route?.code || 'BUS'}</span>
            <span class="text-[9px] font-medium bg-black/30 px-1 py-0.2 rounded">${bus.speedKmh}k</span>
          </div>

          <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 ${
            isSelected ? 'opacity-100' : 'opacity-0'
          } bg-slate-900 text-slate-100 text-[10px] font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap pointer-events-none border border-slate-700">
            ${bus.plateNumber}
          </div>
        </div>
      `;

      const busIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: iconHtml,
        iconSize: [80, 32],
        iconAnchor: [40, 16],
      });

      if (busMarkersRef.current.has(bus.id)) {
        const marker = busMarkersRef.current.get(bus.id)!;
        marker.setLatLng([bus.currentLat, bus.currentLng]);
        marker.setIcon(busIcon);
      } else {
        const marker = L.marker([bus.currentLat, bus.currentLng], { icon: busIcon }).addTo(map);
        marker.on('click', () => onSelectBus(bus));
        busMarkersRef.current.set(bus.id, marker);
      }
    });

    // Remove obsolete markers
    const currentBusIds = new Set(buses.map((b) => b.id));
    busMarkersRef.current.forEach((marker, id) => {
      if (!currentBusIds.has(id)) {
        map.removeLayer(marker);
        busMarkersRef.current.delete(id);
      }
    });
  }, [buses, selectedBus]);

  // Center on selected bus
  useEffect(() => {
    if (!mapRef.current || !selectedBus) return;
    mapRef.current.flyTo([selectedBus.currentLat, selectedBus.currentLng], 15, { duration: 0.6 });
  }, [selectedBus?.id]);

  // Center on selected stop
  useEffect(() => {
    if (!mapRef.current || !selectedStop) return;
    mapRef.current.flyTo([selectedStop.lat, selectedStop.lng], 15, { duration: 0.6 });
  }, [selectedStop?.id]);

  // Center on selected choke point
  useEffect(() => {
    if (!mapRef.current || !selectedChokePoint) return;
    mapRef.current.flyTo([selectedChokePoint.lat, selectedChokePoint.lng], 15, { duration: 0.6 });
  }, [selectedChokePoint?.id]);

  // User location marker
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping"></div>
            <div class="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
      }
    }
  }, [userLocation]);

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden">
      {/* Top Map Controls */}
      <div className="absolute top-4 left-4 right-4 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Network Pill */}
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-xl pointer-events-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
            <Leaf className="w-3.5 h-3.5" />
            <span>EcoFleet Network Map</span>
          </div>

          {activeRouteId ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-200 px-2 font-mono">
              <span>Line:</span>
              <span className="font-bold text-emerald-400">
                {KIGALI_ROUTES.find((r) => r.id === activeRouteId)?.code}
              </span>
            </div>
          ) : null}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-xl pointer-events-auto text-xs flex-wrap">
          {/* Map Style Switcher */}
          <select
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value as MapStyle)}
            className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="voyager">Carto Light</option>
            <option value="dark">Carto Dark</option>
            <option value="streets">OpenStreetMap</option>
            <option value="satellite">Satellite</option>
          </select>

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
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
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

          {/* Stops Toggle */}
          <button
            onClick={() => setShowStops(!showStops)}
            className={`px-2.5 py-1 rounded-xl font-medium transition flex items-center gap-1.5 ${
              showStops
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Stops</span>
          </button>

          {/* Locate Me */}
          <button
            onClick={onLocateUser}
            className="px-2.5 py-1 rounded-xl text-slate-300 hover:text-white bg-slate-950 border border-slate-800 hover:border-emerald-500 transition flex items-center gap-1"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Locate</span>
          </button>
        </div>
      </div>

      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 z-0" />

      {/* Bottom Floating Legend */}
      <div className="absolute bottom-4 left-4 z-[400] flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700 shadow-xl text-xs text-slate-300 flex-wrap">
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
    </div>
  );
}
