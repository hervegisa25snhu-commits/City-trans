import { useState, FormEvent } from 'react';
import { TrafficCondition, BusTelemetry } from '../types';
import {
  Radio,
  Sliders,
  CloudRain,
  Sun,
  AlertTriangle,
  Send,
  CheckCircle2,
  RefreshCw,
  Gauge,
  MapPin,
} from 'lucide-react';

interface LiveTelemetryControlsProps {
  trafficCondition: TrafficCondition;
  onUpdateTraffic: (condition: TrafficCondition, speedMultiplier?: number) => void;
  buses: BusTelemetry[];
}

export default function LiveTelemetryControls({
  trafficCondition,
  onUpdateTraffic,
  buses,
}: LiveTelemetryControlsProps) {
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [selectedBusId, setSelectedBusId] = useState(buses[0]?.id || '');
  const [customLat, setCustomLat] = useState('-1.9450');
  const [customLng, setCustomLng] = useState('30.0600');
  const [customSpeed, setCustomSpeed] = useState('45');
  const [pingSuccess, setPingSuccess] = useState(false);

  const handleSendPing = async (e: FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    const speed = parseInt(customSpeed, 10);

    if (isNaN(lat) || isNaN(lng) || isNaN(speed)) return;

    try {
      const res = await fetch('/api/telemetry/driver-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: selectedBusId,
          lat,
          lng,
          speed,
        }),
      });
      if (res.ok) {
        setPingSuccess(true);
        setTimeout(() => setPingSuccess(false), 2500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTrafficChange = (cond: TrafficCondition) => {
    onUpdateTraffic(cond, speedMultiplier);
  };

  const handleSpeedMultiplierChange = (mult: number) => {
    setSpeedMultiplier(mult);
    onUpdateTraffic(trafficCondition, mult);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Live Telemetry & GPS Sim</h2>
            <p className="text-xs text-slate-400">Control traffic conditions & broadcast driver GPS</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Kigali Traffic Scenario Toggles */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              Kigali City Traffic Scenario
            </h4>
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
              Current: <strong className="text-slate-200">{trafficCondition.replace('_', ' ')}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => handleTrafficChange('clear')}
              className={`p-2.5 rounded-xl border font-medium flex items-center gap-2 transition ${
                trafficCondition === 'clear'
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sun className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <div className="font-bold">Clear Flow</div>
                <div className="text-[10px] opacity-75">35-50 km/h</div>
              </div>
            </button>

            <button
              onClick={() => handleTrafficChange('moderate')}
              className={`p-2.5 rounded-xl border font-medium flex items-center gap-2 transition ${
                trafficCondition === 'moderate'
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4 text-amber-400" />
              <div className="text-left">
                <div className="font-bold">Moderate</div>
                <div className="text-[10px] opacity-75">25-35 km/h</div>
              </div>
            </button>

            <button
              onClick={() => handleTrafficChange('heavy')}
              className={`p-2.5 rounded-xl border font-medium flex items-center gap-2 transition ${
                trafficCondition === 'heavy'
                  ? 'bg-orange-500/20 border-orange-500/60 text-orange-300 shadow'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <div className="text-left">
                <div className="font-bold">Rush Hour</div>
                <div className="text-[10px] opacity-75">15-25 km/h, Delays</div>
              </div>
            </button>

            <button
              onClick={() => handleTrafficChange('storm_rain')}
              className={`p-2.5 rounded-xl border font-medium flex items-center gap-2 transition ${
                trafficCondition === 'storm_rain'
                  ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 shadow'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <CloudRain className="w-4 h-4 text-cyan-400" />
              <div className="text-left">
                <div className="font-bold">Kigali Rain Storm</div>
                <div className="text-[10px] opacity-75">12-20 km/h</div>
              </div>
            </button>
          </div>
        </div>

        {/* Simulation Speed Rate */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-amber-400" /> GPS Simulation Tick Rate
            </span>
            <span className="font-mono text-amber-400 font-bold">{speedMultiplier}x Speed</span>
          </div>

          <div className="flex items-center gap-2">
            {[1.0, 2.0, 4.0].map((mult) => (
              <button
                key={mult}
                onClick={() => handleSpeedMultiplierChange(mult)}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-bold transition ${
                  speedMultiplier === mult
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {mult}x Real-Time
              </button>
            ))}
          </div>
        </div>

        {/* Driver GPS Telemetry Broadcast Tester */}
        <form onSubmit={handleSendPing} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              Driver In-Vehicle GPS Broadcaster
            </h4>
            {pingSuccess && (
              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> GPS Broadcasted!
              </span>
            )}
          </div>

          <div className="space-y-1 text-xs">
            <label className="text-[10px] text-slate-400">Target Vehicle:</label>
            <select
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.plateNumber} ({b.operator} - {b.fleetNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">Latitude:</label>
              <input
                type="text"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">Longitude:</label>
              <input
                type="text"
                value={customLng}
                onChange={(e) => setCustomLng(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">Speed (km/h):</label>
              <input
                type="text"
                value={customSpeed}
                onChange={(e) => setCustomSpeed(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs tracking-wide shadow-md transition active:scale-98 flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" /> Broadcast Instant GPS Ping
          </button>
        </form>
      </div>
    </div>
  );
}
