import React, { useState } from 'react';
import {
  AlertTriangle,
  Zap,
  Clock,
  Compass,
  Layers,
  ExternalLink,
  ShieldCheck,
  Navigation,
  ArrowRight,
  TrendingDown,
  Bus,
  CheckCircle2,
  Filter,
  Flame,
  Info,
  ChevronRight,
  Radio,
  Gauge,
  BatteryCharging,
  Leaf,
  Globe,
  MapPin,
  Building2,
  Users,
  Search,
} from 'lucide-react';
import { TransitChokePoint, DedicatedBusCorridor, BusTelemetry, ChokePointSeverity, BusStop } from '../types';
import { KIGALI_CHOKE_POINTS, KIGALI_DEDICATED_BUS_LANES, KIGALI_BUS_STOPS } from '../data/kigaliTransitData';

interface EcoFleetNetworkMapPanelProps {
  buses: BusTelemetry[];
  selectedChokePoint: TransitChokePoint | null;
  onSelectChokePoint: (chokePoint: TransitChokePoint | null) => void;
  onFocusCoordinates: (lat: number, lng: number) => void;
  onSelectStop?: (stop: BusStop | null) => void;
}

export default function EcoFleetNetworkMapPanel({
  buses,
  selectedChokePoint,
  onSelectChokePoint,
  onFocusCoordinates,
  onSelectStop,
}: EcoFleetNetworkMapPanelProps) {
  const [activeTab, setActiveTab] = useState<'bus_parks' | 'all_stops' | 'chokepoints' | 'corridors' | 'electric_fleet' | 'ecofleet_web'>('bus_parks');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'moderate'>('all');
  const [districtFilter, setDistrictFilter] = useState<'all' | 'Nyarugenge' | 'Gasabo' | 'Kicukiro' | 'Outer Kigali'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const busParks = KIGALI_BUS_STOPS.filter((s) => s.isBusPark);

  const filteredBusParks = busParks.filter((park) => {
    if (districtFilter !== 'all' && park.district !== districtFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        park.name.toLowerCase().includes(q) ||
        (park.kinyarwandaName && park.kinyarwandaName.toLowerCase().includes(q)) ||
        (park.popularLandmark && park.popularLandmark.toLowerCase().includes(q)) ||
        (park.connectingLines && park.connectingLines.some((l) => l.includes(q)))
      );
    }
    return true;
  });

  const filteredAllStops = KIGALI_BUS_STOPS.filter((stop) => {
    if (districtFilter !== 'all' && stop.district !== districtFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        stop.name.toLowerCase().includes(q) ||
        (stop.kinyarwandaName && stop.kinyarwandaName.toLowerCase().includes(q)) ||
        (stop.popularLandmark && stop.popularLandmark.toLowerCase().includes(q)) ||
        (stop.connectingLines && stop.connectingLines.some((l) => l.includes(q)))
      );
    }
    return true;
  });

  const filteredChokePoints = KIGALI_CHOKE_POINTS.filter((cp) => {
    if (severityFilter !== 'all' && cp.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        cp.name.toLowerCase().includes(q) ||
        cp.kinyarwandaName.toLowerCase().includes(q) ||
        cp.corridorName.toLowerCase().includes(q) ||
        cp.affectedLines.some((l) => l.includes(q))
      );
    }
    return true;
  });

  const electricBuses = buses.filter((b) => b.isElectric || b.operator === 'EcoFleet');
  const totalCo2Saved = electricBuses.reduce((acc, b) => acc + (b.co2SavedKg || 120), 0);

  const getSeverityBadge = (severity: ChokePointSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
            Critical Bottleneck
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            High Congestion
          </span>
        );
      case 'moderate':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/20 border border-blue-500/40 text-blue-300">
            Moderate Flow
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
            Clear Corridor
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden border-r border-slate-800">
      {/* Header Banner with EcoFleet RW Branding */}
      <div className="p-4 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border-b border-emerald-500/20">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">EcoFleet Rwanda</h2>
                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-md text-[10px] font-mono font-bold">
                  KIGALI TRANSIT 2026
                </span>
              </div>
              <p className="text-[11px] text-emerald-300/80">Bus Parks, Stops, Priority Corridors & Choke Points</p>
            </div>
          </div>

          <a
            href="https://ecofleet.rw/network-map-2/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-slate-800 hover:bg-emerald-600/30 text-emerald-300 rounded-xl border border-emerald-500/30 transition flex items-center gap-1 text-xs shrink-0"
            title="Open official EcoFleet Network Map"
          >
            <span className="hidden sm:inline text-[11px] font-medium">ecofleet.rw</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Quick Multi-Tab Switcher */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-[11px]">
          <button
            onClick={() => setActiveTab('bus_parks')}
            className={`py-1.5 px-1 rounded-lg font-medium transition flex items-center justify-center gap-1 ${
              activeTab === 'bus_parks'
                ? 'bg-amber-600 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="truncate">Gares ({busParks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('all_stops')}
            className={`py-1.5 px-1 rounded-lg font-medium transition flex items-center justify-center gap-1 ${
              activeTab === 'all_stops'
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">Stops ({KIGALI_BUS_STOPS.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('chokepoints')}
            className={`py-1.5 px-1 rounded-lg font-medium transition flex items-center justify-center gap-1 ${
              activeTab === 'chokepoints'
                ? 'bg-rose-600 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="truncate">Choke</span>
          </button>

          <button
            onClick={() => setActiveTab('corridors')}
            className={`py-1.5 px-1 rounded-lg font-medium transition flex items-center justify-center gap-1 ${
              activeTab === 'corridors'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="truncate">Lanes</span>
          </button>

          <button
            onClick={() => setActiveTab('electric_fleet')}
            className={`py-1.5 px-1 rounded-lg font-medium transition flex items-center justify-center gap-1 ${
              activeTab === 'electric_fleet'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate">EV Fleet</span>
          </button>

          <button
            onClick={() => setActiveTab('ecofleet_web')}
            className={`py-1.5 px-1 rounded-lg font-medium transition flex items-center justify-center gap-1 ${
              activeTab === 'ecofleet_web'
                ? 'bg-slate-700 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="truncate">Web</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Search Bar & District Filters for Stops and Parks */}
        {(activeTab === 'bus_parks' || activeTab === 'all_stops') && (
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bus park, gare, stop, landmark (Nyabugogo, Remera, CHUK...)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-500 text-[11px] flex items-center gap-1 pl-1">
                <Filter className="w-3 h-3" /> District:
              </span>
              {(['all', 'Nyarugenge', 'Gasabo', 'Kicukiro', 'Outer Kigali'] as const).map((dist) => (
                <button
                  key={dist}
                  onClick={() => setDistrictFilter(dist)}
                  className={`px-2 py-0.5 rounded-lg font-medium text-[11px] whitespace-nowrap transition ${
                    districtFilter === dist
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {dist === 'all' ? 'All Districts' : dist}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: BUS PARKS (GARES) */}
        {activeTab === 'bus_parks' && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-2xl flex items-start gap-2.5">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs text-amber-300">Kigali City Major Bus Parks & Terminals (Gares)</h4>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  Official multi-bay passenger bus parks connecting intra-city trunk routes, inter-district feeders, Tap&Go agents, and EcoFleet EV fast-charging stations.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredBusParks.map((park) => (
                <div
                  key={park.id}
                  onClick={() => {
                    if (onSelectStop) onSelectStop(park);
                    onFocusCoordinates(park.lat, park.lng);
                  }}
                  className="p-3.5 rounded-2xl bg-slate-950/70 border border-amber-500/30 hover:border-amber-400/60 hover:bg-slate-950 transition cursor-pointer text-left shadow-md"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">🏛️</span>
                        <h4 className="font-bold text-sm text-white">{park.name}</h4>
                      </div>
                      <p className="text-[11px] text-amber-400 font-mono font-semibold mt-0.5">
                        {park.kinyarwandaName}
                      </p>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300">
                      {park.bayCapacity ? `${park.bayCapacity} Bays` : 'Bus Park'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800 text-xs mb-2">
                    <div>
                      <span className="text-[10px] text-slate-500">Zone / District</span>
                      <p className="font-medium text-slate-200 text-[11px]">{park.district || park.zone}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Daily Commuter Volume</span>
                      <p className="font-bold text-emerald-400 text-[11px]">{park.dailyPassengerVolume || '30,000+ / day'}</p>
                    </div>
                  </div>

                  {park.popularLandmark && (
                    <p className="text-xs text-slate-400 mb-2">
                      <span className="text-slate-500">Landmark: </span>
                      {park.popularLandmark}
                    </p>
                  )}

                  {park.connectingLines && park.connectingLines.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      <span className="text-[10px] text-slate-500 mr-1">Lines:</span>
                      {park.connectingLines.map((line) => (
                        <span
                          key={line}
                          className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-700/50 text-[10px] font-mono font-bold"
                        >
                          Line {line}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {park.facilities.map((fac) => (
                      <span
                        key={fac}
                        className="px-1.5 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800 text-[10px]"
                      >
                        {fac}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectStop) onSelectStop(park);
                      onFocusCoordinates(park.lat, park.lng);
                    }}
                    className="w-full py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Focus {park.kinyarwandaName?.split('/')[0] || park.name} on Map</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: ALL BUS STOPS */}
        {activeTab === 'all_stops' && (
          <div className="space-y-3">
            <div className="p-3 bg-blue-950/20 border border-blue-500/30 rounded-2xl flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs text-blue-300">Complete Kigali Transit Stops Directory</h4>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  All mapped bus stops, waypoints, and shelters across Kigali's sectors with GPS precision.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {filteredAllStops.map((stop) => (
                <div
                  key={stop.id}
                  onClick={() => {
                    if (onSelectStop) onSelectStop(stop);
                    onFocusCoordinates(stop.lat, stop.lng);
                  }}
                  className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-blue-500/50 transition cursor-pointer text-left"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className={`w-3.5 h-3.5 ${stop.isBusPark ? 'text-amber-400' : 'text-blue-400'}`} />
                        <h4 className="font-bold text-xs text-white">{stop.name}</h4>
                      </div>
                      <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                        {stop.kinyarwandaName}
                      </p>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-400 border border-slate-800">
                      {stop.district || stop.zone}
                    </span>
                  </div>

                  {stop.popularLandmark && (
                    <p className="text-[11px] text-slate-400 mb-1.5">{stop.popularLandmark}</p>
                  )}

                  {stop.connectingLines && stop.connectingLines.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mb-1.5">
                      <span className="text-[10px] text-slate-500 mr-1">Lines:</span>
                      {stop.connectingLines.map((line) => (
                        <span
                          key={line}
                          className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-mono"
                        >
                          {line}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[11px] text-slate-500">
                    <span>GPS: {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</span>
                    <span className="text-blue-400 font-medium hover:underline">View on map →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: TRANSIT CHOKE POINTS */}
        {activeTab === 'chokepoints' && (
          <div className="space-y-3">
            {/* Filter & Search Bar */}
            <div className="space-y-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bottleneck (Nyabugogo, Sonatubes, Line 101...)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-500 text-[11px] flex items-center gap-1 pl-1">
                  <Filter className="w-3 h-3" /> Filter:
                </span>
                {(['all', 'critical', 'high', 'moderate'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2.5 py-1 rounded-lg font-medium capitalize text-[11px] transition ${
                      severityFilter === sev
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Choke Points Cards */}
            <div className="space-y-2.5">
              {filteredChokePoints.map((cp) => {
                const isSelected = selectedChokePoint?.id === cp.id;
                return (
                  <div
                    key={cp.id}
                    onClick={() => {
                      onSelectChokePoint(cp);
                      onFocusCoordinates(cp.lat, cp.lng);
                    }}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle
                            className={`w-4 h-4 ${
                              cp.severity === 'critical'
                                ? 'text-rose-400 animate-pulse'
                                : cp.severity === 'high'
                                ? 'text-amber-400'
                                : 'text-blue-400'
                            }`}
                          />
                          <h3 className="font-bold text-sm text-slate-100">{cp.name}</h3>
                        </div>
                        <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                          {cp.kinyarwandaName}
                        </p>
                      </div>
                      {getSeverityBadge(cp.severity)}
                    </div>

                    <p className="text-xs text-slate-400 mb-2 leading-relaxed">{cp.corridorName}</p>

                    {/* Bottleneck telemetry pills */}
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 p-2 rounded-xl border border-slate-800 mb-2.5 text-center">
                      <div>
                        <p className="text-[10px] text-slate-500">Live Speed</p>
                        <p className="text-xs font-bold text-slate-200 font-mono">{cp.currentSpeedKmh} km/h</p>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-500">Avg Delay</p>
                        <p className="text-xs font-bold text-rose-400 font-mono">+{cp.avgDelayMinutes} min</p>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-500">Peak Window</p>
                        <p className="text-[10px] font-medium text-amber-300 font-mono truncate">{cp.peakHours}</p>
                      </div>
                    </div>

                    {/* Cause & Bypass */}
                    <div className="space-y-1.5 text-xs">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-400 font-medium text-[11px]">Primary Cause: </span>
                        <p className="text-slate-200 text-[11px] mt-0.5 leading-relaxed">{cp.cause}</p>
                      </div>

                      <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
                        <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> EcoFleet Dynamic Bypass:
                        </span>
                        <p className="text-emerald-200 text-[11px] mt-0.5 leading-relaxed">
                          {cp.ecofleetBypassRecommendation}
                        </p>
                      </div>
                    </div>

                    {/* Affected lines */}
                    <div className="mt-2.5 flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-slate-500 mr-1">Impacted Lines:</span>
                      {cp.affectedLines.map((line) => (
                        <span
                          key={line}
                          className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-mono"
                        >
                          Line {line}
                        </span>
                      ))}
                    </div>

                    {/* Focus on map CTA */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectChokePoint(cp);
                        onFocusCoordinates(cp.lat, cp.lng);
                      }}
                      className="mt-2.5 w-full py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>Pan to Bottleneck on Active Map</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: DEDICATED BUS PRIORITY LANES */}
        {activeTab === 'corridors' && (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-xs text-white">City of Kigali & RURA Dedicated Bus Lanes</h3>
              </div>
              <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                Dedicated right-of-way transit lanes reserved for public transit buses during morning (06:00 - 07:00) and evening (17:00 - 21:00) rush hours to bypass vehicle congestion.
              </p>
            </div>

            <div className="space-y-2.5">
              {KIGALI_DEDICATED_BUS_LANES.map((lane) => (
                <div
                  key={lane.id}
                  className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-bold text-sm text-slate-100">{lane.name}</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                      {lane.enforcementStatus}
                    </span>
                  </div>

                  {lane.kinyarwandaName && (
                    <p className="text-[11px] text-slate-400 font-mono mb-2">{lane.kinyarwandaName}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800 mb-2.5 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-500">Active Peak Hours</p>
                      <p className="font-semibold text-amber-300 font-mono text-[11px]">{lane.peakHours}</p>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-500">Average Commuter Time Saved</p>
                      <p className="font-bold text-emerald-400 font-mono text-[11px]">
                        Up to {lane.timeSavedMinutes} min / trip
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mb-2.5 leading-relaxed">{lane.description}</p>

                  <button
                    onClick={() => {
                      const firstPoint = lane.waypoints[0];
                      if (firstPoint) onFocusCoordinates(firstPoint[0], firstPoint[1]);
                    }}
                    className="w-full py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>View Corridor on Map</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: ELECTRIC BUS FLEET */}
        {activeTab === 'electric_fleet' && (
          <div className="space-y-3">
            {/* Green Statistics Card */}
            <div className="p-3.5 bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white">Kigali 2026 E-Mobility Transition</h3>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                  Zero Emissions
                </span>
              </div>

              <p className="text-xs text-emerald-300/80">
                EcoFleet is deploying 100% electric transit buses across Kigali trunk lines to reduce carbon emissions, cut travel times, and provide clean urban transit.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 text-center">
                  <p className="text-[10px] text-slate-400">Total CO₂ Saved Today</p>
                  <p className="text-lg font-bold text-emerald-400 font-mono">{totalCo2Saved} kg</p>
                </div>

                <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 text-center">
                  <p className="text-[10px] text-slate-400">Active EV Charging Hubs</p>
                  <p className="text-lg font-bold text-amber-400 font-mono">4 Stations</p>
                </div>
              </div>
            </div>

            {/* List of Electric Buses */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1">
                Active EcoFleet Electric Buses
              </h4>

              {electricBuses.map((bus) => (
                <div
                  key={bus.id}
                  className="p-3 rounded-2xl bg-slate-950 border border-emerald-500/30 hover:border-emerald-500/60 transition"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold text-xs">
                        ⚡
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-white">
                          {bus.fleetNumber} ({bus.plateNumber})
                        </h5>
                        <p className="text-[10px] text-emerald-400">Driver: {bus.driverName}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-400">
                        <BatteryCharging className="w-3.5 h-3.5" />
                        <span>{bus.batterySocPercent ?? 85}%</span>
                      </div>
                      <span className="text-[10px] text-slate-500">State of Charge</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800 text-slate-400">
                    <span>Speed: <strong className="text-slate-200">{bus.speedKmh} km/h</strong></span>
                    <span>Saved: <strong className="text-emerald-400">{bus.co2SavedKg || 150} kg CO₂</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: ECOFLEET & BISI WEB PORTALS */}
        {activeTab === 'ecofleet_web' && (
          <div className="space-y-3">
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  Bisi EcoFleet Live Route Engine
                </h3>
                <a
                  href="https://bisi.ecofleet.rw/routes?originLat=-1.9161451665462494&originLon=30.108023363258337&destLat=-1.9496877105749941&destLon=30.125646754194296&from=Current+Location&to=Kimironko&routeId=489"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                >
                  Open Line 309 Live <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                EcoFleet Bisi route intelligence: Line <strong className="text-emerald-400">309</strong> (Bisi ID 489) connects <strong className="text-slate-200">Gare ya Kimironko</strong> (-1.949688, 30.125647) to <strong className="text-slate-200">Gare ya Kinyinya</strong> (-1.916145, 30.108023) via Kibagabaga Hospital.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="https://bisi.ecofleet.rw/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-medium hover:bg-emerald-500/30 flex items-center gap-1"
                >
                  bisi.ecofleet.rw <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <a
                  href="https://ecofleet.rw/network-map-2/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-medium hover:bg-slate-700 flex items-center gap-1"
                >
                  ecofleet.rw/network-map-2 <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>

            <div className="w-full h-96 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 relative">
              <iframe
                src="https://ecofleet.rw/network-map-2/"
                title="EcoFleet Rwanda Network Map"
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
