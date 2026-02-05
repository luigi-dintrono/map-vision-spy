import os
from typing import List, Dict, Any, Optional
from PIL import Image
import numpy as np
import random

# Enable mock mode for UI testing when model can't load
MOCK_MODE = os.getenv("SAM3_MOCK_MODE", "true").lower() == "true"

class SAM3Service:
    """Service for loading and using SAM3 model for image segmentation"""
    
    _instance: Optional['SAM3Service'] = None
    _model = None
    _processor = None
    _model_loaded = False
    _use_mock = False
    
    def __init__(self):
        if SAM3Service._instance is not None:
            raise Exception("SAM3Service is a singleton. Use get_instance() instead.")
        self.model_path = os.getenv("SAM3_MODEL_PATH", "./models/sam3_image_model.pt")
    
    @classmethod
    def get_instance(cls) -> 'SAM3Service':
        """Get singleton instance of SAM3Service"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def load_model(self):
        """Load SAM3 model and processor"""
        if self._model_loaded:
            return
        
        try:
            import torch
            from sam3.model_builder import build_sam3_image_model
            from sam3.model.sam3_image_processor import Sam3Processor
            
            print("Loading SAM3 model...")
            # Use CPU for macOS compatibility
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"Using device: {device}")
            self._model = build_sam3_image_model(device=device)
            
            # Load checkpoint if path exists
            if os.path.exists(self.model_path):
                print(f"Loading checkpoint from {self.model_path}")
                checkpoint = torch.load(self.model_path, map_location="cpu")
                if "model" in checkpoint:
                    self._model.load_state_dict(checkpoint["model"])
                else:
                    self._model.load_state_dict(checkpoint)
            
            self._processor = Sam3Processor(self._model, device=device)
            self._model_loaded = True
            print("SAM3 model loaded successfully")
            
            # Verify model has parameters
            total_params = sum(p.numel() for p in self._model.parameters())
            print(f"SAM3 model has {total_params:,} parameters")
        except ImportError as e:
            print(f"Warning: SAM3 not installed. Install with: pip install -e . from sam3 repo")
            print(f"Error: {e}")
            self._model_loaded = False
        except Exception as e:
            print(f"Error loading SAM3 model: {e}")
            self._model_loaded = False
            if MOCK_MODE:
                print("MOCK MODE ENABLED: Will return simulated detection results for UI testing")
                self._use_mock = True
                self._model_loaded = True  # Pretend it's loaded for mock mode
    
    def is_model_loaded(self) -> bool:
        """Check if model is loaded"""
        return self._model_loaded
    
    def _generate_mock_results(
        self,
        image: Image.Image,
        prompts: List[str],
        confidence_threshold: float = 0.5
    ) -> Dict[str, Any]:
        """Generate mock detection results for UI testing"""
        width, height = image.size
        results = {
            "prompts": [],
            "masks": [],
            "boxes": [],
            "scores": []
        }
        
        for prompt in prompts:
            # Generate 2-5 random detections per prompt
            num_detections = random.randint(2, 5)
            prompt_masks = []
            prompt_boxes = []
            prompt_scores = []
            
            for _ in range(num_detections):
                # Random bounding box (normalized coordinates 0-1)
                x1 = random.uniform(0.1, 0.7)
                y1 = random.uniform(0.1, 0.7)
                x2 = x1 + random.uniform(0.05, 0.25)
                y2 = y1 + random.uniform(0.05, 0.25)
                
                # Clamp to image bounds
                x2 = min(x2, 1.0)
                y2 = min(y2, 1.0)
                
                # Random confidence score
                score = random.uniform(0.5, 0.95)
                
                if score >= confidence_threshold:
                    prompt_boxes.append([x1 * width, y1 * height, x2 * width, y2 * height])
                    prompt_scores.append(score)
                    
                    # Create a simple rectangular mask
                    mask = np.zeros((height, width), dtype=np.uint8)
                    mask[int(y1*height):int(y2*height), int(x1*width):int(x2*width)] = 255
                    prompt_masks.append(mask)
            
            results["prompts"].append(prompt)
            results["masks"].append(prompt_masks)
            results["boxes"].append(prompt_boxes)
            results["scores"].append(prompt_scores)
        
        print(f"MOCK: Generated {sum(len(s) for s in results['scores'])} detections for {len(prompts)} prompts")
        return results
    
    def process_image(
        self, 
        image: Image.Image, 
        prompts: List[str],
        confidence_threshold: float = 0.5
    ) -> Dict[str, Any]:
        """
        Process image with SAM3 using text prompts
        
        Args:
            image: PIL Image to process
            prompts: List of text prompts
            confidence_threshold: Minimum confidence score
            
        Returns:
            Dictionary with masks, boxes, and scores for each prompt
        """
        if not self._model_loaded:
            self.load_model()
        
        if not self._model_loaded:
            raise RuntimeError("SAM3 model is not loaded")
        
        # Use mock mode if real model failed to load
        if self._use_mock:
            return self._generate_mock_results(image, prompts, confidence_threshold)
        
        results = {
            "prompts": [],
            "masks": [],
            "boxes": [],
            "scores": []
        }
        
        # Set image in processor
        inference_state = self._processor.set_image(image)
        print(f"Image set in processor. Original size: {inference_state.get('original_width')}x{inference_state.get('original_height')}")
        
        # Set confidence threshold to 0 to get ALL detections
        # We'll filter later based on user's threshold
        self._processor.confidence_threshold = 0.0
        print(f"Processor confidence threshold set to: {self._processor.confidence_threshold}")
        
        # Debug: Check model state
        print(f"Model device: {self._processor.device}")
        print(f"Model resolution: {self._processor.resolution}")
        
        # Process each prompt
        for prompt in prompts:
            try:
                print(f"Processing prompt: '{prompt}'")
                output = self._processor.set_text_prompt(
                    state=inference_state,
                    prompt=prompt
                )
                
                # Debug: print all keys in output
                print(f"  Output keys: {list(output.keys())}")
                
                # Extract and convert tensors to numpy arrays/lists
                import torch
                
                masks_raw = output.get("masks", None)
                boxes_raw = output.get("boxes", None)
                scores_raw = output.get("scores", None)
                
                # Debug: print raw shapes
                if masks_raw is not None and torch.is_tensor(masks_raw):
                    print(f"  Raw masks shape: {masks_raw.shape}")
                else:
                    print(f"  Raw masks: {type(masks_raw)}")
                    
                if boxes_raw is not None and torch.is_tensor(boxes_raw):
                    print(f"  Raw boxes shape: {boxes_raw.shape}")
                else:
                    print(f"  Raw boxes: {type(boxes_raw)}")
                    
                if scores_raw is not None and torch.is_tensor(scores_raw):
                    print(f"  Raw scores shape: {scores_raw.shape}, values: {scores_raw.cpu().tolist()[:5] if len(scores_raw) > 0 else 'empty'}")
                else:
                    print(f"  Raw scores: {type(scores_raw)}")
                
                # Convert scores to list
                if scores_raw is not None:
                    if torch.is_tensor(scores_raw):
                        scores = scores_raw.cpu().tolist()
                    else:
                        scores = list(scores_raw) if hasattr(scores_raw, '__iter__') else [scores_raw]
                else:
                    scores = []
                
                # Convert boxes to list of lists
                boxes = []
                if boxes_raw is not None:
                    if torch.is_tensor(boxes_raw):
                        boxes_tensor = boxes_raw.cpu()
                        # Ensure boxes are in [x0, y0, x1, y1] format (4 values)
                        if boxes_tensor.dim() == 2 and boxes_tensor.shape[1] == 4:
                            boxes = boxes_tensor.tolist()
                        elif boxes_tensor.dim() == 1 and len(boxes_tensor) == 4:
                            boxes = [boxes_tensor.tolist()]
                        else:
                            print(f"Warning: Unexpected box shape: {boxes_tensor.shape}")
                            boxes = []
                    else:
                        boxes = list(boxes_raw) if hasattr(boxes_raw, '__iter__') else []
                
                # Convert masks to numpy arrays
                masks = []
                if masks_raw is not None:
                    if torch.is_tensor(masks_raw):
                        # Handle different mask tensor shapes
                        masks_tensor = masks_raw.cpu()
                        if masks_tensor.dim() == 4:  # [B, 1, H, W]
                            masks_tensor = masks_tensor.squeeze(1)  # [B, H, W]
                        elif masks_tensor.dim() == 3:  # [B, H, W]
                            pass  # Already correct
                        elif masks_tensor.dim() == 2:  # [H, W] - single mask
                            masks_tensor = masks_tensor.unsqueeze(0)  # [1, H, W]
                        
                        # Convert to numpy boolean arrays
                        for i in range(masks_tensor.shape[0]):
                            mask_np = masks_tensor[i].numpy().astype(bool)
                            masks.append(mask_np)
                    elif isinstance(masks_raw, (list, tuple)):
                        for mask in masks_raw:
                            if torch.is_tensor(mask):
                                mask_np = mask.cpu().numpy().astype(bool)
                                if mask_np.ndim == 3:
                                    mask_np = mask_np.squeeze(0)
                                masks.append(mask_np)
                            elif isinstance(mask, np.ndarray):
                                masks.append(mask.astype(bool))
                            else:
                                masks.append(np.array(mask, dtype=bool))
                
                # Filter by confidence threshold
                if len(scores) > 0:
                    filtered_indices = [
                        i for i, score in enumerate(scores) 
                        if score >= confidence_threshold
                    ]
                    
                    filtered_masks = [masks[i] for i in filtered_indices] if masks and len(masks) > 0 else []
                    filtered_boxes = [boxes[i] for i in filtered_indices] if boxes and len(boxes) > 0 else []
                    filtered_scores = [scores[i] for i in filtered_indices]
                else:
                    filtered_masks = []
                    filtered_boxes = []
                    filtered_scores = []
                
                results["prompts"].append(prompt)
                results["masks"].append(filtered_masks)
                results["boxes"].append(filtered_boxes)
                results["scores"].append(filtered_scores)
                
            except Exception as e:
                print(f"Error processing prompt '{prompt}': {e}")
                results["prompts"].append(prompt)
                results["masks"].append([])
                results["boxes"].append([])
                results["scores"].append([])
        
        return results
