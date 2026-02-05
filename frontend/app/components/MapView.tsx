'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMapBounds, captureMapImage } from '@/lib/mapbox';
import { GeoJSONResponse } from '@/lib/api';

interface MapViewProps {
  onMapReady?: (map: mapboxgl.Map) => void;
  onImageCapture?: (image: string, bounds: ReturnType<typeof getMapBounds>) => void;
  detectionResults?: GeoJSONResponse | null;
  onClearResults?: () => void;
}

export default function MapView({
  onMapReady,
  onImageCapture,
  detectionResults,
  onClearResults,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!mapboxToken || mapboxToken === 'your_mapbox_token_here') {
      const errorMsg = 'Mapbox token not found. Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local';
      console.error(errorMsg);
      console.error('Get your token from: https://account.mapbox.com/access-tokens/');
      setMapError(errorMsg);
      return;
    }
    
    setMapError(null);

    mapboxgl.accessToken = mapboxToken;

    // Try satellite style first, fallback to streets if there's an issue
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [-98.4936, 29.4241], // Default to San Antonio, TX
      zoom: 17,
      antialias: true,
      preserveDrawingBuffer: true, // Required for canvas capture!
    });

    // Add navigation controls (zoom, compass, etc.)
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      console.log('Map loaded successfully');
      setMapLoaded(true);
      // Resize map to ensure it renders correctly
      map.current!.resize();
      if (onMapReady) {
        onMapReady(map.current!);
      }
    });

    // Handle style loading errors
    map.current.on('error', (e: any) => {
      console.error('Mapbox error:', e);
      if (e.error?.message) {
        const errorMsg = e.error.message;
        // Check for common token errors
        if (errorMsg.includes('token') || errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
          setMapError('Invalid Mapbox token. Please check your token in .env.local');
        } else if (errorMsg.includes('style') || errorMsg.includes('403')) {
          setMapError('Mapbox token does not have access to this style. Try a different token or style.');
        } else {
          setMapError(`Mapbox error: ${errorMsg}`);
        }
        console.error('Full error details:', e);
      } else if (e.error) {
        setMapError(`Mapbox error: ${JSON.stringify(e.error)}`);
      }
    });

    // Handle style data loading issues
    map.current.on('style.load', () => {
      console.log('Map style loaded');
      // Resize after style loads to fix rendering issues
      setTimeout(() => {
        if (map.current) {
          map.current.resize();
        }
      }, 100);
    });

    map.current.on('data', (e: any) => {
      if (e.isSourceLoaded) {
        console.log('Map data loaded');
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Handle detection results overlay
  useEffect(() => {
    if (!map.current || !mapLoaded || !detectionResults) return;

    const sourceId = 'detection-results';
    const layerId = 'detection-layer';

    // Remove existing source and layer if they exist
    if (map.current.getSource(sourceId)) {
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      map.current.removeSource(sourceId);
    }

    // Add new source and layer
    map.current.addSource(sourceId, {
      type: 'geojson',
      data: detectionResults,
    });

    map.current.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': [
          'get',
          'color',
        ],
        'fill-opacity': 0.5,
      },
    });

    // Add outline
    map.current.addLayer({
      id: `${layerId}-outline`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': [
          'get',
          'color',
        ],
        'line-width': 2,
      },
    });

    return () => {
      if (map.current) {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current.getLayer(`${layerId}-outline`)) {
          map.current.removeLayer(`${layerId}-outline`);
        }
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      }
    };
  }, [detectionResults, mapLoaded]);

  const handleCapture = async () => {
    if (!map.current || !mapLoaded) return;

    try {
      const image = await captureMapImage(map.current);
      const bounds = getMapBounds(map.current);
      if (onImageCapture) {
        onImageCapture(image, bounds);
      }
    } catch (error) {
      console.error('Error capturing map image:', error);
    }
  };

  // Expose capture function via ref or callback
  useEffect(() => {
    if (mapLoaded && onImageCapture) {
      // Store capture function for parent to call
      (window as any).__mapCapture = handleCapture;
    }
  }, [mapLoaded, onImageCapture]);

  return (
    <div
      ref={mapContainer}
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        minHeight: '400px'
      }}
    >
      {mapError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 1000,
            textAlign: 'center',
            maxWidth: '400px',
          }}
        >
          <h3 style={{ marginBottom: '10px', color: '#c62828' }}>Mapbox Token Required</h3>
          <p style={{ marginBottom: '10px', color: '#666' }}>{mapError}</p>
          <p style={{ fontSize: '12px', color: '#999' }}>
            Get your token from:{' '}
            <a
              href="https://account.mapbox.com/access-tokens/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1976d2' }}
            >
              https://account.mapbox.com/access-tokens/
            </a>
          </p>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
            Then add it to <code style={{ background: '#f5f5f5', padding: '2px 4px' }}>.env.local</code>
          </p>
        </div>
      )}
    </div>
  );
}
