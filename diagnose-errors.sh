#!/bin/bash

# Script para diagnosticar y solucionar errores [Error: x] en Next.js

echo "🔍 Diagnosticando errores [Error: x]..."
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Verificar .env.production
echo -e "${BLUE}1. Verificando variables de entorno...${NC}"

if [ ! -f ".env.production" ]; then
    echo -e "${RED}   ✗ .env.production NO EXISTE${NC}"
    echo ""
    echo "Creando desde template..."
    if [ -f ".env.production.example" ]; then
        cp .env.production.example .env.production
        echo -e "${YELLOW}   ⚠️  Archivo creado. DEBES EDITARLO AHORA.${NC}"
    fi
    exit 1
fi

echo -e "${GREEN}   ✓ .env.production existe${NC}"
echo ""

# Verificar variables críticas
echo -e "${BLUE}2. Verificando variables críticas...${NC}"

critical_vars=(
    "NEXT_PUBLIC_API_URL"
    "JWT_SECRET"
    "NEXTAUTH_SECRET"
)

missing_vars=0

for var in "${critical_vars[@]}"; do
    if grep -q "^${var}=" .env.production 2>/dev/null; then
        value=$(grep "^${var}=" .env.production | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        if [ -z "$value" ] || [ "$value" = "CHANGE_ME" ] || [ "$value" = "genera-un-secret" ]; then
            echo -e "${YELLOW}   ⚠️  ${var} existe pero tiene valor de ejemplo${NC}"
            ((missing_vars++))
        else
            echo -e "${GREEN}   ✓ ${var} configurado${NC}"
        fi
    else
        echo -e "${RED}   ✗ ${var} NO EXISTE${NC}"
        ((missing_vars++))
    fi
done

if [ $missing_vars -gt 0 ]; then
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}⚠️  HAY VARIABLES FALTANTES O MAL CONFIGURADAS${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Edita .env.production y configura:"
    echo ""
    echo "1. NEXT_PUBLIC_API_URL:"
    echo "   ${YELLOW}NEXT_PUBLIC_API_URL=http://192.168.1.72:8082${NC}"
    echo ""
    echo "2. JWT_SECRET (generar con: openssl rand -base64 32):"
    echo "   ${YELLOW}JWT_SECRET=$(openssl rand -base64 32)${NC}"
    echo ""
    echo "3. NEXTAUTH_SECRET (generar con: openssl rand -base64 32):"
    echo "   ${YELLOW}NEXTAUTH_SECRET=$(openssl rand -base64 32)${NC}"
    echo ""
    echo "Editar ahora:"
    echo "   ${YELLOW}nano .env.production${NC}"
    echo ""
    exit 1
fi

# 3. Verificar conectividad con API backend
echo ""
echo -e "${BLUE}3. Verificando conectividad con API backend...${NC}"

api_url=$(grep "^NEXT_PUBLIC_API_URL=" .env.production | cut -d'=' -f2 | tr -d '"' | tr -d "'")

if [ -n "$api_url" ]; then
    echo "   URL API: $api_url"
    
    # Extraer host y puerto
    host=$(echo $api_url | sed 's|http://||' | sed 's|https://||' | cut -d':' -f1)
    port=$(echo $api_url | sed 's|http://||' | sed 's|https://||' | cut -d':' -f2 | cut -d'/' -f1)
    
    # Verificar conectividad
    if command -v curl &> /dev/null; then
        if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$api_url/health" | grep -q "200\|404\|401"; then
            echo -e "${GREEN}   ✓ Backend API responde${NC}"
        else
            echo -e "${RED}   ✗ Backend API no responde en: $api_url${NC}"
            echo -e "${YELLOW}   ⚠️  Verifica que el backend esté corriendo${NC}"
        fi
    fi
else
    echo -e "${YELLOW}   ⚠️  No se pudo extraer NEXT_PUBLIC_API_URL${NC}"
fi

# 4. Verificar middleware
echo ""
echo -e "${BLUE}4. Verificando middleware...${NC}"

if [ -f "src/middleware.ts" ]; then
    echo -e "${GREEN}   ✓ src/middleware.ts existe${NC}"
    
    # Ver si tiene DEBUG_MW
    if grep -q "DEBUG_MW" src/middleware.ts; then
        echo -e "${YELLOW}   ⚠️  Middleware tiene DEBUG_MW (modo debug)${NC}"
    fi
    
    # Ver si ejecuta comandos del sistema
    if grep -qE "exec|spawn|child_process|top|ps" src/middleware.ts; then
        echo -e "${RED}   ⚠️  MIDDLEWARE EJECUTA COMANDOS DEL SISTEMA${NC}"
        echo -e "${YELLOW}   Esto puede causar los errores [Error: x]${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠️  No se encontró middleware${NC}"
fi

# 5. Sugerencias
echo ""
echo -e "${BLUE}5. Recomendaciones:${NC}"
echo ""

echo "A) Si los errores persisten:"
echo "   1. Verificar que el backend API esté corriendo"
echo "   2. Verificar configuración de CORS en el backend"
echo "   3. Revisar código del middleware (src/middleware.ts)"
echo ""

echo "B) Variables de entorno recomendadas adicionales:"
echo "   ${YELLOW}NODE_ENV=production${NC}"
echo "   ${YELLOW}NODE_TLS_REJECT_UNAUTHORIZED=0${NC} (si hay problemas SSL)"
echo ""

echo "C) Reiniciar después de cambios:"
echo "   ${YELLOW}pm2 restart goya${NC}"
echo "   ${YELLOW}pm2 logs goya --lines 50${NC}"
echo ""

# 6. Mostrar estado actual
echo ""
echo -e "${BLUE}6. Estado actual de la aplicación:${NC}"
pm2 describe goya 2>/dev/null | grep -E "status|uptime|restarts|memory|cpu" || echo "   No se pudo obtener estado"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Diagnóstico completado${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
