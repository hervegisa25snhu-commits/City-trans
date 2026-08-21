import { useState } from 'react';
import { BusTelemetry, TransitOperator } from '../types';
import { KIGALI_ROUTES, KIGALI_BUS_STOPS } from '../data/kigaliTransitData';
import { Search, Bus as BusIcon, Wifi, Wind, ShieldAlert, ArrowRight, Gauge, Users, Clock, Filter } from 'lucide-react';
import { formatEta } from '../utils/geoUtils';

interface BusListPanelProps {
  buses: BusTelemetry[];
  selectedBus: BusTelemetry | null;
  activeRouteId: string | null;
  onSelectBus: (bus: BusTelemetry) => void;
  onSelectRoute: (routeId: string | null) => void;
}

export default function BusListPanel({
  buses,
  selectedBus,
  activeRouteId,
  onSelectBus,
  onSelectRoute,
}: BusListPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<TransitOperator | 'ALL'>('ALL');

  const filteredBuses = buses.filter((bus) => {
    const route = KIGALI_ROUTES.find((r) => r.id === bus.routeId);
    const matchesRoute = !activeRouteId || bus.routeId === activeRouteId;
    const matchesOperator = selectedOperator === 'ALL' || bus.operator === selectedOperator;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      bus.plateNumber.toLowerCase().includes(query) ||
      bus.fleetNumber.toLowerCase().includes(query) ||
      route?.name.toLowerCase().includes(query) ||
      route?.code.toLowerCase().includes(query) ||
      bus.driverName.toLowerCase().includes(query);

    return matchesRoute && matchesOperator && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <BusIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Live Kigali Fleet</h2>
              <p className="text-xs text-slate-400">
                {filteredBuses.length} active vehicle{filteredBuses.length !== 1 ? 's' : ''} tracked via GPS
              </p>
            </div>
          </div>

          {activeRouteId && (
            <button
              onClick={() => onSelectRoute(null)}
              className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/20 transition font-medium"
            >
              Clear Route Filter
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search line (e.g. 101), plate, or driver..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
          />
        </div>

        {/* Route Pills & Operator Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedOperator('ALL')}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
              selectedOperator === 'ALL'
                ? 'bg-slate-700 text-white shadow'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Operators
          </button>
          <button
            onClick={() => setSelectedOperator('KBS')}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
              selectedOperator === 'KBS'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-800/60 text-blue-400 hover:bg-slate-800'
            }`}
          >
            KBS
          </button>
          <button
            onClick={() => setSelectedOperator('Royal Express')}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
              selectedOperator === 'Royal Express'
                ? 'bg-red-600 text-white shadow'
                : 'bg-slate-800/60 text-red-400 hover:bg-slate-800'
            }`}
          >
            Royal Express
          </button>
          <button
            onClick={() => setSelectedOperator('RFTC')}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
              selectedOperator === 'RFTC'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-800/60 text-emerald-400 hover:bg-slate-800'
            }`}
          >
            RFTC
          </button>
        </div>

        {/* Kigali Routes Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Routes:</span>
          {KIGALI_ROUTES.map((route) => {
            const isSelected = activeRouteId === route.id;
            return (
              <button
                key={route.id}
                onClick={() => onSelectRoute(isSelected ? null : route.id)}
                className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold transition whitespace-nowrap border ${
                  isSelected
                    ? 'text-white shadow'
                    : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
                style={{
                  backgroundColor: isSelected ? route.color : undefined,
                  borderColor: isSelected ? route.color : undefined,
                }}
              >
                Line {route.code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bus List Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-800/40">
        {filteredBuses.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <BusIcon className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-medium">No buses match your filter</p>
            <p className="text-xs text-slate-500">Try adjusting your operator or route selection</p>
          </div>
        ) : (
          filteredBuses.map((bus) => {
            const route = KIGALI_ROUTES.find((r) => r.id === bus.routeId);
            const nextStop = KIGALI_BUS_STOPS.find((s) => s.id === bus.nextStopId);
            const isSelected = selectedBus?.id === bus.id;

            const occupancyBg =
              bus.occupancy === 'low'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : bus.occupancy === 'medium'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : bus.occupancy === 'high'
                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

            return (
              <div
                key={bus.id}
                onClick={() => onSelectBus(bus)}
                className={`pt-2.5 first:pt-0 cursor-pointer rounded-xl p-3 transition-all ${
                  isSelected
                    ? 'bg-blue-950/40 border-2 border-blue-500/60 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-950/40 hover:bg-slate-800/50 border border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Header: Route Badge, Plate, Operator */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2.5 py-1 rounded-lg text-white font-mono font-bold text-xs shadow-sm"
                      style={{ backgroundColor: route?.color || '#3b82f6' }}
                    >
                      Line {route?.code || '101'}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-200 font-mono tracking-tight">
                        {bus.plateNumber}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {bus.operator} • {bus.fleetNumber}
                      </div>
                    </div>
                  </div>

                  {/* Occupancy Badge */}
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${occupancyBg}`}
                  >
                    {bus.occupancy === 'full' ? 'Standing Only' : `${bus.occupancy} Load`}
                  </span>
                </div>

                {/* Route Name */}
                <div className="text-xs text-slate-300 font-medium truncate mb-2">
                  {route?.name}
                </div>

                {/* Telemetry Row: Speed, Next Stop, ETA */}
                <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Gauge className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>
                      <strong className="text-slate-100 font-mono">{bus.speedKmh}</strong> km/h
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Next: <strong className="text-amber-300">{formatEta(bus.etaToNextStopSec)}</strong>
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-800/40 text-slate-400 text-[10px]">
                    <span className="truncate">Approaching: <strong className="text-slate-200">{nextStop?.name || 'Kigali Hub'}</strong></span>
                    <span className="font-mono text-emerald-400">{bus.passengerCount}/{bus.capacity} pax</span>
                  </div>
                </div>

                {/* Feature Icons */}
                <div className="flex items-center justify-between mt-2 pt-1.5 text-[10px] text-slate-400">
                  <div className="flex items-center gap-2">
                    {bus.hasWifi && (
                      <span className="flex items-center gap-0.5 text-blue-400">
                        <Wifi className="w-3 h-3" /> WiFi
                      </span>
                    )}
                    {bus.hasAirConditioning && (
                      <span className="flex items-center gap-0.5 text-cyan-400">
                        <Wind className="w-3 h-3" /> AC
                      </span>
                    )}
                    {bus.delayMinutes > 0 ? (
                      <span className="text-amber-400 font-medium">+{bus.delayMinutes}m delay</span>
                    ) : (
                      <span className="text-emerald-400 font-medium">On Schedule</span>
                    )}
                  </div>

                  <button className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-0.5">
                    Track <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
