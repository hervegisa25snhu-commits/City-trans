import { useState, useEffect } from 'react';
import { BusTelemetry, BusStop, TrafficCondition } from './types';
import { INITIAL_BUS_FLEET, KIGALI_BUS_STOPS, KIGALI_ROUTES } from './data/kigaliTransitData';
import InteractiveMap from './components/InteractiveMap';
import GoogleTransitMap from './components/GoogleTransitMap';
import BusListPanel from './components/BusListPanel';
import StopArrivalsPanel from './components/StopArrivalsPanel';
import BusDetailModal from './components/BusDetailModal';
import TapAndGoWidget from './components/TapAndGoWidget';
import AITransitAdvisor from './components/AITransitAdvisor';
import LiveTelemetryControls from './components/LiveTelemetryControls';
import {
  Bus as BusIcon,
  MapPin,
  CreditCard,
  Sparkles,
  Sliders,
  Layers,
  Radio,
  Clock,
  Navigation,
  Compass,
  AlertCircle,
  Menu,
  X,
  Map as MapIcon,
} from 'lucide-react';

type ActiveTab = 'fleet' | 'arrivals' | 'tap_and_go' | 'ai_advisor' | 'telemetry_sim';
type MapEngine = 'google' | 'leaflet';

export default function App() {
  const [buses, setBuses] = useState<BusTelemetry[]>(INITIAL_BUS_FLEET);
  const [selectedBus, setSelectedBus] = useState<BusTelemetry | null>(null);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(KIGALI_BUS_STOPS[0]);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('fleet');
  const [mapEngine, setMapEngine] = useState<MapEngine>('google');
  const [trafficCondition, setTrafficCondition] = useState<TrafficCondition>('clear');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [kigaliTime, setKigaliTime] = useState('');

  // Update Kigali local time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Kigali is UTC+2 (Central Africa Time)
      setKigaliTime(
        now.toLocaleTimeString('en-GB', {
          timeZone: 'Africa/Kigali',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' CAT'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll server for real-time bus telemetry updates
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch('/api/telemetry/buses');
        if (res.ok) {
          const data = await res.json();
          if (data.buses && Array.isArray(data.buses)) {
            setBuses(data.buses);
            if (data.trafficCondition) {
              setTrafficCondition(data.trafficCondition);
            }
            // Update selected bus reference if currently selected
            if (selectedBus) {
              const updated = data.buses.find((b: BusTelemetry) => b.id === selectedBus.id);
              if (updated) setSelectedBus(updated);
            }
          }
        }
      } catch (err) {
        // Fallback to local background movement if fetch fails
      }
    };

    fetchTelemetry();
    const pollInterval = setInterval(fetchTelemetry, 1500);
    return () => clearInterval(pollInterval);
  }, [selectedBus?.id]);

  // Request passenger geolocation
  const handleLocateUser = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // Fallback to Kigali City Center (Downtown) if permission denied or testing
          setUserLocation({
            lat: -1.9441,
            lng: 30.0619,
          });
        }
      );
    } else {
      setUserLocation({
        lat: -1.9441,
        lng: 30.0619,
      });
    }
  };

  const handleUpdateTraffic = async (condition: TrafficCondition, speedMultiplier?: number) => {
    setTrafficCondition(condition);
    try {
      await fetch('/api/telemetry/traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition, speedMultiplier }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Main Navigation Header */}
      <header className="h-16 px-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-30 shrink-0">
        {/* Brand & City Badge */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 text-white shadow-lg shadow-blue-500/20 flex items-center justify-center">
            <BusIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                Kigali Bus Tracker
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                LIVE GPS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              City of Kigali Public Transit Network • KBS, Royal Express, RFTC
            </p>
          </div>
        </div>

        {/* Center Tab Navigation (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => {
              setActiveTab('fleet');
              setIsSidebarOpen(true);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'fleet' && isSidebarOpen
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BusIcon className="w-3.5 h-3.5" />
            <span>Active Fleet</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('arrivals');
              setIsSidebarOpen(true);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'arrivals' && isSidebarOpen
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Stop Arrivals</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('tap_and_go');
              setIsSidebarOpen(true);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'tap_and_go' && isSidebarOpen
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Tap&Go Pass</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('ai_advisor');
              setIsSidebarOpen(true);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'ai_advisor' && isSidebarOpen
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AI Advisor</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('telemetry_sim');
              setIsSidebarOpen(true);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'telemetry_sim' && isSidebarOpen
                ? 'bg-orange-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Telemetry Sim</span>
          </button>
        </nav>

        {/* Right Info: Map Engine Toggle, Kigali Clock & Toggle Sidebar */}
        <div className="flex items-center gap-2.5">
          {/* Map Engine Toggle */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setMapEngine('google')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
                mapEngine === 'google'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Switch to Google Maps Platform (Vector tiles, live traffic layer, satellite)"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Google Maps</span>
            </button>
            <button
              onClick={() => setMapEngine('leaflet')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
                mapEngine === 'leaflet'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Switch to Leaflet OpenStreetMap"
            >
              <span>OSM</span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-300 font-mono bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{kigaliTime}</span>
          </div>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition md:flex items-center gap-1.5 text-xs font-semibold"
          >
            {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span className="hidden sm:inline">{isSidebarOpen ? 'Hide Panel' : 'Show Panel'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left / Full Width: Interactive Real-Time Map */}
        <main className="flex-1 h-full p-2.5 relative">
          {mapEngine === 'google' ? (
            <GoogleTransitMap
              buses={buses}
              routes={KIGALI_ROUTES}
              selectedBus={selectedBus}
              selectedStop={selectedStop}
              activeRouteId={activeRouteId}
              onSelectBus={(bus) => {
                setSelectedBus(bus);
              }}
              onSelectStop={(stop) => {
                setSelectedStop(stop);
                setActiveTab('arrivals');
                setIsSidebarOpen(true);
              }}
              userLocation={userLocation}
              onLocateUser={handleLocateUser}
            />
          ) : (
            <InteractiveMap
              buses={buses}
              selectedBus={selectedBus}
              selectedStop={selectedStop}
              activeRouteId={activeRouteId}
              onSelectBus={(bus) => {
                setSelectedBus(bus);
              }}
              onSelectStop={(stop) => {
                setSelectedStop(stop);
                setActiveTab('arrivals');
                setIsSidebarOpen(true);
              }}
              userLocation={userLocation}
              onLocateUser={handleLocateUser}
            />
          )}
        </main>

        {/* Right Control & Information Sidebar */}
        {isSidebarOpen && (
          <aside className="w-full md:w-[420px] lg:w-[450px] h-full p-2.5 z-20 shrink-0 absolute md:relative right-0 top-0 bg-slate-950/80 md:bg-transparent backdrop-blur-md md:backdrop-blur-none">
            {/* Mobile Tab Nav Switcher */}
            <div className="flex md:hidden items-center justify-between pb-2 text-xs">
              <div className="flex items-center gap-1 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('fleet')}
                  className={`px-2.5 py-1 rounded-lg font-bold ${
                    activeTab === 'fleet' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Fleet
                </button>
                <button
                  onClick={() => setActiveTab('arrivals')}
                  className={`px-2.5 py-1 rounded-lg font-bold ${
                    activeTab === 'arrivals' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Arrivals
                </button>
                <button
                  onClick={() => setActiveTab('tap_and_go')}
                  className={`px-2.5 py-1 rounded-lg font-bold ${
                    activeTab === 'tap_and_go' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Tap&Go
                </button>
                <button
                  onClick={() => setActiveTab('ai_advisor')}
                  className={`px-2.5 py-1 rounded-lg font-bold ${
                    activeTab === 'ai_advisor' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  AI Advisor
                </button>
                <button
                  onClick={() => setActiveTab('telemetry_sim')}
                  className={`px-2.5 py-1 rounded-lg font-bold ${
                    activeTab === 'telemetry_sim' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Sim
                </button>
              </div>

              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active Sub-Panel Component */}
            {activeTab === 'fleet' && (
              <BusListPanel
                buses={buses}
                selectedBus={selectedBus}
                activeRouteId={activeRouteId}
                onSelectBus={(bus) => {
                  setSelectedBus(bus);
                }}
                onSelectRoute={(routeId) => setActiveRouteId(routeId)}
              />
            )}

            {activeTab === 'arrivals' && (
              <StopArrivalsPanel
                selectedStop={selectedStop}
                buses={buses}
                userLocation={userLocation}
                onSelectStop={(stop) => setSelectedStop(stop)}
                onSelectBus={(bus) => setSelectedBus(bus)}
              />
            )}

            {activeTab === 'tap_and_go' && <TapAndGoWidget />}

            {activeTab === 'ai_advisor' && <AITransitAdvisor userLocation={userLocation} />}

            {activeTab === 'telemetry_sim' && (
              <LiveTelemetryControls
                trafficCondition={trafficCondition}
                onUpdateTraffic={handleUpdateTraffic}
                buses={buses}
              />
            )}
          </aside>
        )}
      </div>

      {/* Bus Detail Modal / Bottom Inspection Sheet */}
      {selectedBus && (
        <BusDetailModal bus={selectedBus} onClose={() => setSelectedBus(null)} />
      )}
    </div>
  );
}
