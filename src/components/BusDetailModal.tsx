import { useState } from 'react';
import { BusTelemetry } from '../types';
import { KIGALI_ROUTES, KIGALI_BUS_STOPS } from '../data/kigaliTransitData';
import { formatEta } from '../utils/geoUtils';
import {
  X,
  Bus as BusIcon,
  Gauge,
  User,
  Wifi,
  Wind,
  ShieldCheck,
  CreditCard,
  Bell,
  BellRing,
  Navigation,
  Clock,
  Compass,
  CheckCircle,
  CircleDot,
  Radio,
  Zap,
  Leaf,
  BatteryCharging,
} from 'lucide-react';

interface BusDetailModalProps {
  bus: BusTelemetry | null;
  onClose: () => void;
}

export default function BusDetailModal({ bus, onClose }: BusDetailModalProps) {
  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmTriggered, setAlarmTriggered] = useState(false);

  if (!bus) return null;

  const route = KIGALI_ROUTES.find((r) => r.id === bus.routeId);
  const nextStop = KIGALI_BUS_STOPS.find((s) => s.id === bus.nextStopId);

  const toggleAlarm = () => {
    setAlarmActive(!alarmActive);
    if (!alarmActive) {
      setTimeout(() => {
        setAlarmTriggered(true);
      }, 4000);
    } else {
      setAlarmTriggered(false);
    }
  };

  const occupancyColor =
    bus.occupancy === 'low'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : bus.occupancy === 'medium'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      : bus.occupancy === 'high'
      ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
      : 'text-rose-400 bg-rose-500/10 border-rose-500/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Banner */}
        <div
          className="p-5 text-white flex items-start justify-between relative overflow-hidden"
          style={{ backgroundColor: bus.isElectric ? '#059669' : route?.color || '#2563eb' }}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-white/20 backdrop-blur text-xs font-mono font-bold tracking-wider uppercase">
                Line {route?.code || '101'}
              </span>
              <span className="text-xs font-semibold text-white/90">{bus.operator}</span>
              {bus.isElectric && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-current" />
                  100% ELECTRIC
                </span>
              )}
            </div>
            <h2 className="text-xl font-black tracking-tight font-mono">{bus.plateNumber}</h2>
            <p className="text-xs text-white/90 font-medium truncate max-w-xs">{route?.name}</p>
          </div>

          <button
            onClick={onClose}
            className="relative z-10 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Proximity Alarm Alert Banner if triggered */}
        {alarmTriggered && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-bold flex items-center justify-between animate-bounce">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4" />
              <span>Bus {bus.plateNumber} is approaching {nextStop?.name || 'your stop'}!</span>
            </div>
            <button
              onClick={() => setAlarmTriggered(false)}
              className="text-[10px] bg-slate-950 text-white px-2 py-0.5 rounded uppercase tracking-wider"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Live Telemetry KPI Cards */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-center text-blue-400 text-xs font-medium gap-1">
                <Gauge className="w-3.5 h-3.5" />
                <span>Speed</span>
              </div>
              <div className="text-lg font-black font-mono text-slate-100">{bus.speedKmh} <span className="text-xs font-normal text-slate-400">km/h</span></div>
            </div>

            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-center text-amber-400 text-xs font-medium gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Next ETA</span>
              </div>
              <div className="text-lg font-black font-mono text-amber-300">
                {formatEta(bus.etaToNextStopSec)}
              </div>
            </div>

            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-center text-emerald-400 text-xs font-medium gap-1">
                <Compass className="w-3.5 h-3.5" />
                <span>Heading</span>
              </div>
              <div className="text-lg font-black font-mono text-slate-100">{bus.headingDeg}°</div>
            </div>
          </div>

          {/* Electric Vehicle Stats Banner */}
          {bus.isElectric && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <BatteryCharging className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-white">Battery State of Charge</p>
                  <p className="text-[11px] text-emerald-300">Clean Electric Propulsion</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-base font-extrabold text-emerald-400 font-mono">
                  {bus.batterySocPercent ?? 88}%
                </p>
                <p className="text-[10px] text-slate-400">CO₂ Saved: +{bus.co2SavedKg ?? 150}kg</p>
              </div>
            </div>
          )}

          {/* Passenger Capacity & Load Meter */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Passenger Load</span>
              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-wider ${occupancyColor}`}>
                {bus.occupancy === 'full' ? 'Standing Only' : `${bus.occupancy} Load`}
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (bus.passengerCount / bus.capacity) * 100)}%`,
                  backgroundColor:
                    bus.occupancy === 'low'
                      ? '#10b981'
                      : bus.occupancy === 'medium'
                      ? '#f59e0b'
                      : bus.occupancy === 'high'
                      ? '#f97316'
                      : '#ef4444',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>{bus.passengerCount} seated &amp; standing</span>
              <span>Capacity: {bus.capacity}</span>
            </div>
          </div>

          {/* Driver & Vehicle Metadata */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
            <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              Driver &amp; Fleet Telemetry
            </div>

            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" /> Assigned Driver
              </span>
              <span className="font-bold text-slate-200">{bus.driverName}</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-cyan-400" /> GPS Coordinates
              </span>
              <span className="font-mono text-slate-200">
                {bus.currentLat.toFixed(5)}, {bus.currentLng.toFixed(5)}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" /> Tap&amp;Go Validator
              </span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Online &amp; Active
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-400" /> Dispatch Status
              </span>
              <span className="text-slate-200 capitalize">
                {bus.delayMinutes > 0 ? `Delayed (+${bus.delayMinutes}m)` : 'On Schedule'}
              </span>
            </div>
          </div>

          {/* On-Board Amenities */}
          <div className="space-y-2">
            <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              On-Board Amenities
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div
                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                  bus.hasWifi
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                <Wifi className="w-4 h-4" />
                <span className="text-[10px] font-medium">{bus.hasWifi ? '4G WiFi' : 'No WiFi'}</span>
              </div>

              <div
                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                  bus.hasAirConditioning
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                <Wind className="w-4 h-4" />
                <span className="text-[10px] font-medium">{bus.hasAirConditioning ? 'Air Conditioning' : 'Standard Vent'}</span>
              </div>

              <div
                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                  bus.isWheelchairAccessible
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-medium">{bus.isWheelchairAccessible ? 'Accessible' : 'Standard'}</span>
              </div>
            </div>
          </div>

          {/* Route Progression Timeline */}
          {route && (
            <div className="space-y-2">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Route Stops &amp; Sequence
              </div>
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 max-h-44 overflow-y-auto space-y-3">
                {route.stopIds.map((stopId, idx) => {
                  const stopObj = KIGALI_BUS_STOPS.find((s) => s.id === stopId);
                  const isCurrentTarget = bus.nextStopId === stopId;

                  return (
                    <div key={stopId} className="flex items-start gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3 h-3 rounded-full border-2 ${
                            isCurrentTarget
                              ? 'bg-amber-400 border-white ring-4 ring-amber-400/30 animate-pulse'
                              : 'bg-slate-700 border-slate-500'
                          }`}
                        />
                        {idx < route.stopIds.length - 1 && (
                          <div className="w-0.5 h-6 bg-slate-800 my-0.5" />
                        )}
                      </div>

                      <div className="flex-1 -mt-0.5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-medium ${
                              isCurrentTarget ? 'text-amber-300 font-bold' : 'text-slate-300'
                            }`}
                          >
                            {stopObj?.name || stopId}
                          </span>
                          {isCurrentTarget && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40 font-mono">
                              Next Stop
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">Zone: {stopObj?.zone}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Proximity Alarm Button */}
          <div className="pt-2">
            <button
              onClick={toggleAlarm}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                alarmActive
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {alarmActive ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              <span>{alarmActive ? 'Arrival Alarm Active (Tap to Disable)' : 'Set Proximity Arrival Alert'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
