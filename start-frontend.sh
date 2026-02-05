#!/bin/bash

# Start frontend development server
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start Next.js dev server
npm run dev
