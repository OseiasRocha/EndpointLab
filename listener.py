#!/usr/bin/env python3
"""
Local test listener for endpointSimulator.
Runs HTTP, TCP, and UDP servers concurrently so you can fire
transmissions from the UI and see what arrives.
"""

import json
import os
import socket
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer

# ── Configuration ─────────────────────────────────────────────────────────────

def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


HOST = os.getenv("LISTENER_HOST", "0.0.0.0")

ENABLE_HTTP = _env_bool("LISTENER_ENABLE_HTTP", False)
ENABLE_TCP  = _env_bool("LISTENER_ENABLE_TCP", True)
ENABLE_UDP  = _env_bool("LISTENER_ENABLE_UDP", False)

HTTP_PORT = _env_int("LISTENER_HTTP_PORT", 18080)
TCP_PORT  = _env_int("LISTENER_TCP_PORT", 18081)
UDP_PORT  = _env_int("LISTENER_UDP_PORT", 18082)

# HTTP response sent back to every request
HTTP_RESPONSE_STATUS = 200
HTTP_RESPONSE_BODY   = {"status": "ok", "echo": "received"}   # set to None for empty body

# JSON object sent back on TCP/UDP; set to None to send no response
TCP_RESPONSE = {"response": 2}
UDP_RESPONSE = {"response": 3}

# ── Helpers ───────────────────────────────────────────────────────────────────

def log(protocol: str, source: str, data: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    preview = data.strip()[:400] or "(empty)"
    print(f"\n[{ts}] [{protocol}] {source}")
    print(f"  {preview}")

# ── HTTP ──────────────────────────────────────────────────────────────────────

class _HTTPHandler(BaseHTTPRequestHandler):
    def _handle(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode(errors="replace") if length else ""
        log("HTTP", f"{self.client_address[0]}  {self.command} {self.path}", body)

        if HTTP_RESPONSE_BODY is not None:
            payload = json.dumps(HTTP_RESPONSE_BODY).encode()
            self.send_response(HTTP_RESPONSE_STATUS)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        else:
            self.send_response(HTTP_RESPONSE_STATUS)
            self.send_header("Content-Length", "0")
            self.end_headers()

    do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = _handle

    def log_message(self, *_) -> None:
        pass  # silence default access log


def _run_http() -> None:
    srv = HTTPServer((HOST, HTTP_PORT), _HTTPHandler)
    print(f"  [HTTP] {HOST}:{HTTP_PORT}")
    srv.serve_forever()

# ── TCP ───────────────────────────────────────────────────────────────────────

def _handle_tcp(conn: socket.socket, addr: tuple) -> None:
    with conn:
        chunks = []
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                break
            chunks.append(chunk)
            if len(chunk) < 4096:
                break
        data = b"".join(chunks).decode(errors="replace")
        log("TCP", f"{addr[0]}:{addr[1]}", data)
        if TCP_RESPONSE is not None:
            conn.sendall(json.dumps(TCP_RESPONSE).encode())


def _run_tcp() -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as srv:
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind((HOST, TCP_PORT))
        srv.listen()
        print(f"  [TCP]  {HOST}:{TCP_PORT}")
        while True:
            conn, addr = srv.accept()
            threading.Thread(target=_handle_tcp, args=(conn, addr), daemon=True).start()

# ── UDP ───────────────────────────────────────────────────────────────────────

def _run_udp() -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as srv:
        srv.bind((HOST, UDP_PORT))
        print(f"  [UDP]  {HOST}:{UDP_PORT}")
        while True:
            data, addr = srv.recvfrom(65535)
            log("UDP", f"{addr[0]}:{addr[1]}", data.decode(errors="replace"))
            if UDP_RESPONSE is not None:
                srv.sendto(json.dumps(UDP_RESPONSE).encode(), addr)

# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    targets = [
        (ENABLE_HTTP, _run_http),
        (ENABLE_TCP,  _run_tcp),
        (ENABLE_UDP,  _run_udp),
    ]

    print("Listening on:")
    threads = []
    for enabled, fn in targets:
        if enabled:
            t = threading.Thread(target=fn, daemon=True)
            t.start()
            threads.append(t)

    if not threads:
        print("  (nothing enabled — set ENABLE_HTTP/TCP/UDP to True)")
    else:
        print("\nPress Ctrl+C to stop.")
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            print("\nStopped.")
