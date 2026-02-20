#!/bin/bash
# Start local API server for Resend email

# Add Homebrew Node.js to PATH
export PATH="/opt/homebrew/Cellar/node/23.11.0/bin:$PATH"

# Check if node_modules exists, if not install
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the server
echo "Starting local API server..."
node local-api-server.js
