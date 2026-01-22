#!/bin/bash

# Script rápido para reiniciar PM2 sin bloqueos

echo "🔧 Reinicio rápido de PM2..."
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Detener solo goya (no matar todo PM2)
echo -e "${BLUE}1. Deteniendo aplicación goya...${NC}"
pm2 delete goya 2>/dev/null || echo "   Goya no estaba corriendo"
echo -e "${GREEN}   ✓ Detenido${NC}"

# 2. Limpiar temporales problemáticos
echo ""
echo -e "${BLUE}2. Limpiando temporales...${NC}"
sudo rm -rf /tmp/.XIN-unix 2>/dev/null || true
echo -e "${GREEN}   ✓ Limpio${NC}"

# 3. Limpiar logs de goya
echo ""
echo -e "${BLUE}3. Rotando logs...${NC}"
mkdir -p logs
[ -f "logs/pm2-error.log" ] && mv logs/pm2-error.log "logs/pm2-error.log.$(date +%Y%m%d_%H%M%S).bak"
[ -f "logs/pm2-out.log" ] && mv logs/pm2-out.log "logs/pm2-out.log.$(date +%Y%m%d_%H%M%S).bak"
touch logs/pm2-error.log logs/pm2-out.log
echo -e "${GREEN}   ✓ Logs rotados${NC}"

# 4. Verificar .env.production
echo ""
echo -e "${BLUE}4. Verificando configuración...${NC}"
if [ ! -f ".env.production" ]; then
    echo -e "${RED}   ✗ .env.production no existe${NC}"
    if [ -f ".env.production.example" ]; then
        cp .env.production.example .env.production
        echo -e "${YELLOW}   ⚠️  Creado desde ejemplo. EDÍTALO antes de continuar.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}   ✓ .env.production OK${NC}"
fi

# 5. Verificar build
echo ""
echo -e "${BLUE}5. Verificando build...${NC}"
if [ ! -d ".next" ]; then
    echo -e "${YELLOW}   ⚠️  No hay build. Ejecutando pnpm build...${NC}"
    pnpm build || { echo -e "${RED}   ✗ Build falló${NC}"; exit 1; }
fi
echo -e "${GREEN}   ✓ Build OK${NC}"

# 6. Iniciar con PM2
echo ""
echo -e "${BLUE}6. Iniciando goya...${NC}"
pm2 start pm2.config.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}   ✓ Iniciado${NC}"
    sleep 3
    
    echo ""
    echo -e "${BLUE}7. Estado:${NC}"
    pm2 status
    
    echo ""
    echo -e "${BLUE}8. Guardando configuración...${NC}"
    pm2 save
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ ¡LISTO!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Ver logs:   ${YELLOW}pm2 logs goya${NC}"
    echo "Ver estado: ${YELLOW}pm2 status${NC}"
    echo "Probar:     ${YELLOW}curl http://localhost:3000/api/health${NC}"
    echo ""
else
    echo -e "${RED}   ✗ Error al iniciar${NC}"
    echo "Ver logs: ${YELLOW}cat logs/pm2-error.log${NC}"
    exit 1
fi
