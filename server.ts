import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Modality, LiveServerMessage } from "@google/genai";
import { INITIAL_BUS_FLEET, KIGALI_ROUTES, KIGALI_BUS_STOPS, KIGALI_CHOKE_POINTS, KIGALI_DEDICATED_BUS_LANES } from "./src/data/kigaliTransitData";
import { BusTelemetry, TrafficCondition, TransitChokePoint, DedicatedBusCorridor } from "./src/types";
import { interpolatePolyline, calculateDistanceKm, getPolylineLengthKm } from "./src/utils/geoUtils";

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// In-memory state for live bus telemetry simulation & choke points
let activeFleet: BusTelemetry[] = JSON.parse(JSON.stringify(INITIAL_BUS_FLEET));
let activeChokePoints: TransitChokePoint[] = JSON.parse(JSON.stringify(KIGALI_CHOKE_POINTS));
let currentTrafficCondition: TrafficCondition = "clear";
let trafficSpeedMultiplier = 1.0;

// Lazy initialization for Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Background simulation ticker for smooth real-time GPS telemetry updates
setInterval(() => {
  const speedFactor =
    currentTrafficCondition === "storm_rain"
      ? 0.5
      : currentTrafficCondition === "heavy"
      ? 0.65
      : currentTrafficCondition === "moderate"
      ? 0.85
      : 1.0;

  activeFleet = activeFleet.map((bus) => {
    const route = KIGALI_ROUTES.find((r) => r.id === bus.routeId);
    if (!route || route.waypoints.length === 0) return bus;

    // Determine speed based on traffic, bus type, and choke points
    const baseSpeed = bus.isElectric ? 42 : 36;
    let chokePenalty = 1.0;
    let inChokePoint = false;

    // Check if current position is in a choke point
    for (const cp of activeChokePoints) {
      const distToChokeM = calculateDistanceKm(bus.currentLat, bus.currentLng, cp.lat, cp.lng) * 1000;
      if (distToChokeM <= cp.radiusMeters) {
        inChokePoint = true;
        chokePenalty = bus.isElectric ? 0.75 : cp.severity === 'critical' ? 0.4 : 0.6;
        break;
      }
    }

    const computedSpeed = Math.round(
      Math.max(10, Math.min(58, (baseSpeed + (Math.random() * 6 - 3)) * speedFactor * chokePenalty))
    );

    // Calculate distance-based progress along the road polyline (1.5 seconds tick)
    const totalRouteLengthKm = Math.max(1, getPolylineLengthKm(route.waypoints));
    const distanceTravelledKm = (computedSpeed / 3600) * 1.5 * trafficSpeedMultiplier;
    const stepIncrement = distanceTravelledKm / totalRouteLengthKm;

    let newProgress = bus.pathProgress;
    let newDirection = bus.direction;

    if (bus.direction === "outbound") {
      newProgress += stepIncrement;
      if (newProgress >= 1.0) {
        newProgress = 1.0;
        newDirection = "inbound";
      }
    } else {
      newProgress -= stepIncrement;
      if (newProgress <= 0.0) {
        newProgress = 0.0;
        newDirection = "outbound";
      }
    }

    const { lat, lng, heading } = interpolatePolyline(route.waypoints, newProgress, newDirection);

    let closestStop = KIGALI_BUS_STOPS.find((s) => s.id === bus.nextStopId) || KIGALI_BUS_STOPS[0];
    const distToStopKm = calculateDistanceKm(lat, lng, closestStop.lat, closestStop.lng);

    if (distToStopKm < 0.15 && route.stopIds.length > 0) {
      const currentStopIndex = route.stopIds.indexOf(closestStop.id);
      const nextIndex =
        newDirection === "outbound"
          ? (currentStopIndex + 1) % route.stopIds.length
          : (currentStopIndex - 1 + route.stopIds.length) % route.stopIds.length;
      const nextStopId = route.stopIds[nextIndex] || route.stopIds[0];
      const targetStop = KIGALI_BUS_STOPS.find((s) => s.id === nextStopId);
      if (targetStop) {
        closestStop = targetStop;
      }
    }

    const etaSec = Math.max(15, Math.round((distToStopKm / Math.max(12, computedSpeed)) * 3600));

    // Calculate dynamic battery consumption / regen for electric fleet
    let updatedBattery = bus.batterySocPercent;
    if (bus.isElectric && updatedBattery !== undefined) {
      updatedBattery = Math.max(15, Math.min(100, Number((updatedBattery - 0.01).toFixed(2))));
    }

    return {
      ...bus,
      currentLat: lat,
      currentLng: lng,
      headingDeg: Math.round(heading),
      speedKmh: computedSpeed,
      pathProgress: newProgress,
      direction: newDirection,
      nextStopId: closestStop.id,
      etaToNextStopSec: etaSec,
      batterySocPercent: updatedBattery,
      status: inChokePoint && computedSpeed < 15 ? 'delayed' : 'in_transit',
      delayMinutes: inChokePoint ? 3 : 0,
      lastUpdated: new Date().toISOString(),
    };
  });
}, 1500);

// --- REST API ENDPOINTS ---

// Telemetry: Fetch all active Kigali buses
app.get("/api/telemetry/buses", (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    trafficCondition: currentTrafficCondition,
    buses: activeFleet,
  });
});

// Telemetry: Fetch all Kigali Choke Points with real-time bottlenecks
app.get("/api/telemetry/chokepoints", (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    chokePoints: activeChokePoints,
    networkMapUrl: "https://ecofleet.rw/network-map-2/",
    dedicatedCorridors: KIGALI_DEDICATED_BUS_LANES,
  });
});

// Telemetry: Update traffic condition
app.post("/api/telemetry/traffic", (req, res) => {
  const { condition, speedMultiplier } = req.body;
  if (condition) currentTrafficCondition = condition;
  if (typeof speedMultiplier === "number") trafficSpeedMultiplier = speedMultiplier;

  res.json({
    success: true,
    trafficCondition: currentTrafficCondition,
    speedMultiplier: trafficSpeedMultiplier,
  });
});

// Telemetry: Driver GPS ping
app.post("/api/telemetry/driver-ping", (req, res) => {
  const { busId, lat, lng, speed, heading, occupancy } = req.body;
  const busIndex = activeFleet.findIndex((b) => b.id === busId);
  if (busIndex !== -1) {
    activeFleet[busIndex] = {
      ...activeFleet[busIndex],
      currentLat: lat ?? activeFleet[busIndex].currentLat,
      currentLng: lng ?? activeFleet[busIndex].currentLng,
      speedKmh: speed ?? activeFleet[busIndex].speedKmh,
      headingDeg: heading ?? activeFleet[busIndex].headingDeg,
      occupancy: occupancy ?? activeFleet[busIndex].occupancy,
      lastUpdated: new Date().toISOString(),
    };
    return res.json({ success: true, bus: activeFleet[busIndex] });
  }
  res.status(404).json({ error: "Bus not found" });
});

// Multi-turn Gemini Chat with Role System Instruction, Search Grounding, Maps Grounding, and Model tiers
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const {
      messages = [],
      prompt,
      model = "gemini-3.5-flash", // 'gemini-3.1-pro-preview' | 'gemini-3.5-flash' | 'gemini-3.1-flash-lite'
      enableSearchGrounding = false,
      enableMapsGrounding = false,
      userLat,
      userLng,
    } = req.body;

    const query = prompt || (messages.length > 0 ? messages[messages.length - 1].content : "");
    if (!query) {
      return res.status(400).json({ error: "Query prompt is required." });
    }

    const ai = getGemini();

    const systemInstruction = `You are the Official AI Transit Assistant and Commuter Concierge for Kigali City, Rwanda, integrated with the EcoFleet Rwanda Network Map (https://ecofleet.rw/network-map-2/) and RURA transit regulations.
Your role:
1. Provide accurate advice on Kigali bus routes (e.g., Line 101 Downtown-Nyabugogo-Remera-Kimironko, 102 Downtown-Nyamirambo, 104 Downtown-Gisozi-Batsinda, 205 Nyabugogo-Kimironko-Kabuga, 301 Downtown-Sonatubes-Airport, 308 Remera-Gikondo-Nyabugogo, 502 Kimironko-Batsinda).
2. Detail Kigali transit operators: EcoFleet Rwanda (operating 100% Zero-Emission Electric buses with BasiGo), KBS (Kigali Bus Services), Royal Express, and RFTC.
3. Provide live intelligence on Kigali's major transit choke points & bottlenecks:
   - Nyabugogo Basin & Gitikinyoni Gateway (heavy intercity & trunk convergence)
   - Sonatubes Roundabout & Rwandex Corridor (CBD / Airport / Bugesera tri-corridor bottleneck)
   - Payage - Kanogo - Rwandex Swamp Valley (CBD - Kicukiro causeway)
   - Giporoso (Ku Cya Mitsingi) / Remera (BK Arena & Airport bottleneck)
   - Kinamba Junction & Poids Lourds (Kacyiru / Gisozi / Nyabugogo incline)
   - Kimironko Market & Prison Roundabout
   - Kicukiro Centre & Nyanza Bus Park
   - Downtown - Former 1930 Prison - Muhima Gateway
4. Explain City of Kigali dedicated bus priority lanes (active peak 06:00-07:00 & 17:00-21:00) and how EcoFleet electric buses bypass traffic bottlenecks.
5. Calculate and explain Tap&Go card tariffs regulated by RURA (200 RWF base up to ~550 RWF for extended zones).
6. Provide practical directions considering Kigali hills, transit junctions, and transfers.
7. Offer pleasant customer service with friendly Rwandan greetings (e.g., 'Muraho', 'Mwaramutse', 'Mwiriwe').
8. Provide structured bullet points with route numbers, boarding stops, fare estimates in RWF, and estimated travel times.`;

    // Map model selection
    let selectedModel = model;
    if (model === "pro" || model === "gemini-pro") selectedModel = "gemini-3.1-pro-preview";
    if (model === "flash" || model === "gemini-flash") selectedModel = "gemini-3.5-flash";
    if (model === "lite" || model === "flash-lite") selectedModel = "gemini-3.1-flash-lite";

    // Format previous turns for context
    const conversationHistory = messages
      .slice(0, -1)
      .map((m: any) => `${m.role === "user" ? "Passenger" : "Transit AI"}: ${m.content}`)
      .join("\n\n");

    const fullContents = conversationHistory
      ? `${conversationHistory}\n\nPassenger: ${query}`
      : query;

    const startTime = Date.now();
    let responseText = "";
    let groundingSources: { title: string; uri: string }[] = [];

    // Configure tools according to features
    if (enableSearchGrounding) {
      // Search Grounding using gemini-3.5-flash
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: fullContents,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });
      responseText = response.text || "No response received.";

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && Array.isArray(chunks)) {
        for (const chunk of chunks) {
          if (chunk.web?.uri) {
            groundingSources.push({
              title: chunk.web.title || chunk.web.uri,
              uri: chunk.web.uri,
            });
          }
        }
      }
    } else if (enableMapsGrounding) {
      // Maps Grounding using gemini-3.5-flash with user geolocation
      const lat = typeof userLat === "number" ? userLat : -1.9441;
      const lng = typeof userLng === "number" ? userLng : 30.0619;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: fullContents,
        config: {
          systemInstruction,
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng,
              },
            },
          },
        },
      });
      responseText = response.text || "No response received.";

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && Array.isArray(chunks)) {
        for (const chunk of chunks) {
          if (chunk.maps?.uri) {
            groundingSources.push({
              title: chunk.maps.title || "View Location on Google Maps",
              uri: chunk.maps.uri,
            });
          }
        }
      }
    } else if (selectedModel === "gemini-3.1-pro-preview") {
      // Complex tasks with gemini-3.1-pro-preview with High Thinking
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: fullContents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });
      responseText = response.text || "No response received.";
    } else if (selectedModel === "gemini-3.1-flash-lite") {
      // Fast lightweight responses with gemini-3.1-flash-lite
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: fullContents,
        config: {
          systemInstruction,
        },
      });
      responseText = response.text || "No response received.";
    } else {
      // General tasks with gemini-3.5-flash
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: fullContents,
        config: {
          systemInstruction,
        },
      });
      responseText = response.text || "No response received.";
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    res.json({
      text: responseText,
      modelUsed: selectedModel,
      groundingSources,
      durationSec: Number(durationSec),
    });
  } catch (error: any) {
    console.error("Gemini Chat API Error:", error);
    res.status(500).json({
      error: error.message || "Failed to generate AI response.",
    });
  }
});

// WebSocket Server for Gemini Live API Voice Conversations (gemini-3.1-flash-live-preview)
const wss = new WebSocketServer({ server, path: "/api/gemini/live" });

wss.on("connection", async (clientWs: WebSocket) => {
  console.log("Client connected to Gemini Live Voice session");
  let liveSession: any = null;

  try {
    const ai = getGemini();

    liveSession = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Zephyr" },
          },
        },
        systemInstruction: `You are the interactive spoken voice assistant for Kigali City Transit in Rwanda.
Keep spoken responses concise, warm, natural, and friendly (1-3 spoken sentences).
You know all Kigali bus routes (101, 102, 104, 205, 301, 308, 502), operators KBS, Royal Express, RFTC, Tap&Go fares, and major terminals (Nyabugogo, Downtown, Kimironko, Remera Giporoso).`,
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;

          const parts = message.serverContent?.modelTurn?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: "audio",
                    audio: part.inlineData.data,
                  })
                );
              }
              if (part.text) {
                clientWs.send(
                  JSON.stringify({
                    type: "transcript",
                    text: part.text,
                  })
                );
              }
            }
          }

          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: "interrupted" }));
          }
          if (message.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({ type: "turn_complete" }));
          }
        },
        onclose: () => {
          console.log("Gemini Live session closed");
        },
        onerror: (err: any) => {
          console.error("Gemini Live session error:", err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: "error",
                error: err?.message || "Live audio session error",
              })
            );
          }
        },
      },
    });

    clientWs.send(JSON.stringify({ type: "connected", message: "Live voice session ready." }));

    clientWs.on("message", (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "audio" && msg.audio && liveSession) {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        } else if (msg.type === "text" && msg.text && liveSession) {
          liveSession.sendRealtimeInput({
            text: msg.text,
          });
        }
      } catch (e) {
        console.error("Error processing client audio chunk:", e);
      }
    });

    clientWs.on("close", () => {
      if (liveSession) {
        try {
          liveSession.close();
        } catch (_) {}
      }
    });
  } catch (err: any) {
    console.error("Failed to initialize Gemini Live Voice session:", err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: "error",
          error: err.message || "Failed to initialize Gemini Live voice session",
        })
      );
      clientWs.close();
    }
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Kigali Bus Tracker & Live Voice Server running on port ${PORT}`);
  });
}

startServer();
