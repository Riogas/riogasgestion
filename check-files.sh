#!/bin/bash

# Script para verificar archivos faltantes en el servidor

echo "🔍 Verificando archivos del proyecto..."
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Archivos críticos a verificar
files=(
    "src/components/clientes/ClienteForm.tsx"
    "src/components/dashboard/clientes/Clientes.tsx"
    "src/components/ui/card.tsx"
    "src/components/configuracion/Calles.tsx"
    "src/components/configuracion/Capas.tsx"
    "pm2.config.js"
)

missing_files=0
found_files=0

echo "📋 Verificando archivos críticos:"
echo ""

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
        ((found_files++))
    else
        echo -e "${RED}✗${NC} $file ${RED}(FALTANTE)${NC}"
        ((missing_files++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Resumen:"
echo "   Encontrados: $found_files"
echo "   Faltantes: $missing_files"
echo ""

if [ $missing_files -gt 0 ]; then
    echo -e "${RED}⚠️  HAY ARCHIVOS FALTANTES${NC}"
    echo ""
    echo "Posibles soluciones:"
    echo "1. Verificar que el git pull se haya completado correctamente"
    echo "2. Revisar permisos de archivos"
    echo "3. Verificar que la rama sea 'dev':"
    echo "   ${YELLOW}git branch${NC}"
    echo "4. Forzar actualización:"
    echo "   ${YELLOW}git fetch origin dev${NC}"
    echo "   ${YELLOW}git reset --hard origin/dev${NC}"
    echo ""
else
    echo -e "${GREEN}✓ Todos los archivos están presentes${NC}"
fi

echo ""
echo "📁 Información del repositorio:"
echo "   Rama actual: $(git branch --show-current)"
echo "   Último commit: $(git log -1 --oneline)"
echo "   Estado: $(git status --short | wc -l) archivo(s) modificado(s)"
echo ""

# Verificar estructura de componentes
echo "📂 Estructura de src/components:"
if [ -d "src/components" ]; then
    tree -L 2 src/components/ 2>/dev/null || find src/components/ -maxdepth 2 -type f -name "*.tsx" | head -20
else
    echo -e "${RED}   Directorio src/components no existe!${NC}"
fi
