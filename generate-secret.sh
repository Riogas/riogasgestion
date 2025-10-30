#!/bin/bash

# Script para generar un secret seguro para GitHub Webhook

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Generador de Secret para Webhook     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

if ! command -v openssl &> /dev/null; then
    echo "openssl no está instalado. Instalando..."
    sudo apt install -y openssl
fi

SECRET=$(openssl rand -base64 32)

echo -e "${BLUE}Tu secret seguro es:${NC}"
echo ""
echo -e "${GREEN}${SECRET}${NC}"
echo ""
echo "Copia este secret y úsalo en:"
echo "1. webhook.json (en tu servidor)"
echo "2. GitHub → Settings → Webhooks → Secret"
echo ""
