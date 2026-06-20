#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CERT_DIR="$SCRIPT_DIR/certs"
ENV_FILE="$SCRIPT_DIR/wss.env"
KEY_FILE="$CERT_DIR/wss.key.pem"
CERT_FILE="$CERT_DIR/wss.cert.pem"

mkdir -p "$CERT_DIR"

openssl req \
  -x509 \
  -newkey rsa:2048 \
  -sha256 \
  -nodes \
  -days 30 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE"

escape_pem() {
  awk '{ printf "%s\\n", $0 }' "$1"
}

umask 077
{
  printf 'TLS_PRIVATE_KEY="%s"\n' "$(escape_pem "$KEY_FILE")"
  printf 'TLS_CERTIFICATE="%s"\n' "$(escape_pem "$CERT_FILE")"
} > "$ENV_FILE"

chmod 600 "$KEY_FILE" "$ENV_FILE"
printf 'Created %s, %s, and %s\n' "$KEY_FILE" "$CERT_FILE" "$ENV_FILE"
