#!/bin/bash

##############################################
# Guía Rápida de Resolución
# Comandos para resolver vulnerabilidades detectadas
##############################################

echo "================================================"
echo "  🚨 VULNERABILIDADES DETECTADAS EN TRACK"
echo "================================================"
echo ""
echo "Proyecto: track"
echo "Next.js: 15.5.5 (vulnerable)"
echo "Requiere: 15.5.10+ o 16.1.6"
echo ""
echo "Vulnerabilidades:"
echo "  - 1 Crítica"
echo "  - 2 High"
echo "  - 3 Moderate"
echo ""

read -p "¿Actualizar ahora? (y/n) [y]: " UPDATE
UPDATE=${UPDATE:-y}

if [ "$UPDATE" != "y" ]; then
    echo "Cancelado."
    exit 0
fi

cd /var/www/track || exit 1

echo ""
echo "➡️  Paso 1: Backup"
echo "----------------------------------------"
cp package.json package.json.backup
cp pnpm-lock.yaml pnpm-lock.yaml.backup || true
echo "✅ Backup creado"

echo ""
echo "➡️  Paso 2: Actualizar Next.js"
echo "----------------------------------------"
pnpm update next@latest

echo ""
echo "➡️  Paso 3: Verificar vulnerabilidades"
echo "----------------------------------------"
pnpm audit --prod

echo ""
echo "➡️  Paso 4: Rebuild"
echo "----------------------------------------"
pnpm build

if [ $? -eq 0 ]; then
    echo ""
    echo "➡️  Paso 5: Reiniciar PM2"
    echo "----------------------------------------"
    pm2 restart track
    
    echo ""
    echo "✅ Actualización completada!"
    echo ""
    echo "Verificar que la app funciona:"
    echo "  pm2 logs track"
    echo "  pm2 status"
    
else
    echo ""
    echo "❌ Build falló. Restaurando backup..."
    cp package.json.backup package.json
    cp pnpm-lock.yaml.backup pnpm-lock.yaml || true
    pnpm install
    echo "Backup restaurado."
fi
