#!/bin/bash

cleanup() {
	echo "Shutting down..."
	kill $SERVER_PID $CLIENT_PID 2>/dev/null
	exit 0
}

trap cleanup SIGINT SIGTERM

cd "$(dirname "$0")/.."

echo "Starting GURPS Combat Simulator..."

echo "Starting server on ws://127.0.0.1:8080..."
npm run dev --prefix server &
SERVER_PID=$!

sleep 2

echo "Starting client on http://localhost:5173..."
npm run dev &
CLIENT_PID=$!

echo ""
echo "================================"
echo "  GURPS Combat Simulator"
echo "================================"
echo "  Client: http://localhost:5173"
echo "  Server: ws://127.0.0.1:8080"
echo ""
echo "  Press Ctrl+C to stop"
echo "================================"

wait
