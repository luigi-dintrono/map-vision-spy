'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

interface SearchPanelProps {
  map: mapboxgl.Map | null;
  onLocationSelect?: (location: { lng: number; lat: number; name: string }) => void;
}

export default function SearchPanel({ map, onLocationSelect }: SearchPanelProps) {
  const geocoderRef = useRef<MapboxGeocoder | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!map || !containerRef.current) return;

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!mapboxToken) return;

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxToken,
      mapboxgl: mapboxgl,
      placeholder: 'Search for a location...',
      marker: false,
    });

    geocoder.on('result', (e: any) => {
      const { center, place_name } = e.result;
      if (onLocationSelect) {
        onLocationSelect({
          lng: center[0],
          lat: center[1],
          name: place_name,
        });
      }
      // Fly to location
      map.flyTo({
        center: center,
        zoom: 17,
      });
    });

    containerRef.current.appendChild(geocoder.onAdd(map));
    geocoderRef.current = geocoder;

    return () => {
      if (geocoderRef.current) {
        geocoderRef.current.onRemove();
      }
    };
  }, [map, onLocationSelect]);

  return <div ref={containerRef} style={{ width: '100%' }} />;
}
