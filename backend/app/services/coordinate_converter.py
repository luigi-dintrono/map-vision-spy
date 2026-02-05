import numpy as np
from typing import List, Dict, Any, Tuple
import geojson

# Try to import shapely, but make it optional
try:
    from shapely.geometry import Polygon, Point
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False
    # Create dummy classes for type hints
    Polygon = None
    Point = None

def pixel_to_geo(
    pixel_x: float,
    pixel_y: float,
    image_width: int,
    image_height: int,
    bounds: Dict[str, float]
) -> Tuple[float, float]:
    """
    Convert pixel coordinates to geographic coordinates
    
    Args:
        pixel_x: X pixel coordinate
        pixel_y: Y pixel coordinate
        image_width: Width of the image in pixels
        image_height: Height of the image in pixels
        bounds: Dictionary with 'north', 'south', 'east', 'west' keys
        
    Returns:
        Tuple of (longitude, latitude)
    """
    # Calculate the ratio
    x_ratio = pixel_x / image_width
    y_ratio = pixel_y / image_height
    
    # Calculate longitude and latitude
    lon = bounds['west'] + (bounds['east'] - bounds['west']) * x_ratio
    lat = bounds['north'] - (bounds['north'] - bounds['south']) * y_ratio
    
    return (lon, lat)


def mask_to_polygons(
    mask: np.ndarray,
    image_width: int,
    image_height: int,
    bounds: Dict[str, float],
    simplify_tolerance: float = 0.0001
) -> List[Dict[str, Any]]:
    """
    Convert a binary mask to GeoJSON polygons
    
    Args:
        mask: Binary mask array (0s and 1s)
        image_width: Width of the image
        image_height: Height of the image
        bounds: Map bounds dictionary
        simplify_tolerance: Tolerance for polygon simplification
        
    Returns:
        List of GeoJSON polygon features
    """
    try:
        from scipy import ndimage
        from skimage import measure
        has_scipy = True
    except ImportError:
        has_scipy = False
    
    if not has_scipy:
        # Fallback to bounding box approach
        y_indices, x_indices = np.where(mask > 0.5)
        if len(x_indices) == 0:
            return []
        
        min_x, max_x = x_indices.min(), x_indices.max()
        min_y, max_y = y_indices.min(), y_indices.max()
        
        # Convert corners to geo coordinates
        corners = [
            pixel_to_geo(min_x, min_y, image_width, image_height, bounds),
            pixel_to_geo(max_x, min_y, image_width, image_height, bounds),
            pixel_to_geo(max_x, max_y, image_width, image_height, bounds),
            pixel_to_geo(min_x, max_y, image_width, image_height, bounds),
            pixel_to_geo(min_x, min_y, image_width, image_height, bounds),  # Close
        ]
        
        return [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [corners]
            }
        }]
    
    try:
        # Ensure mask is binary and 2D
        if len(mask.shape) > 2:
            mask = mask.squeeze()
        if mask.dtype != bool:
            binary_mask = mask > 0.5
        else:
            binary_mask = mask
        
        # Find contours
        contours = measure.find_contours(binary_mask, 0.5)
        
        polygons = []
        for contour in contours:
            if len(contour) < 3:
                continue
            
            # Convert contour points to geographic coordinates
            coords = []
            for point in contour:
                y_pixel, x_pixel = point
                lon, lat = pixel_to_geo(
                    x_pixel, y_pixel,
                    image_width, image_height,
                    bounds
                )
                coords.append([lon, lat])
            
            # Close the polygon
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            
            # Create polygon and simplify (if shapely is available)
            if HAS_SHAPELY:
                try:
                    poly = Polygon(coords)
                    if poly.is_valid:
                        # Simplify polygon
                        simplified = poly.simplify(simplify_tolerance, preserve_topology=True)
                        if simplified.is_valid:
                            coords_list = list(simplified.exterior.coords)
                            polygons.append({
                                "type": "Feature",
                                "geometry": {
                                    "type": "Polygon",
                                    "coordinates": [coords_list]
                                }
                            })
                            continue
                except Exception as e:
                    # If polygon creation fails, use original coords
                    pass
            
            # Use original coords (either shapely not available or simplification failed)
            polygons.append({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coords]
                }
            })
        
        return polygons
    except Exception as e:
        # Fallback to bounding box if contour detection fails
        print(f"Warning: Contour detection failed, using bounding box: {e}")
        y_indices, x_indices = np.where(binary_mask)
        if len(x_indices) == 0:
            return []
        
        min_x, max_x = x_indices.min(), x_indices.max()
        min_y, max_y = y_indices.min(), y_indices.max()
        
        # Convert corners to geo coordinates
        corners = [
            pixel_to_geo(min_x, min_y, image_width, image_height, bounds),
            pixel_to_geo(max_x, min_y, image_width, image_height, bounds),
            pixel_to_geo(max_x, max_y, image_width, image_height, bounds),
            pixel_to_geo(min_x, max_y, image_width, image_height, bounds),
            pixel_to_geo(min_x, min_y, image_width, image_height, bounds),  # Close
        ]
        
        return [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [corners]
            }
        }]


def convert_sam3_results_to_geojson(
    results: Dict[str, Any],
    image_width: int,
    image_height: int,
    bounds: Dict[str, float],
    colors: List[str]
) -> Dict[str, Any]:
    """
    Convert SAM3 detection results to GeoJSON format
    
    Args:
        results: SAM3 results dictionary with masks, boxes, scores, prompts
        image_width: Width of the processed image
        image_height: Height of the processed image
        bounds: Map bounds dictionary
        colors: List of colors (hex) for each prompt
        
    Returns:
        GeoJSON FeatureCollection
    """
    features = []
    
    for i, prompt in enumerate(results.get("prompts", [])):
        masks = results.get("masks", [])[i] if i < len(results.get("masks", [])) else []
        scores = results.get("scores", [])[i] if i < len(results.get("scores", [])) else []
        color = colors[i] if i < len(colors) else "#FF0000"
        
        for j, mask in enumerate(masks):
            score = scores[j] if j < len(scores) else 0.5
            
            # Convert mask to polygons
            polygons = mask_to_polygons(
                mask,
                image_width,
                image_height,
                bounds
            )
            
            # Add metadata to each polygon
            for poly in polygons:
                poly["properties"] = {
                    "prompt": prompt,
                    "confidence": float(score),
                    "color": color
                }
                features.append(poly)
    
    return {
        "type": "FeatureCollection",
        "features": features
    }
