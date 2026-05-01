#!/usr/bin/env python3
"""
Local test listener for EndpointLab.
Runs HTTP, HTTPS, TCP, UDP, WS, and WSS servers concurrently so you can fire
transmissions from the UI and see what arrives.

WebSocket support requires the 'websockets' package:
    pip install websockets
"""

import asyncio
import json
import os
import socket
import ssl
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer

try:
    import websockets
    import websockets.asyncio.server as ws_server
    _HAS_WEBSOCKETS = True
except ImportError:
    _HAS_WEBSOCKETS = False

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

ENABLE_HTTP  = _env_bool("LISTENER_ENABLE_HTTP",  False)
ENABLE_HTTPS = _env_bool("LISTENER_ENABLE_HTTPS", False)
ENABLE_TCP   = _env_bool("LISTENER_ENABLE_TCP",   True)
ENABLE_UDP   = _env_bool("LISTENER_ENABLE_UDP",   False)
ENABLE_WS    = _env_bool("LISTENER_ENABLE_WS",    False)
ENABLE_WSS   = _env_bool("LISTENER_ENABLE_WSS",   False)

HTTP_PORT  = _env_int("LISTENER_HTTP_PORT",  18080)
HTTPS_PORT = _env_int("LISTENER_HTTPS_PORT", 18443)
TCP_PORT   = _env_int("LISTENER_TCP_PORT",   18081)
UDP_PORT   = _env_int("LISTENER_UDP_PORT",   18082)
WS_PORT    = _env_int("LISTENER_WS_PORT",    18083)
WSS_PORT   = _env_int("LISTENER_WSS_PORT",   18084)

# TLS certificate files for the HTTPS listener
HTTPS_CERT = os.getenv("LISTENER_HTTPS_CERT", "certs/cert.pem")
HTTPS_KEY  = os.getenv("LISTENER_HTTPS_KEY",  "certs/key.pem")

# HTTP/HTTPS response sent back to every request
HTTP_RESPONSE_STATUS = 200
HTTP_RESPONSE_BODY   = {"status": "ok", "echo": "received"}   # set to None for empty body

# JSON object sent back on TCP/UDP/WS/WSS; set to None to send no response
TCP_RESPONSE = {"response": 2}
UDP_RESPONSE = {"response": 3}
WS_RESPONSE  = {"response": 4}

# ── Helpers ───────────────────────────────────────────────────────────────────

def log(protocol: str, source: str, data: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    preview = data.strip()[:400] or "(empty)"
    print(f"\n[{ts}] [{protocol}] {source}")
    print(f"  {preview}")

# ── HTTP / HTTPS ──────────────────────────────────────────────────────────────

class _HTTPHandler(BaseHTTPRequestHandler):
    def _handle(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode(errors="replace") if length else ""
        proto = "HTTPS" if isinstance(self.connection, ssl.SSLSocket) else "HTTP"
        log(proto, f"{self.client_address[0]}  {self.command} {self.path}", body)

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
    print(f"  [HTTP]  {HOST}:{HTTP_PORT}")
    srv.serve_forever()


def _run_https() -> None:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(certfile=HTTPS_CERT, keyfile=HTTPS_KEY)
    srv = HTTPServer((HOST, HTTPS_PORT), _HTTPHandler)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    print(f"  [HTTPS] {HOST}:{HTTPS_PORT}  (cert: {HTTPS_CERT})")
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
        print(f"  [TCP]   {HOST}:{TCP_PORT}")
        while True:
            conn, addr = srv.accept()
            threading.Thread(target=_handle_tcp, args=(conn, addr), daemon=True).start()

# ── UDP ───────────────────────────────────────────────────────────────────────

def _run_udp() -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as srv:
        srv.bind((HOST, UDP_PORT))
        print(f"  [UDP]   {HOST}:{UDP_PORT}")
        while True:
            data, addr = srv.recvfrom(65535)
            log("UDP", f"{addr[0]}:{addr[1]}", data.decode(errors="replace"))
            if UDP_RESPONSE is not None:
                srv.sendto(json.dumps(UDP_RESPONSE).encode(), addr)

# ── WS / WSS ─────────────────────────────────────────────────────────────────

def _make_ws_handler(protocol: str):
    async def handler(websocket) -> None:
        async for message in websocket:
            data = message if isinstance(message, str) else message.decode(errors="replace")
            addr = websocket.remote_address
            log(protocol, f"{addr[0]}:{addr[1]}", data)
            if WS_RESPONSE is not None:
                await websocket.send(json.dumps(WS_RESPONSE))
    return handler


def _run_ws() -> None:
    if not _HAS_WEBSOCKETS:
        print("  [WS]    ERROR: 'websockets' package not installed — run: pip install websockets")
        return

    async def _serve() -> None:
        async with ws_server.serve(_make_ws_handler("WS"), HOST, WS_PORT):
            print(f"  [WS]    {HOST}:{WS_PORT}")
            await asyncio.get_running_loop().create_future()

    asyncio.run(_serve())


def _run_wss() -> None:
    if not _HAS_WEBSOCKETS:
        print("  [WSS]   ERROR: 'websockets' package not installed — run: pip install websockets")
        return

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(certfile=HTTPS_CERT, keyfile=HTTPS_KEY)

    async def _serve() -> None:
        async with ws_server.serve(_make_ws_handler("WSS"), HOST, WSS_PORT, ssl=ctx):
            print(f"  [WSS]   {HOST}:{WSS_PORT}  (cert: {HTTPS_CERT})")
            await asyncio.get_running_loop().create_future()

    asyncio.run(_serve())


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    targets = [
        (ENABLE_HTTP,  _run_http),
        (ENABLE_HTTPS, _run_https),
        (ENABLE_TCP,   _run_tcp),
        (ENABLE_UDP,   _run_udp),
        (ENABLE_WS,    _run_ws),
        (ENABLE_WSS,   _run_wss),
    ]

    print("Listening on:")
    threads = []
    for enabled, fn in targets:
        if enabled:
            t = threading.Thread(target=fn, daemon=True)
            t.start()
            threads.append(t)

    if not threads:
        print("  (nothing enabled — set LISTENER_ENABLE_HTTP/HTTPS/TCP/UDP/WS/WSS to true)")
    else:
        print("\nPress Ctrl+C to stop.")
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            print("\nStopped.")
