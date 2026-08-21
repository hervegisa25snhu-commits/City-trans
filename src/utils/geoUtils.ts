/**
 * Geo calculation and path interpolation utilities for Kigali transit tracking
 */

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateDistanceKm(lat1, lon1, lat2, lon2) * 1000;
}

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function getPolylineLengthKm(waypoints: [number, number][]): number {
  let length = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    length += calculateDistanceKm(
      waypoints[i][0],
      waypoints[i][1],
      waypoints[i + 1][0],
      waypoints[i + 1][1]
    );
  }
  return length;
}

export function interpolatePolyline(
  waypoints: [number, number][],
  progress: number // 0 to 1
): { lat: number; lng: number; heading: number } {
  if (waypoints.length === 0) return { lat: -1.9441, lng: 30.0619, heading: 0 };
  if (waypoints.length === 1) return { lat: waypoints[0][0], lng: waypoints[0][1], heading: 0 };

  const clamped = Math.max(0, Math.min(1, progress));
  const totalLength = getPolylineLengthKm(waypoints);
  const targetDist = clamped * totalLength;

  let accumulated = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const segDist = calculateDistanceKm(p1[0], p1[1], p2[0], p2[1]);

    if (accumulated + segDist >= targetDist || i === waypoints.length - 2) {
      const remaining = targetDist - accumulated;
      const fraction = segDist === 0 ? 0 : Math.min(1, Math.max(0, remaining / segDist));
      const lat = p1[0] + (p2[0] - p1[0]) * fraction;
      const lng = p1[1] + (p2[1] - p1[1]) * fraction;
      const heading = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
      return { lat, lng, heading };
    }
    accumulated += segDist;
  }

  const last = waypoints[waypoints.length - 1];
  const secondLast = waypoints[waypoints.length - 2];
  return {
    lat: last[0],
    lng: last[1],
    heading: calculateBearing(secondLast[0], secondLast[1], last[0], last[1]),
  };
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export function formatEta(seconds: number): string {
  if (seconds <= 30) return 'Arriving now';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  if (mins < 60) return `${mins}m ${secs > 0 ? `${secs}s` : ''}`.trim();
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}
