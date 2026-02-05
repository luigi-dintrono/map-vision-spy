'use client';

interface DetectionControlsProps {
  confidence: number;
  onConfidenceChange: (value: number) => void;
  onDetect: () => void;
  isLoading: boolean;
  detectionCount: number;
  onClearResults: () => void;
  zoom: number;
}

export default function DetectionControls({
  confidence,
  onConfidenceChange,
  onDetect,
  isLoading,
  detectionCount,
  onClearResults,
  zoom,
}: DetectionControlsProps) {
  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
          CONFIDENCE
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>0.1</span>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.1"
            value={confidence}
            onChange={(e) => onConfidenceChange(parseFloat(e.target.value))}
            disabled={isLoading}
            style={{
              flex: 1,
              height: '6px',
              background: '#ddd',
              borderRadius: '3px',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>0.9</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: '5px', fontSize: '14px', fontWeight: 'bold' }}>
          {confidence.toFixed(1)}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
          EXTRACTION ZOOM
        </label>
        <select
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          <option value={Math.floor(zoom)}>{Math.floor(zoom)} (local)</option>
        </select>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          Est. tiles: {Math.ceil((zoom - 15) * 2) || 1}
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={onDetect}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '12px',
            background: isLoading ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Processing...' : 'Detect in View'}
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontWeight: 'bold' }}>Detections: {detectionCount}</span>
          {detectionCount > 0 && (
            <button
              onClick={onClearResults}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Clear Results
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
