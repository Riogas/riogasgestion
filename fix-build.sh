#!/bin/bash

# Script de solución rápida para problemas de build en el servidor

echo "🔧 Iniciando diagnóstico y solución..."
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Verificar rama actual
echo -e "${BLUE}1. Verificando rama...${NC}"
current_branch=$(git branch --show-current)
echo "   Rama actual: $current_branch"

if [ "$current_branch" != "dev" ]; then
    echo -e "${YELLOW}   Cambiando a rama dev...${NC}"
    git checkout dev
fi

# 2. Limpiar posibles archivos en conflicto
echo ""
echo -e "${BLUE}2. Limpiando archivos en conflicto...${NC}"
git clean -fd
echo -e "${GREEN}   ✓ Limpieza completada${NC}"

# 3. Descartar cambios locales
echo ""
echo -e "${BLUE}3. Descartando cambios locales...${NC}"
git reset --hard HEAD
echo -e "${GREEN}   ✓ Reset completado${NC}"

# 4. Actualizar desde origin
echo ""
echo -e "${BLUE}4. Actualizando desde origin/dev...${NC}"
git fetch origin dev
git reset --hard origin/dev
echo -e "${GREEN}   ✓ Actualización completada${NC}"

# 5. Verificar archivos críticos
echo ""
echo -e "${BLUE}5. Verificando archivos críticos...${NC}"
files=(
    "src/components/clientes/ClienteForm.tsx"
    "src/components/dashboard/clientes/Clientes.tsx"
    "src/components/ui/card.tsx"
    "src/components/configuracion/Calles.tsx"
    "pm2.config.js"
)

missing=0
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "   ${GREEN}✓${NC} $file"
    else
        echo -e "   ${RED}✗${NC} $file ${RED}(FALTANTE)${NC}"
        ((missing++))
    fi
done

if [ $missing -gt 0 ]; then
    echo ""
    echo -e "${RED}⚠️  ADVERTENCIA: Faltan $missing archivo(s) crítico(s)${NC}"
    echo ""
    echo "Intentando clonar de nuevo..."
    cd ..
    backup_dir="goya_backup_$(date +%Y%m%d_%H%M%S)"
    echo "   Creando backup en: $backup_dir"
    mv goya "$backup_dir"
    echo "   Clonando repositorio nuevamente..."
    git clone -b dev git@github.com:Riogas/riogasgestion.git goya
    cd goya
    echo -e "${GREEN}   ✓ Repositorio clonado${NC}"
fi

# 6. Limpiar node_modules y cache
echo ""
echo -e "${BLUE}6. Limpiando dependencias y cache...${NC}"
rm -rf node_modules
rm -rf .next
rm -rf .pnpm-store
echo -e "${GREEN}   ✓ Limpieza completada${NC}"

# 7. Reinstalar dependencias
echo ""
echo -e "${BLUE}7. Instalando dependencias...${NC}"
pnpm install --frozen-lockfile
echo -e "${GREEN}   ✓ Dependencias instaladas${NC}"

# 8. Intentar build
echo ""
echo -e "${BLUE}8. Compilando aplicación...${NC}"
pnpm build

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ ¡BUILD EXITOSO!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Puedes iniciar la aplicación con:"
    echo "   ${YELLOW}pm2 start pm2.config.js${NC}"
    echo "   O:"
    echo "   ${YELLOW}pnpm start${NC}"
else
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ BUILD FALLÓ${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Por favor revisa los errores arriba."
    echo "Puedes contactar al equipo de desarrollo."
fi
