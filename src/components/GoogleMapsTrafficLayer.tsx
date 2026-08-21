import { useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

interface GoogleMapsTrafficLayerProps {
  enabled?: boolean;
}

export default function GoogleMapsTrafficLayer({ enabled = true }: GoogleMapsTrafficLayerProps) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;

    const trafficLayer = new mapsLib.TrafficLayer();
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
  }, [map, mapsLib, enabled]);

  return null;
}
