import React, { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

interface GoogleMapsPolylineProps {
  key?: React.Key;
  path: { lat: number; lng: number }[];
  color: string;
  weight?: number;
  opacity?: number;
  isHighlighted?: boolean;
  onClick?: () => void;
}

export default function GoogleMapsPolyline({
  path,
  color,
  weight = 4,
  opacity = 0.8,
  isHighlighted = false,
  onClick,
}: GoogleMapsPolylineProps) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map) return;

    const polyline = new google.maps.Polyline({
      path,
      strokeColor: color,
      strokeOpacity: opacity,
      strokeWeight: weight,
      geodesic: true,
      clickable: true,
      zIndex: isHighlighted ? 10 : 2,
    });

    polyline.setMap(map);
    polylineRef.current = polyline;

    const listener = polyline.addListener('click', () => {
      if (onClick) onClick();
    });

    return () => {
      google.maps.event.removeListener(listener);
      polyline.setMap(null);
      polylineRef.current = null;
    };
  }, [map, path, color, weight, opacity, isHighlighted, onClick]);

  return null;
}
