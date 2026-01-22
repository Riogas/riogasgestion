#!/bin/bash

# Script de configuración rápida del .env.production

echo "🔧 Configuración de .env.production"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar que exista el template
if [ ! -f ".env.production.example" ]; then
    echo -e "${RED}✗ No se encontró .env.production.example${NC}"
    echo "   Asegúrate de hacer: git pull origin dev"
    exit 1
fi

# Crear .env.production desde el template
echo -e "${BLUE}1. Creando .env.production desde template...${NC}"
cp .env.production.example .env.production
echo -e "${GREEN}   ✓ Archivo creado${NC}"

# Solicitar IP del servidor backend
echo ""
echo -e "${YELLOW}2. Configurando IP del backend...${NC}"
echo -n "   Ingresa la IP del servidor backend (ejemplo: 192.168.1.72): "
read backend_ip

if [ -n "$backend_ip" ]; then
    # Reemplazar IP en el archivo
    sed -i "s/192.168.1.72/${backend_ip}/g" .env.production
    echo -e "${GREEN}   ✓ IP configurada: $backend_ip${NC}"
else
    echo -e "${YELLOW}   ⚠️  Se mantendrá IP por defecto: 192.168.1.72${NC}"
fi

# Solicitar puerto del backend
echo ""
echo -n "   Puerto del backend (presiona Enter para usar 8082): "
read backend_port
if [ -n "$backend_port" ]; then
    sed -i "s/:8082/:${backend_port}/g" .env.production
    echo -e "${GREEN}   ✓ Puerto configurado: $backend_port${NC}"
fi

# Solicitar IP del servidor n8n (chat)
echo ""
echo -e "${YELLOW}3. Configurando servidor n8n (Chat)...${NC}"
echo -n "   Ingresa la IP del servidor n8n (presiona Enter para localhost): "
read n8n_ip

if [ -n "$n8n_ip" ]; then
    sed -i "s/localhost:5678/${n8n_ip}:5678/g" .env.production
    echo -e "${GREEN}   ✓ IP n8n configurada: $n8n_ip${NC}"
else
    echo -e "${YELLOW}   ⚠️  Se mantendrá: localhost:5678${NC}"
fi

# Solicitar puerto de n8n
echo -n "   Puerto de n8n (presiona Enter para usar 5678): "
read n8n_port
if [ -n "$n8n_port" ]; then
    sed -i "s/:5678/:${n8n_port}/g" .env.production
    echo -e "${GREEN}   ✓ Puerto n8n configurado: $n8n_port${NC}"
fi

# Mostrar resumen
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Configuración completada${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Archivo creado: .env.production"
echo ""
echo "Configuración:"
echo "  - Backend API: $(grep PERMISOS_API_URL .env.production | cut -d'=' -f2)"
echo "  - n8n Chat: $(grep NEXT_PUBLIC_CHAT_API_URL .env.production | cut -d'=' -f2)"
echo "  - Aplicación ID: $(grep NEXT_PUBLIC_APLICACION_ID .env.production | cut -d'=' -f2)"
echo ""
echo "Si necesitas editar manualmente:"
echo "  ${YELLOW}nano .env.production${NC}"
echo ""
echo "Siguiente paso:"
echo "  ${YELLOW}pm2 restart goya${NC}"
echo "  ${YELLOW}pm2 logs goya${NC}"
