#!/bin/bash

# Script para solucionar errores comunes de PM2

echo "🔧 Solucionando errores de PM2..."
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Detener aplicación
echo -e "${BLUE}1. Deteniendo aplicación PM2...${NC}"
pm2 delete goya 2>/dev/null || echo "   No hay procesos PM2 corriendo"
pm2 kill 2>/dev/null || echo "   PM2 daemon detenido"
echo -e "${GREEN}   ✓ Procesos PM2 detenidos${NC}"

# 2. Limpiar directorio temporal problemático
echo ""
echo -e "${BLUE}2. Limpiando directorios temporales...${NC}"
sudo rm -rf /tmp/.XIN-unix 2>/dev/null || echo "   Directorio .XIN-unix no existe"
sudo rm -rf /tmp/.X11-unix 2>/dev/null || echo "   Directorio .X11-unix no existe"
echo -e "${GREEN}   ✓ Directorios temporales limpiados${NC}"

# 3. Limpiar logs antiguos
echo ""
echo -e "${BLUE}3. Limpiando logs antiguos...${NC}"
mkdir -p logs
if [ -f "logs/pm2-error.log" ]; then
    mv logs/pm2-error.log "logs/pm2-error.log.old.$(date +%Y%m%d_%H%M%S)"
fi
if [ -f "logs/pm2-out.log" ]; then
    mv logs/pm2-out.log "logs/pm2-out.log.old.$(date +%Y%m%d_%H%M%S)"
fi
touch logs/pm2-error.log
touch logs/pm2-out.log
echo -e "${GREEN}   ✓ Logs rotados${NC}"

# 4. Limpiar configuración de PM2
echo ""
echo -e "${BLUE}4. Limpiando configuración de PM2...${NC}"
rm -rf ~/.pm2/logs/* 2>/dev/null
rm -rf ~/.pm2/pids/* 2>/dev/null
pm2 flush 2>/dev/null
echo -e "${GREEN}   ✓ Configuración de PM2 limpiada${NC}"

# 5. Verificar variables de entorno críticas
echo ""
echo -e "${BLUE}5. Verificando variables de entorno...${NC}"
if [ ! -f ".env.production" ]; then
    echo -e "${RED}   ⚠️  ADVERTENCIA: .env.production no existe${NC}"
    echo "   Creando desde template..."
    if [ -f ".env.production.example" ]; then
        cp .env.production.example .env.production
        echo -e "${YELLOW}   ⚠️  IMPORTANTE: Edita .env.production con valores reales${NC}"
    else
        echo -e "${RED}   ✗ No se encontró .env.production.example${NC}"
    fi
else
    echo -e "${GREEN}   ✓ .env.production existe${NC}"
    
    # Verificar variables críticas
    if grep -q "NEXT_PUBLIC_API_URL" .env.production; then
        echo -e "${GREEN}   ✓ NEXT_PUBLIC_API_URL configurado${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Falta NEXT_PUBLIC_API_URL en .env.production${NC}"
    fi
fi

# 6. Verificar que el build esté completo
echo ""
echo -e "${BLUE}6. Verificando build de Next.js...${NC}"
if [ ! -d ".next" ]; then
    echo -e "${YELLOW}   ⚠️  Directorio .next no existe. Ejecutando build...${NC}"
    pnpm build
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}   ✓ Build completado${NC}"
    else
        echo -e "${RED}   ✗ Build falló. Revisa los errores arriba.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}   ✓ Build existe${NC}"
fi

# 7. Verificar permisos
echo ""
echo -e "${BLUE}7. Verificando permisos...${NC}"
chmod -R 755 node_modules/.bin 2>/dev/null
chmod +x node_modules/next/dist/bin/next 2>/dev/null
echo -e "${GREEN}   ✓ Permisos ajustados${NC}"

# 8. Iniciar aplicación con PM2
echo ""
echo -e "${BLUE}8. Iniciando aplicación con PM2...${NC}"
pm2 start pm2.config.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}   ✓ Aplicación iniciada${NC}"
    
    # Esperar un momento
    sleep 3
    
    # Verificar estado
    echo ""
    echo -e "${BLUE}9. Verificando estado...${NC}"
    pm2 status
    
    # Mostrar logs recientes
    echo ""
    echo -e "${BLUE}10. Últimas líneas de logs:${NC}"
    echo -e "${YELLOW}--- STDOUT ---${NC}"
    tail -n 10 logs/pm2-out.log 2>/dev/null || echo "No hay logs aún"
    echo ""
    echo -e "${YELLOW}--- STDERR ---${NC}"
    tail -n 10 logs/pm2-error.log 2>/dev/null || echo "No hay errores"
    
    # Guardar configuración
    echo ""
    echo -e "${BLUE}11. Guardando configuración de PM2...${NC}"
    pm2 save
    echo -e "${GREEN}   ✓ Configuración guardada${NC}"
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ ¡APLICACIÓN INICIADA CORRECTAMENTE!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Comandos útiles:"
    echo "  ${YELLOW}pm2 logs goya${NC}        - Ver logs en tiempo real"
    echo "  ${YELLOW}pm2 status${NC}           - Ver estado"
    echo "  ${YELLOW}pm2 restart goya${NC}     - Reiniciar aplicación"
    echo "  ${YELLOW}pm2 stop goya${NC}        - Detener aplicación"
    echo ""
    echo "Probar la aplicación:"
    echo "  ${YELLOW}curl http://localhost:3000/api/health${NC}"
    
else
    echo -e "${RED}   ✗ Error al iniciar aplicación${NC}"
    echo ""
    echo "Revisa los logs para más detalles:"
    echo "  ${YELLOW}cat logs/pm2-error.log${NC}"
    exit 1
fi
