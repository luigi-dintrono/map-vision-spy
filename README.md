# SAM3 Map Demo

A Next.js web application that uses Meta's SAM3 (Segment Anything Model 3) to detect and highlight objects on interactive maps. Users can search for locations, define text prompts for object detection, and visualize segmented results overlaid on a Mapbox satellite map.

## Features

- **Interactive Map**: Navigate and explore locations using Mapbox satellite imagery
- **Location Search**: Search for any location worldwide using Mapbox Geocoding
- **Text-Based Detection**: Define multiple object types to detect (e.g., "tennis courts", "sand traps")
- **Color-Coded Results**: Assign colors to different object types for easy visualization
- **Confidence Control**: Adjust detection confidence threshold (0.1 - 0.9)
- **Real-Time Visualization**: See detection results overlaid as colored polygons on the map

## Architecture

The application consists of two main components:

1. **Frontend** (Next.js + TypeScript): React-based UI with Mapbox GL JS integration
2. **Backend** (Python FastAPI): SAM3 model processing and API server

```
Frontend (Next.js) → Backend API (FastAPI) → SAM3 Model → GeoJSON Results → Map Overlay
```

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Mapbox account and API token ([Get one here](https://account.mapbox.com/))
- SAM3 model checkpoint (see Model Setup below)

## Setup Instructions

### 1. Clone and Install SAM3

First, you need to install the SAM3 package from Meta's repository:

```bash
# Clone the SAM3 repository
git clone https://github.com/facebookresearch/sam3.git
cd sam3

# Install SAM3 package
pip install -e .
```

### 2. Download SAM3 Model Checkpoint

Download the SAM3 model checkpoint from the [SAM3 repository](https://github.com/facebookresearch/sam3). Place it in the `backend/models/` directory:

```bash
mkdir -p backend/models
# Download the model checkpoint to backend/models/sam3_image_model.pt
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Edit .env.local and add your Mapbox token:
# NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
# NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Edit .env and set the model path:
# SAM3_MODEL_PATH=./models/sam3_image_model.pt
```

## Running the Application

### Start the Backend Server

```bash
cd backend
source venv/bin/activate  # If using virtual environment
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### Start the Frontend Development Server

```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage

1. **Search for a Location**: Use the search box in the left panel to find a location (e.g., "Colonial Country Club, San Antonio")

2. **Define Object Prompts**: 
   - Add text prompts for objects you want to detect (e.g., "tennis courts", "sand traps")
   - Assign a color to each prompt using the color picker
   - Add multiple prompts to detect different object types

3. **Adjust Settings**:
   - Set the confidence threshold (0.1 - 0.9) - higher values are more selective
   - Check the current zoom level and estimated area

4. **Run Detection**:
   - Click "Detect in View" to process the current map view
   - Wait for processing (this may take a few seconds)
   - Results will appear as colored polygons overlaid on the map

5. **View Results**:
   - Detected objects are highlighted with their assigned colors
   - The detection count is shown in the left panel
   - Click "Clear Results" to remove overlays

## Project Structure

```
sam3d-demo/
├── frontend/
│   ├── app/
│   │   ├── components/      # React components
│   │   │   ├── MapView.tsx
│   │   │   ├── SearchPanel.tsx
│   │   │   ├── PromptInput.tsx
│   │   │   └── DetectionControls.tsx
│   │   ├── page.tsx         # Main page
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── mapbox.ts        # Map utilities
│   │   └── api.ts           # API client
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   └── detection.py # API endpoints
│   │   ├── services/
│   │   │   ├── sam3_service.py
│   │   │   └── coordinate_converter.py
│   │   └── main.py          # FastAPI app
│   ├── requirements.txt
│   └── models/              # SAM3 model checkpoints
│
└── README.md
```

## API Endpoints

### `GET /api/health`
Check backend health and model loading status.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true
}
```

### `POST /api/detect`
Process an image with SAM3 detection.

**Request Body:**
```json
{
  "image": "data:image/png;base64,...",
  "prompts": [
    {"text": "tennis courts", "color": "#FF69B4"},
    {"text": "sand traps", "color": "#00FF00"}
  ],
  "bounds": {
    "north": 29.43,
    "south": 29.42,
    "east": -98.48,
    "west": -98.50
  },
  "zoom": 17.5,
  "confidence": 0.5
}
```

**Response:**
GeoJSON FeatureCollection with detected objects as polygons.

## Troubleshooting

### Model Not Loading
- Ensure SAM3 is installed: `pip install -e .` from the sam3 repository
- Check that the model checkpoint path in `.env` is correct
- Verify the model file exists at the specified path

### Backend Connection Errors
- Make sure the backend server is running on port 8000
- Check that `NEXT_PUBLIC_API_URL` in frontend `.env.local` matches the backend URL
- Verify CORS settings in `backend/app/main.py`

### Map Not Displaying
- Verify your Mapbox token is set in `frontend/.env.local`
- Check browser console for Mapbox API errors
- Ensure the token has the necessary scopes

### Detection Not Working
- Check that prompts have text entered
- Verify the backend health endpoint shows `model_loaded: true`
- Check backend logs for SAM3 processing errors
- Ensure the image capture is working (check browser console)

## Development Notes

- The coordinate conversion from pixel coordinates to geographic coordinates uses the map bounds and zoom level
- Detection results are simplified to reduce polygon complexity
- The model is loaded once on server startup for performance
- Large map areas may take longer to process

## License

This project uses SAM3 from Meta Research, which is licensed under the SAM License. See the [SAM3 repository](https://github.com/facebookresearch/sam3) for details.

## Acknowledgments

- [Meta SAM3](https://github.com/facebookresearch/sam3) - Segment Anything Model 3
- [Mapbox](https://www.mapbox.com/) - Map services
- [Next.js](https://nextjs.org/) - React framework
- [FastAPI](https://fastapi.tiangolo.com/) - Python web framework
