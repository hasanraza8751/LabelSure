#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${LABELSURE_PYTHON:-$HOME/anaconda3/envs/legal_metrology/bin/python}"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    trap - INT TERM EXIT
    [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

if [[ ! -x "$PYTHON_BIN" ]]; then
    echo "LabelSure Python environment not found: $PYTHON_BIN" >&2
    echo "Set LABELSURE_PYTHON to the environment's Python executable." >&2
    exit 1
fi

if [[ ! -x "$ROOT_DIR/web/node_modules/.bin/vite" ]]; then
    echo "Frontend dependencies are missing; installing them..."
    npm install --prefix "$ROOT_DIR/web" || exit 1
fi

echo "Starting LabelSure backend at http://127.0.0.1:8000"
(
    cd "$ROOT_DIR" || exit 1
    exec "$PYTHON_BIN" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

echo "Starting LabelSure frontend at http://127.0.0.1:5174"
(
    cd "$ROOT_DIR" || exit 1
    exec npm --prefix web run dev -- --host 127.0.0.1 --port 5174
) &
FRONTEND_PID=$!

echo "LabelSure is running. Press Ctrl+C to stop both services."

while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
    sleep 1
done
