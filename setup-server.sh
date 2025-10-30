#!/bin/bash

# ============================================
# SETUP INICIAL DEL SERVIDOR
# ============================================
# Script para configuración inicial del servidor
# Linux (Ubuntu/Debian)
# ============================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔════════════════════════════════════════╗"
echo "║   SETUP INICIAL - RIOGASGESTION        ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar si es root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Por favor ejecuta este script como root o con sudo${NC}"
    exit 1
fi

echo -e "${BLUE}[1/7] Actualizando sistema...${NC}"
apt update && apt upgrade -y

echo -e "${BLUE}[2/7] Instalando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    apt install -y docker.io
    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}✓ Docker instalado${NC}"
else
    echo -e "${GREEN}✓ Docker ya está instalado${NC}"
fi

echo -e "${BLUE}[3/7] Instalando Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    apt install -y docker-compose
    echo -e "${GREEN}✓ Docker Compose instalado${NC}"
else
    echo -e "${GREEN}✓ Docker Compose ya está instalado${NC}"
fi

echo -e "${BLUE}[4/7] Instalando Git...${NC}"
if ! command -v git &> /dev/null; then
    apt install -y git
    echo -e "${GREEN}✓ Git instalado${NC}"
else
    echo -e "${GREEN}✓ Git ya está instalado${NC}"
fi

echo -e "${BLUE}[5/7] Instalando utilidades...${NC}"
apt install -y curl wget nano htop

echo -e "${BLUE}[6/7] Configurando usuario...${NC}"
read -p "Nombre del usuario para Docker (actual: $SUDO_USER): " DOCKER_USER
DOCKER_USER=${DOCKER_USER:-$SUDO_USER}

if [ -n "$DOCKER_USER" ]; then
    usermod -aG docker "$DOCKER_USER"
    echo -e "${GREEN}✓ Usuario $DOCKER_USER agregado al grupo docker${NC}"
fi

echo -e "${BLUE}[7/7] Creando directorios...${NC}"
mkdir -p /home/riogas/goya
chown -R "$DOCKER_USER:$DOCKER_USER" /home/riogas/goya
echo -e "${GREEN}✓ Directorio /home/riogas/goya creado${NC}"

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}     ✓ SETUP COMPLETADO${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Próximos pasos:${NC}"
echo "1. Cerrar sesión y volver a entrar (para aplicar permisos de docker)"
echo "2. cd /home/riogas/goya"
echo "3. git clone <tu-repo> ."
echo "4. cp .env.production.example .env.production"
echo "5. nano .env.production (configurar variables)"
echo "6. chmod +x deploy.sh webhook-deploy.sh helper.sh"
echo "7. ./deploy.sh"
echo ""
echo -e "${GREEN}¡Listo!${NC}"
