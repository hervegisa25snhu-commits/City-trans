import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { BusTelemetry, BusStop, TransitRoute } from '../types';
import { KIGALI_BUS_STOPS, KIGALI_ROUTES } from '../data/kigaliTransitData';
import { MapPin, Navigation, Layers, Compass, Eye, Volume2, ShieldCheck, Bus as BusIcon, Radio } from 'lucide-react';

interface InteractiveMapProps {
  buses: BusTelemetry[];
  selectedBus: BusTelemetry | null;
  selectedStop: BusStop | null;
  activeRouteId: string | null;
  onSelectBus: (bus: BusTelemetry | null) => void;
  onSelectStop: (stop: BusStop | null) => void;
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
  activeRouteId,
  onSelectBus,
  onSelectStop,
  userLocation,
  onLocateUser,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const busMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const stopMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>('voyager');
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);
  const [showStops, setShowStops] = useState(true);

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

    // Initial render of route polylines
    renderRoutes(map, activeRouteId);
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

  // Update Route Polylines when activeRouteId changes
  useEffect(() => {
    if (!mapRef.current) return;
    renderRoutes(mapRef.current, activeRouteId);
  }, [activeRouteId]);

  function renderRoutes(map: L.Map, highlightedRouteId: string | null) {
    // Clear previous polylines
    polylinesRef.current.forEach((pl) => map.removeLayer(pl));
    polylinesRef.current.clear();

    KIGALI_ROUTES.forEach((route) => {
      const isHighlighted = !highlightedRouteId || highlightedRouteId === route.id;
      const opacity = isHighlighted ? (highlightedRouteId ? 0.95 : 0.6) : 0.15;
      const weight = isHighlighted ? (highlightedRouteId ? 6 : 4) : 2;

      const polyline = L.polyline(route.waypoints, {
        color: route.color,
        weight,
        opacity,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: !isHighlighted ? '4, 8' : undefined,
      }).addTo(map);

      polyline.on('click', () => {
        // Find first bus on this route and select it
        const firstBus = buses.find((b) => b.routeId === route.id);
        if (firstBus) onSelectBus(firstBus);
      });

      polylinesRef.current.set(route.id, polyline);
    });
  }

  function renderStops(map: L.Map) {
    stopMarkersRef.current.forEach((m) => map.removeLayer(m));
    stopMarkersRef.current.clear();

    KIGALI_BUS_STOPS.forEach((stop) => {
      const isMajorTerminal =
        stop.id === 'stop_downtown' ||
        stop.id === 'stop_nyabugogo' ||
        stop.id === 'stop_kimironko' ||
        stop.id === 'stop_remera_giporoso';

      const customIcon = L.divIcon({
        className: 'custom-stop-icon',
        html: `
          <div class="group relative flex items-center justify-center cursor-pointer">
            <div class="absolute -inset-1 rounded-full ${
              isMajorTerminal ? 'bg-amber-400/40 animate-ping' : 'bg-slate-400/20'
            }"></div>
            <div class="relative w-5 h-5 rounded-full ${
              isMajorTerminal ? 'bg-amber-500 border-2 border-white' : 'bg-slate-800 border border-slate-300'
            } flex items-center justify-center text-[10px] text-white shadow-md transition-transform transform group-hover:scale-125">
              <span class="font-bold">${isMajorTerminal ? '★' : '•'}</span>
            </div>
            <div class="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 backdrop-blur text-white text-[11px] font-semibold px-2 py-0.5 rounded shadow-lg whitespace-nowrap pointer-events-none z-50 border border-slate-700">
              ${stop.name}
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: customIcon }).addTo(map);
      marker.on('click', () => {
        onSelectStop(stop);
        map.flyTo([stop.lat, stop.lng], 15, { duration: 0.8 });
      });

      stopMarkersRef.current.set(stop.id, marker);
    });
  }

  // Toggle Stops visibility
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

  // Update Live Buses Markers on Map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    buses.forEach((bus) => {
      const route = KIGALI_ROUTES.find((r) => r.id === bus.routeId);
      const isSelected = selectedBus?.id === bus.id;
      const operatorColor =
        bus.operator === 'KBS' ? '#2563eb' : bus.operator === 'Royal Express' ? '#dc2626' : '#059669';

      const occupancyBadge =
        bus.occupancy === 'low'
          ? 'bg-emerald-500 text-white'
          : bus.occupancy === 'medium'
          ? 'bg-amber-500 text-white'
          : bus.occupancy === 'high'
          ? 'bg-orange-500 text-white'
          : 'bg-rose-600 text-white';

      const iconHtml = `
        <div class="relative cursor-pointer transition-all duration-300 transform ${
          isSelected ? 'scale-125 z-40' : 'hover:scale-110 z-20'
        }">
          <!-- Direction Cone / Pulse -->
          <div class="absolute -inset-2 rounded-full opacity-30 animate-pulse" style="background-color: ${operatorColor}"></div>
          
          <!-- Bus Pill Marker -->
          <div class="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white font-bold text-xs shadow-xl border-2 ${
            isSelected ? 'border-amber-300 ring-4 ring-amber-400/30' : 'border-white'
          }" style="background-color: ${operatorColor}">
            <!-- Bus Heading Arrow Icon -->
            <div style="transform: rotate(${bus.headingDeg}deg); transition: transform 0.5s ease-out;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L4 20L12 16L20 20L12 2Z"/>
              </svg>
            </div>
            
            <span class="tracking-tight font-mono text-[11px]">${route?.code || 'BUS'}</span>
            
            <!-- Speed Tag -->
            <span class="text-[9px] font-medium bg-black/30 px-1 py-0.2 rounded">${bus.speedKmh}k</span>
          </div>

          <!-- Operator & Plate Tag on Hover / Selected -->
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
        marker.on('click', () => {
          onSelectBus(bus);
          map.flyTo([bus.currentLat, bus.currentLng], 15, { duration: 0.7 });
        });
        busMarkersRef.current.set(bus.id, marker);
      }
    });

    // Cleanup markers of buses that no longer exist
    const currentBusIds = new Set(buses.map((b) => b.id));
    busMarkersRef.current.forEach((marker, id) => {
      if (!currentBusIds.has(id)) {
        map.removeLayer(marker);
        busMarkersRef.current.delete(id);
      }
    });
  }, [buses, selectedBus]);

  // Handle Selected Bus Pan
  useEffect(() => {
    if (!mapRef.current || !selectedBus) return;
    mapRef.current.flyTo([selectedBus.currentLat, selectedBus.currentLng], 15, {
      duration: 0.6,
    });
  }, [selectedBus?.id]);

  // Update User Location Marker
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
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
      }
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.9 });
    }
  }, [userLocation]);

  return (
    <div className="relative w-full h-full min-h-[400px] overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
      {/* Leaflet Map DOM Node */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Floating Map Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-auto">
        {/* Quick Hub Jump Selector */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-xl text-xs text-slate-200">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-slate-300 mr-1">Quick Hub:</span>
          <button
            onClick={() => mapRef.current?.flyTo([-1.9441, 30.0619], 15)}
            className="hover:text-amber-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition"
          >
            CBD
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => mapRef.current?.flyTo([-1.9392, 30.0446], 15)}
            className="hover:text-amber-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition"
          >
            Nyabugogo
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => mapRef.current?.flyTo([-1.9543, 30.1259], 15)}
            className="hover:text-amber-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition"
          >
            Kimironko
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => mapRef.current?.flyTo([-1.9587, 30.1141], 15)}
            className="hover:text-amber-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition"
          >
            Remera
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => mapRef.current?.flyTo([-1.9686, 30.1395], 15)}
            className="hover:text-amber-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition"
          >
            Airport
          </button>
        </div>

        {/* Live GPS Telemetry Pulse Pill */}
        <div className="flex items-center gap-2 bg-emerald-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-500/40 shadow-xl text-xs text-emerald-300 font-mono font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>{buses.length} Kigali Buses Live</span>
        </div>
      </div>

      {/* Right Floating Controls: Style Switcher, Locate Me, Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 pointer-events-auto">
        {/* Locate Passenger GPS */}
        <button
          onClick={onLocateUser}
          title="Locate my position in Kigali"
          className="p-2.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-slate-200 hover:text-blue-400 hover:bg-slate-800 shadow-xl transition active:scale-95 flex items-center justify-center"
        >
          <Navigation className="w-4 h-4" />
        </button>

        {/* Reset View to Full Kigali */}
        <button
          onClick={() => mapRef.current?.flyTo([-1.9441, 30.0619], 13, { duration: 0.8 })}
          title="Reset to Full Kigali Overview"
          className="p-2.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-slate-200 hover:text-amber-400 hover:bg-slate-800 shadow-xl transition active:scale-95 flex items-center justify-center"
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Map Layers Dropdown / Style Switcher */}
        <div className="bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-xl flex flex-col gap-1 text-[11px]">
          {(['voyager', 'dark', 'streets', 'satellite'] as MapStyle[]).map((style) => (
            <button
              key={style}
              onClick={() => setMapStyle(style)}
              className={`px-2 py-1 rounded text-left capitalize transition font-medium ${
                mapStyle === style
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {style}
            </button>
          ))}
        </div>

        {/* Toggle Bus Stops */}
        <button
          onClick={() => setShowStops(!showStops)}
          title={showStops ? 'Hide Bus Stops' : 'Show Bus Stops'}
          className={`p-2.5 rounded-xl backdrop-blur-md border shadow-xl transition flex items-center justify-center ${
            showStops
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-slate-900/90 border-slate-700/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
        </button>
      </div>

      {/* Map Bottom Legend */}
      <div className="absolute bottom-3 right-3 z-10 hidden sm:flex items-center gap-3 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-xl text-[11px] text-slate-300 pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
          <span>KBS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
          <span>Royal Express</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
          <span>RFTC</span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-slate-700 pl-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
          <span>Major Terminal</span>
        </div>
      </div>
    </div>
  );
}
