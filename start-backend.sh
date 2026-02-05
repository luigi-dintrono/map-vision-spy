#!/bin/bash

# Start backend server
cd backend

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start uvicorn server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
