import axios from 'axios';
import { MapBounds } from './mapbox';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Prompt {
  text: string;
  color: string;
}

export interface DetectionRequest {
  image: string; // base64
  prompts: Prompt[];
  bounds: MapBounds;
  zoom: number;
  confidence: number;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    prompt: string;
    confidence: number;
    color: string;
  };
}

export interface GeoJSONResponse {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export async function detectObjects(
  image: string,
  prompts: Prompt[],
  bounds: MapBounds,
  zoom: number,
  confidence: number
): Promise<GeoJSONResponse> {
  const request: DetectionRequest = {
    image,
    prompts,
    bounds,
    zoom,
    confidence,
  };

  const response = await axios.post<GeoJSONResponse>(
    `${API_URL}/api/detect`,
    request
  );

  return response.data;
}

export async function checkHealth(): Promise<{ status: string; model_loaded: boolean }> {
  const response = await axios.get(`${API_URL}/api/health`);
  return response.data;
}
