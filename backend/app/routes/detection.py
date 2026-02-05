from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from PIL import Image
import base64
import io
from app.services.sam3_service import SAM3Service
from app.services.coordinate_converter import convert_sam3_results_to_geojson

router = APIRouter()


class PromptRequest(BaseModel):
    text: str
    color: str


class DetectionRequest(BaseModel):
    image: str  # base64 encoded image
    prompts: List[PromptRequest]
    bounds: Dict[str, float]  # north, south, east, west
    zoom: float
    confidence: float = 0.5


@router.post("/detect")
async def detect_objects(request: DetectionRequest):
    """
    Detect objects in an image using SAM3
    
    Args:
        request: Detection request with image, prompts, bounds, and confidence
        
    Returns:
        GeoJSON FeatureCollection with detected objects
    """
    try:
        # Decode base64 image
        try:
            image_data = base64.b64decode(request.image.split(",")[-1])
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if image has alpha channel (RGBA -> RGB)
            # SAM3 expects 3-channel RGB images
            if image.mode == 'RGBA':
                # Create white background and composite
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[3])  # Use alpha as mask
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')
            
            print(f"Image size: {image.size}, mode: {image.mode}")
            
            # Save image for debugging
            debug_path = "/tmp/sam3_debug_image.png"
            image.save(debug_path)
            print(f"DEBUG: Saved image to {debug_path}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")
        
        # Get SAM3 service instance
        service = SAM3Service.get_instance()
        
        # Load model if not loaded
        if not service.is_model_loaded():
            service.load_model()
        
        if not service.is_model_loaded():
            raise HTTPException(
                status_code=503,
                detail="SAM3 model is not available. Please check model installation."
            )
        
        # Extract prompts
        prompt_texts = [p.text for p in request.prompts]
        prompt_colors = [p.color for p in request.prompts]
        
        # Process image with SAM3
        results = service.process_image(
            image=image,
            prompts=prompt_texts,
            confidence_threshold=request.confidence
        )
        
        # Log detection results for debugging
        total_detections = sum(len(scores) for scores in results.get("scores", []))
        print(f"SAM3 found {total_detections} detections for prompts: {prompt_texts}")
        for i, prompt in enumerate(results.get("prompts", [])):
            masks = results.get("masks", [])[i] if i < len(results.get("masks", [])) else []
            scores = results.get("scores", [])[i] if i < len(results.get("scores", [])) else []
            print(f"  - '{prompt}': {len(masks)} masks, {len(scores)} scores")
        
        # Convert results to GeoJSON
        geojson_data = convert_sam3_results_to_geojson(
            results=results,
            image_width=image.width,
            image_height=image.height,
            bounds=request.bounds,
            colors=prompt_colors
        )
        
        print(f"GeoJSON: {len(geojson_data.get('features', []))} features")
        
        return geojson_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection error: {str(e)}")
