#!/bin/bash

cleanup() {
	echo "Shutting down..."
	kill $SERVER_PID $CLIENT_PID 2>/dev/null
	exit 0
}

trap cleanup SIGINT SIGTERM

cd "$(dirname "$0")/.."

echo "Starting GURPS Combat Simulator..."

LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
LOCAL_IP=${LOCAL_IP:-$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")}

echo "Starting server on ws://0.0.0.0:8080..."
npm run dev --prefix server &
SERVER_PID=$!

sleep 2

echo "Starting client on http://0.0.0.0:5173..."
npm run dev -- --host 0.0.0.0 &
CLIENT_PID=$!

echo ""
echo "================================"
echo "  Tactical Combat Simulator"
echo "================================"
echo "  Client: http://${LOCAL_IP}:5173"
echo "  Server: ws://127.0.0.1:8080 (proxied via /ws)"
echo ""
echo "  Press Ctrl+C to stop"
echo "================================"

wait
