import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { INITIAL_BUS_FLEET, KIGALI_ROUTES, KIGALI_BUS_STOPS } from "./src/data/kigaliTransitData";
import { BusTelemetry, TrafficCondition } from "./src/types";
import { interpolatePolyline, calculateDistanceKm } from "./src/utils/geoUtils";

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory state for live bus telemetry simulation
let activeFleet: BusTelemetry[] = JSON.parse(JSON.stringify(INITIAL_BUS_FLEET));
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

    // Advance progress along route waypoints (loops continuously back and forth or circular)
    const stepIncrement = 0.003 * speedFactor * trafficSpeedMultiplier;
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

    const { lat, lng, heading } = interpolatePolyline(route.waypoints, newProgress);

    // Compute next stop
    let closestStop = KIGALI_BUS_STOPS.find((s) => s.id === bus.nextStopId) || KIGALI_BUS_STOPS[0];
    const distToStopKm = calculateDistanceKm(lat, lng, closestStop.lat, closestStop.lng);

    // If reached close to stop, switch to next stop along the route
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

    const computedSpeed = Math.round(
      Math.max(12, Math.min(58, (bus.speedKmh + (Math.random() * 6 - 3)) * speedFactor))
    );
    const etaSec = Math.max(15, Math.round((distToStopKm / Math.max(15, computedSpeed)) * 3600));

    return {
      ...bus,
      currentLat: lat,
      currentLng: lng,
      headingDeg: heading,
      speedKmh: computedSpeed,
      pathProgress: newProgress,
      direction: newDirection,
      nextStopId: closestStop.id,
      etaToNextStopSec: etaSec,
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

// Telemetry: Driver GPS ping (Simulate or ingest driver GPS broadcast)
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

// Gemini AI Kigali Transit Assistant Endpoint
app.post("/api/gemini/transit-assistant", async (req, res) => {
  try {
    const { prompt, mode = "maps_grounding", userLat, userLng } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const ai = getGemini();
    const systemPrompt = `You are the Official AI Transit Assistant for Kigali City (Rwanda) Public Transport.
You have deep knowledge of:
1. Kigali bus lines (101, 102, 104, 205, 301, 308, 502), operators (Kigali Bus Services / KBS, Royal Express, RFTC).
2. Major transport terminals: Nyabugogo, Downtown (Gare Centrale), Kimironko, Remera (Giporoso), Kacyiru, Nyamirambo (Cosmos), Gikondo, Kanombe Airport, Batsinda, Kabuga.
3. Tap&Go smart card fares regulated by RURA (ranging ~200 RWF to ~550 RWF per trip depending on zones 1-4).
4. Kigali geography, hills, traffic hotspots (Nyabugogo-Kinamba junction, Sonatubes, Giporoso), and optimal bus transfers.
Provide helpful, polite, structured advice in English with occasional Kinyarwanda greetings (e.g., 'Muraho', 'Mwaramutse'). Always include exact line numbers, boarding stops, estimated fares in RWF, and estimated travel times.`;

    let responseText = "";
    let groundingSources: { title: string; uri: string }[] = [];
    const startTime = Date.now();

    if (mode === "high_thinking") {
      // High thinking reasoning mode with gemini-3.1-pro-preview
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `${systemPrompt}\n\nUser request: ${prompt}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });
      responseText = response.text || "No response generated.";
    } else if (mode === "search_grounding") {
      // Search grounding with gemini-3.5-flash
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `${systemPrompt}\n\nSearch Kigali transit updates and answer: ${prompt}`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      responseText = response.text || "No response generated.";

      // Extract search grounding chunks
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
    } else {
      // Default: Maps Grounding with gemini-3.5-flash
      const lat = typeof userLat === "number" ? userLat : -1.9441;
      const lng = typeof userLng === "number" ? userLng : 30.0619;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `${systemPrompt}\n\nProvide Kigali transit and landmark directions for: ${prompt}`,
        config: {
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
      responseText = response.text || "No response generated.";

      // Extract Maps grounding chunks
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && Array.isArray(chunks)) {
        for (const chunk of chunks) {
          if (chunk.maps?.uri) {
            groundingSources.push({
              title: chunk.maps.title || "View on Google Maps",
              uri: chunk.maps.uri,
            });
          }
        }
      }
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    res.json({
      text: responseText,
      mode,
      groundingSources,
      thinkingDurationSec: Number(durationSec),
    });
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({
      error: error.message || "Failed to process AI transit query.",
    });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Kigali Bus Tracker Server running on port ${PORT}`);
  });
}

startServer();
