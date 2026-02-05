'use client';

import { useState, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import MapView from './components/MapView';
import SearchPanel from './components/SearchPanel';
import PromptInput, { Prompt } from './components/PromptInput';
import DetectionControls from './components/DetectionControls';
import { detectObjects, checkHealth, GeoJSONResponse } from '@/lib/api';
import { getMapBounds } from '@/lib/mapbox';

interface CapturedImage {
  id: string;
  image: string;
  timestamp: Date;
  bounds: ReturnType<typeof getMapBounds>;
  prompts: string[];
  detectionCount: number;
  results: GeoJSONResponse | null;
}

export default function Home() {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([
    { id: '1', text: 'trees', color: '#00FF00' },
    { id: '2', text: 'buildings', color: '#FF69B4' },
  ]);
  const [confidence, setConfidence] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [detectionResults, setDetectionResults] = useState<GeoJSONResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(17);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  
  // Image preview state
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewBounds, setPreviewBounds] = useState<ReturnType<typeof getMapBounds> | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Captured images history
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);

  useEffect(() => {
    // Check backend health on mount (non-blocking - just for info)
    checkHealth()
      .then((health) => {
        if (!health.model_loaded) {
          console.log('Backend connected but SAM3 model not loaded yet.');
        } else {
          console.log('Backend and SAM3 model are ready!');
        }
      })
      .catch((err) => {
        // Backend not running - this is fine for UI testing
        console.log('Backend not available - UI demo mode. Detection will not work until backend is started.');
        // Don't set error state - just log it
      });
  }, []);

  const handleMapReady = (mapInstance: mapboxgl.Map) => {
    setMap(mapInstance);
    mapRef.current = mapInstance;

    // Update zoom on zoom change
    mapInstance.on('zoom', () => {
      setZoom(mapInstance.getZoom());
    });
  };

  const handleImageCapture = async (image: string, bounds: ReturnType<typeof getMapBounds>) => {
    if (!mapRef.current || prompts.length === 0 || prompts.some((p) => !p.text.trim())) {
      setError('Please add at least one prompt with text.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const apiPrompts = prompts
        .filter((p) => p.text.trim())
        .map((p) => ({ text: p.text, color: p.color }));

      const results = await detectObjects(
        image,
        apiPrompts,
        bounds,
        zoom,
        confidence
      );

      setDetectionResults(results);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Detection failed');
      console.error('Detection error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDetect = async () => {
    if (!mapRef.current) return;

    try {
      const bounds = getMapBounds(mapRef.current);
      const canvas = mapRef.current.getCanvas();
      const image = canvas.toDataURL('image/png');
      
      // Show preview modal
      setPreviewImage(image);
      setPreviewBounds(bounds);
      setShowPreview(true);
    } catch (err: any) {
      setError('Failed to capture map image: ' + (err.message || 'Unknown error'));
      console.error('Capture error:', err);
    }
  };
  
  const handleConfirmDetection = async () => {
    if (!previewImage || !previewBounds) return;
    
    setShowPreview(false);
    setIsLoading(true);
    setError(null);

    try {
      const apiPrompts = prompts
        .filter((p) => p.text.trim())
        .map((p) => ({ text: p.text, color: p.color }));

      const results = await detectObjects(
        previewImage,
        apiPrompts,
        previewBounds,
        zoom,
        confidence
      );

      setDetectionResults(results);
      
      // Add to captured images history WITH results
      const newCapture: CapturedImage = {
        id: Date.now().toString(),
        image: previewImage,
        timestamp: new Date(),
        bounds: previewBounds,
        prompts: prompts.map(p => p.text),
        detectionCount: results?.features.length || 0,
        results: results,
      };
      setCapturedImages(prev => [newCapture, ...prev].slice(0, 10)); // Keep last 10
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Detection failed');
      console.error('Detection error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveImage = async () => {
    if (!previewImage) return;
    
    // Find the capture with results for this preview image
    const capture = capturedImages.find(c => c.image === previewImage);
    const resultsToRender = capture?.results || detectionResults;
    
    if (!resultsToRender || !previewBounds) {
      // No results, just save the plain image
      const link = document.createElement('a');
      link.download = `map-capture-${Date.now()}.png`;
      link.href = previewImage;
      link.click();
      return;
    }
    
    // Create a canvas to composite image + results
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = previewImage;
    });
    
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }
    
    // Draw the base image
    ctx.drawImage(img, 0, 0);
    
    // Helper to convert geo coords to pixel coords
    const geoToPixel = (lng: number, lat: number) => {
      const x = ((lng - previewBounds.west) / (previewBounds.east - previewBounds.west)) * canvas.width;
      const y = ((previewBounds.north - lat) / (previewBounds.north - previewBounds.south)) * canvas.height;
      return { x, y };
    };
    
    // Draw each feature
    for (const feature of resultsToRender.features) {
      const color = feature.properties?.color || '#FF0000';
      const geometry = feature.geometry;
      
      ctx.fillStyle = color + '66'; // Add transparency
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      
      if (geometry.type === 'Polygon') {
        ctx.beginPath();
        const coords = geometry.coordinates[0] as [number, number][]; // Outer ring
        coords.forEach((coord, i) => {
          const { x, y } = geoToPixel(coord[0], coord[1]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (geometry.type === 'MultiPolygon') {
        for (const polygon of geometry.coordinates as [number, number][][]) {
          ctx.beginPath();
          const coords = polygon[0] as unknown as [number, number][]; // Outer ring
          coords.forEach((coord, i) => {
            const { x, y } = geoToPixel(coord[0], coord[1]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    
    // Add legend
    const legendY = 20;
    const legendX = 10;
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(legendX - 5, legendY - 15, 150, 25 * prompts.length + 10);
    
    prompts.forEach((prompt, i) => {
      const y = legendY + i * 25;
      ctx.fillStyle = prompt.color;
      ctx.fillRect(legendX, y, 20, 15);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(legendX, y, 20, 15);
      ctx.fillStyle = '#fff';
      ctx.fillText(prompt.text, legendX + 28, y + 12);
    });
    
    // Save the composited image
    const link = document.createElement('a');
    link.download = `map-detection-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  
  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreviewImage(null);
    setPreviewBounds(null);
  };

  const handleClearResults = () => {
    setDetectionResults(null);
  };

  const detectionCount = detectionResults?.features.length || 0;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {/* Left Panel */}
      <div
        style={{
          width: '350px',
          background: 'white',
          padding: '20px',
          overflowY: 'auto',
          boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
          zIndex: 1000,
        }}
      >
        <h1 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: 'bold' }}>
          geosam SAM 3 Object Detection
        </h1>

        {error && (
          <div
            style={{
              padding: '10px',
              background: '#ffebee',
              color: '#c62828',
              borderRadius: '4px',
              marginBottom: '20px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            <div>Zoom: {zoom.toFixed(1)}</div>
            {map && (
              <div>
                Area: {(() => {
                  const bounds = getMapBounds(map);
                  const latDiff = bounds.north - bounds.south;
                  const lngDiff = bounds.east - bounds.west;
                  // Rough area calculation in m²
                  const area = latDiff * lngDiff * 111000 * 111000 * Math.cos((bounds.north + bounds.south) / 2 * Math.PI / 180);
                  return Math.round(area);
                })()} m²
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <button
              style={{
                flex: 1,
                padding: '8px',
                background: '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Text
            </button>
            <button
              style={{
                flex: 1,
                padding: '8px',
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Example
            </button>
            <button
              style={{
                flex: 1,
                padding: '8px',
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Points
            </button>
          </div>
        </div>

        <SearchPanel map={map} />

        <PromptInput prompts={prompts} onPromptsChange={setPrompts} />

        <DetectionControls
          confidence={confidence}
          onConfidenceChange={setConfidence}
          onDetect={handleDetect}
          isLoading={isLoading}
          detectionCount={detectionCount}
          onClearResults={handleClearResults}
          zoom={zoom}
        />

        <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
          Navigate to an area and click 'Detect in View'.
        </div>
        
        {/* Captured Images History */}
        {capturedImages.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
              Recent Captures ({capturedImages.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {capturedImages.map((capture) => (
                <div
                  key={capture.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px',
                    background: '#f5f5f5',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: detectionResults === capture.results ? '2px solid #4CAF50' : '2px solid transparent',
                  }}
                  onClick={() => {
                    // Load this capture's results onto the map
                    if (capture.results) {
                      setDetectionResults(capture.results);
                    }
                    setPreviewImage(capture.image);
                    setPreviewBounds(capture.bounds);
                    setShowPreview(true);
                  }}
                >
                  <img
                    src={capture.image}
                    alt="Captured"
                    style={{
                      width: '60px',
                      height: '45px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                    }}
                  />
                  <div style={{ flex: 1, fontSize: '11px' }}>
                    <div style={{ fontWeight: 'bold' }}>{capture.timestamp.toLocaleTimeString()}</div>
                    <div style={{ color: '#4CAF50' }}>
                      {capture.detectionCount} detection{capture.detectionCount !== 1 ? 's' : ''}
                    </div>
                    <div style={{ color: '#888', fontSize: '10px' }}>
                      {capture.prompts.join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map View */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <MapView
          onMapReady={handleMapReady}
          onImageCapture={handleImageCapture}
          detectionResults={detectionResults}
          onClearResults={handleClearResults}
        />
      </div>
      
      {/* Image Preview Modal */}
      {showPreview && previewImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={handleCancelPreview}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '15px', fontSize: '18px', fontWeight: 'bold' }}>
              Captured Map View
            </h2>
            
            <img
              src={previewImage}
              alt="Map capture preview"
              style={{
                maxWidth: '100%',
                maxHeight: '60vh',
                objectFit: 'contain',
                borderRadius: '4px',
                border: '1px solid #ddd',
              }}
            />
            
            <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
              {previewBounds && (
                <div>
                  Bounds: {previewBounds.west.toFixed(4)}°W to {previewBounds.east.toFixed(4)}°E, 
                  {previewBounds.south.toFixed(4)}°S to {previewBounds.north.toFixed(4)}°N
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveImage}
                style={{
                  padding: '10px 20px',
                  background: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Save Image
              </button>
              <button
                onClick={handleCancelPreview}
                style={{
                  padding: '10px 20px',
                  background: '#f5f5f5',
                  color: '#333',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDetection}
                disabled={isLoading}
                style={{
                  padding: '10px 20px',
                  background: isLoading ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                {isLoading ? 'Processing...' : 'Run Detection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
