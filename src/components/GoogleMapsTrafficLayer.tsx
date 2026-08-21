import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

interface GoogleMapsTrafficLayerProps {
  enabled?: boolean;
}

export default function GoogleMapsTrafficLayer({ enabled = true }: GoogleMapsTrafficLayerProps) {
  const map = useMap();
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  useEffect(() => {
    if (!map) return;

    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayerRef.current = trafficLayer;

    if (enabled) {
      trafficLayer.setMap(map);
    } else {
      trafficLayer.setMap(null);
    }

    return () => {
      trafficLayer.setMap(null);
      trafficLayerRef.current = null;
    };
  }, [map, enabled]);

  return null;
}
