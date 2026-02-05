import mapboxgl from 'mapbox-gl';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function getMapBounds(map: mapboxgl.Map): MapBounds {
  const bounds = map.getBounds();
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  };
}

export function captureMapImage(map: mapboxgl.Map): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = map.getCanvas();
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    } catch (error) {
      reject(error);
    }
  });
}

export function pixelToGeo(
  pixelX: number,
  pixelY: number,
  map: mapboxgl.Map
): [number, number] {
  const point = new mapboxgl.Point(pixelX, pixelY);
  const lngLat = map.unproject(point);
  return [lngLat.lng, lngLat.lat];
}

export function geoToPixel(
  lng: number,
  lat: number,
  map: mapboxgl.Map
): [number, number] {
  const point = map.project([lng, lat]);
  return [point.x, point.y];
}
