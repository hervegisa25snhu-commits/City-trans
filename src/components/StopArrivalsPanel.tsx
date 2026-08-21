import { useState, useMemo } from 'react';
import { BusStop, BusTelemetry, StopArrivalPrediction } from '../types';
import { KIGALI_BUS_STOPS, KIGALI_ROUTES } from '../data/kigaliTransitData';
import { calculateDistanceKm, formatDistance, formatEta } from '../utils/geoUtils';
import { MapPin, Clock, ArrowRight, ShieldCheck, Bus, Sparkles, Navigation, CheckCircle2 } from 'lucide-react';

interface StopArrivalsPanelProps {
  selectedStop: BusStop | null;
  buses: BusTelemetry[];
  userLocation: { lat: number; lng: number } | null;
  onSelectStop: (stop: BusStop) => void;
  onSelectBus: (bus: BusTelemetry) => void;
}

export default function StopArrivalsPanel({
  selectedStop,
  buses,
  userLocation,
  onSelectStop,
  onSelectBus,
}: StopArrivalsPanelProps) {
  const currentStop = selectedStop || KIGALI_BUS_STOPS[0];

  // Calculate upcoming arrivals for the selected stop
  const arrivals: StopArrivalPrediction[] = useMemo(() => {
    const list: StopArrivalPrediction[] = [];

    buses.forEach((bus) => {
      const route = KIGALI_ROUTES.find((r) => r.id === bus.routeId);
      if (!route || !route.stopIds.includes(currentStop.id)) return;

      const distanceKm = calculateDistanceKm(
        bus.currentLat,
        bus.currentLng,
        currentStop.lat,
        currentStop.lng
      );

      // Estimate time based on distance and bus speed
      const speed = Math.max(15, bus.speedKmh);
      const estSeconds = Math.round((distanceKm / speed) * 3600) + bus.delayMinutes * 60;

      list.push({
        busId: bus.id,
        plateNumber: bus.plateNumber,
        routeCode: route.code,
        routeName: route.name,
        operator: bus.operator,
        routeColor: route.color,
        destinationName: route.destinationName,
        etaMinutes: Math.round(estSeconds / 60),
        etaSeconds: estSeconds,
        occupancy: bus.occupancy,
        delayMinutes: bus.delayMinutes,
        distanceKm,
      });
    });

    return list.sort((a, b) => a.etaSeconds - b.etaSeconds);
  }, [buses, currentStop]);

  // Distance from passenger to this stop
  const userDistanceToStop = userLocation
    ? calculateDistanceKm(userLocation.lat, userLocation.lng, currentStop.lat, currentStop.lng)
    : null;

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Header: Stop Selector & Info */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">{currentStop.name}</h2>
              <p className="text-xs text-slate-400 font-sans">
                {currentStop.kinyarwandaName} • {currentStop.zone}
              </p>
            </div>
          </div>

          {userDistanceToStop !== null && (
            <div className="flex items-center gap-1 text-[11px] font-mono text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">
              <Navigation className="w-3 h-3" />
              <span>{formatDistance(userDistanceToStop)} away</span>
            </div>
          )}
        </div>

        {/* Stop Selector Dropdown */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400">Select Bus Stop / Terminal:</label>
          <select
            value={currentStop.id}
            onChange={(e) => {
              const found = KIGALI_BUS_STOPS.find((s) => s.id === e.target.value);
              if (found) onSelectStop(found);
            }}
            className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
          >
            {KIGALI_BUS_STOPS.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name} ({stop.zone})
              </option>
            ))}
          </select>
        </div>

        {/* Facilities & Amenities */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {currentStop.facilities.map((fac) => (
            <span
              key={fac}
              className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700/60 font-medium flex items-center gap-1"
            >
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              {fac}
            </span>
          ))}
        </div>
      </div>

      {/* Live Arrivals Board */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
          <span>Upcoming Departures / Arrivals</span>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
            Real-Time Feed
          </span>
        </div>

        {arrivals.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <Clock className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-medium">No live buses heading to this stop right now</p>
            <p className="text-xs text-slate-500">Buses will appear as soon as they dispatch from the terminal</p>
          </div>
        ) : (
          arrivals.map((arr) => {
            const isImminent = arr.etaSeconds <= 90;
            const correspondingBus = buses.find((b) => b.id === arr.busId);

            return (
              <div
                key={arr.busId}
                onClick={() => {
                  if (correspondingBus) onSelectBus(correspondingBus);
                }}
                className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                  isImminent
                    ? 'bg-amber-950/20 border-amber-500/50 shadow-lg shadow-amber-500/5'
                    : 'bg-slate-950/50 hover:bg-slate-800/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2.5 py-1 rounded-lg text-white font-mono font-bold text-xs shadow-sm"
                      style={{ backgroundColor: arr.routeColor }}
                    >
                      Line {arr.routeCode}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        To {arr.destinationName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {arr.plateNumber} • {arr.operator}
                      </div>
                    </div>
                  </div>

                  {/* ETA Badge */}
                  <div className="text-right">
                    <div
                      className={`text-sm font-bold font-mono ${
                        isImminent ? 'text-amber-400 animate-pulse' : 'text-emerald-400'
                      }`}
                    >
                      {formatEta(arr.etaSeconds)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatDistance(arr.distanceKm)} away
                    </div>
                  </div>
                </div>

                {/* Progress bar / Occupancy */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span>Load:</span>
                    <span
                      className={`font-semibold capitalize ${
                        arr.occupancy === 'low'
                          ? 'text-emerald-400'
                          : arr.occupancy === 'medium'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {arr.occupancy === 'full' ? 'Standing Only' : arr.occupancy}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {arr.delayMinutes > 0 ? (
                      <span className="text-amber-400 font-medium">+{arr.delayMinutes}m delay</span>
                    ) : (
                      <span className="text-emerald-400 font-medium">On Time</span>
                    )}
                    <span className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-0.5">
                      Track <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
