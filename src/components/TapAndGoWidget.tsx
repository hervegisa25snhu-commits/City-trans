import { useState, useEffect } from 'react';
import { SAMPLE_TAP_AND_GO_CARDS, KIGALI_BUS_STOPS } from '../data/kigaliTransitData';
import { TapGoCard } from '../types';
import { calculateDistanceKm } from '../utils/geoUtils';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  CreditCard,
  Plus,
  RefreshCw,
  QrCode,
  CheckCircle2,
  Smartphone,
  Zap,
  Receipt,
  LogIn,
  Save,
  ShieldCheck,
  Cloud,
} from 'lucide-react';

export default function TapAndGoWidget() {
  const { user, signInWithGoogle } = useAuth();

  const [cards, setCards] = useState<TapGoCard[]>(SAMPLE_TAP_AND_GO_CARDS);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [originStopId, setOriginStopId] = useState(KIGALI_BUS_STOPS[0].id);
  const [destStopId, setDestStopId] = useState(KIGALI_BUS_STOPS[3].id);
  const [topUpAmount, setTopUpAmount] = useState('2000');
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

  const currentCard = cards[activeCardIndex] || cards[0];

  // Sync with Firestore userCards collection when authenticated
  useEffect(() => {
    if (!user) return;

    setIsSyncingFirebase(true);
    const q = query(collection(db, 'userCards'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setIsSyncingFirebase(false);
        if (!snapshot.empty) {
          const userCardsData: TapGoCard[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              cardNumber: data.cardNumber || '9400-0000-0000',
              holderName: data.cardHolder || user.displayName || 'Kigali Commuter',
              balanceRwf: data.balanceRwf ?? 3500,
              cardType: data.cardType || 'Standard',
              tripsToday: data.tripsToday || 0,
              lastTappedStop: data.lastTappedStop || 'Downtown Terminal',
              lastTappedTime: 'Saved',
            };
          });
          setCards(userCardsData);
        } else {
          // Initialize first default card in Firestore for user
          const initialCard = {
            userId: user.uid,
            cardNumber: `9400-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
            cardHolder: user.displayName || 'Kigali Commuter',
            balanceRwf: 5000,
            cardType: 'Personal Pass',
            tripsToday: 0,
            updatedAt: serverTimestamp(),
          };
          addDoc(collection(db, 'userCards'), initialCard).catch((e) =>
            console.error('Error creating default user card:', e)
          );
        }
      },
      (error) => {
        console.error('Firestore userCards listener error:', error);
        setIsSyncingFirebase(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Calculate Fare based on distance and zones
  const originStop = KIGALI_BUS_STOPS.find((s) => s.id === originStopId) || KIGALI_BUS_STOPS[0];
  const destStop = KIGALI_BUS_STOPS.find((s) => s.id === destStopId) || KIGALI_BUS_STOPS[1];
  const distanceKm = calculateDistanceKm(originStop.lat, originStop.lng, destStop.lat, destStop.lng);

  // RURA tariff formula: base 200 RWF + 35 RWF per km, max 550 RWF
  const computedFareRwf = Math.min(550, Math.max(220, Math.round((200 + distanceKm * 35) / 10) * 10));

  const handleTopUp = async () => {
    const amount = parseInt(topUpAmount, 10);
    if (isNaN(amount) || amount <= 0) return;

    setIsToppingUp(true);

    const newBalance = currentCard.balanceRwf + amount;

    // If card has firestore ID and user is authenticated, update in Firestore
    if (user && (currentCard as any).id) {
      try {
        const cardRef = doc(db, 'userCards', (currentCard as any).id);
        await updateDoc(cardRef, {
          balanceRwf: newBalance,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.error('Error updating balance in Firestore:', e);
      }
    }

    setTimeout(() => {
      setCards((prev) =>
        prev.map((c, i) => (i === activeCardIndex ? { ...c, balanceRwf: newBalance } : c))
      );
      setIsToppingUp(false);
      setTopUpSuccess(true);
      setTimeout(() => setTopUpSuccess(false), 3000);
    }, 800);
  };

  const handleSimulateTap = async () => {
    if (currentCard.balanceRwf < computedFareRwf) {
      alert('Insufficient Tap&Go balance. Please top up your card.');
      return;
    }

    const newBalance = currentCard.balanceRwf - computedFareRwf;
    const newTrips = currentCard.tripsToday + 1;
    const tappedStop = `${originStop.name} ➔ ${destStop.name}`;

    if (user && (currentCard as any).id) {
      try {
        const cardRef = doc(db, 'userCards', (currentCard as any).id);
        await updateDoc(cardRef, {
          balanceRwf: newBalance,
          tripsToday: newTrips,
          lastTappedStop: tappedStop,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.error('Error updating tap in Firestore:', e);
      }
    }

    setCards((prev) =>
      prev.map((c, i) =>
        i === activeCardIndex
          ? {
              ...c,
              balanceRwf: newBalance,
              lastTappedStop: tappedStop,
              lastTappedTime: 'Just now',
              tripsToday: newTrips,
            }
          : c
      )
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
              Tap&amp;Go Transit Pass
              {user ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-medium border border-emerald-500/30 flex items-center gap-1">
                  <Cloud className="w-2.5 h-2.5" /> Firestore Synced
                </span>
              ) : null}
            </h2>
            <p className="text-xs text-slate-400">AC Group Rwanda Contactless Transit Pass</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold transition active:scale-95 shadow"
          >
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>Show QR</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Firebase Authentication Callout if not signed in */}
        {!user && (
          <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 flex items-center justify-between">
            <div className="text-xs text-blue-200">
              <span className="font-bold block">Sign in with Google</span>
              <span>Persist your Tap&amp;Go card balance &amp; trip history in Firestore database.</span>
            </div>
            <button
              onClick={signInWithGoogle}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        )}

        {/* Tap&Go Realistic Physical Card Visual */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-cyan-950 via-slate-900 to-blue-900 p-5 border border-cyan-500/30 shadow-2xl space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
                Republic of Rwanda • RURA
              </span>
              <h3 className="text-lg font-black tracking-wider text-white font-sans flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" /> Tap&amp;Go™
              </h3>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-medium">Balance</span>
              <span className="text-xl font-black font-mono text-cyan-300">
                {currentCard.balanceRwf.toLocaleString()} <span className="text-xs font-normal">RWF</span>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Cardholder</div>
              <div className="text-xs font-bold text-slate-100">{user?.displayName || currentCard.holderName}</div>
            </div>
            <div className="space-y-0.5 text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Card Number</div>
              <div className="text-xs font-mono font-bold text-slate-300">{currentCard.cardNumber}</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-cyan-500/20 text-[10px] text-slate-300">
            <span>
              Last tapped: <strong className="text-white">{currentCard.lastTappedStop || 'Downtown Terminal'}</strong>
            </span>
            <span className="text-cyan-400 font-medium">{currentCard.tripsToday} trips today</span>
          </div>
        </div>

        {/* Switch Card Picker */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Cards:</span>
          {cards.map((card, idx) => (
            <button
              key={card.cardNumber}
              onClick={() => setActiveCardIndex(idx)}
              className={`px-2.5 py-1 rounded-lg border font-medium transition ${
                activeCardIndex === idx
                  ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {card.holderName}
            </button>
          ))}
        </div>

        {/* Kigali RURA Fare Calculator */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
              Fare Calculator (RURA Official Tariff)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">{distanceKm.toFixed(1)} km</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">Boarding Stop (Origin):</label>
              <select
                value={originStopId}
                onChange={(e) => setOriginStopId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {KIGALI_BUS_STOPS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">Alighting Stop (Destination):</label>
              <select
                value={destStopId}
                onChange={(e) => setDestStopId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {KIGALI_BUS_STOPS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <div>
              <span className="text-[11px] text-slate-400 block">Calculated Tap&amp;Go Fare</span>
              <span className="text-base font-black font-mono text-amber-400">{computedFareRwf} RWF</span>
            </div>

            <button
              onClick={handleSimulateTap}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Simulate Tap-On
            </button>
          </div>
        </div>

        {/* Top-up Simulator via MTN MoMo / Airtel Money */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-yellow-400" />
              Instant Top-Up (MTN MoMo / Airtel)
            </h4>
            {topUpSuccess && (
              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Top-Up Successful!
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {['500', '1000', '2000', '5000'].map((amt) => (
              <button
                key={amt}
                onClick={() => setTopUpAmount(amt)}
                className={`py-1.5 rounded-lg border text-xs font-mono font-bold transition ${
                  topUpAmount === amt
                    ? 'bg-yellow-500/20 border-yellow-500/60 text-yellow-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                +{amt} F
              </button>
            ))}
          </div>

          <button
            onClick={handleTopUp}
            disabled={isToppingUp}
            className="w-full py-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs tracking-wide shadow-lg transition active:scale-98 flex items-center justify-center gap-2"
          >
            {isToppingUp ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Processing MoMo Top-Up...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Top-Up {topUpAmount} RWF via MoMo
              </>
            )}
          </button>
        </div>
      </div>

      {/* QR Transit Pass Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4">
            <h3 className="text-base font-bold text-slate-100">Digital Tap&amp;Go Pass</h3>
            <p className="text-xs text-slate-400">Scan at bus validator scanner upon boarding</p>

            <div className="bg-white p-4 rounded-xl inline-block shadow-inner mx-auto">
              <div className="w-44 h-44 bg-slate-900 rounded flex flex-col items-center justify-center text-white space-y-2 p-2 border-4 border-slate-900">
                <QrCode className="w-28 h-28 text-white" />
                <span className="font-mono text-[10px] text-slate-300 tracking-wider">
                  {currentCard.cardNumber}
                </span>
              </div>
            </div>

            <div className="text-xs font-mono text-cyan-400 font-bold">
              Balance: {currentCard.balanceRwf.toLocaleString()} RWF
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
