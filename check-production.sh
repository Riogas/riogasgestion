#!/bin/bash

echo "╔════════════════════════════════════════════════╗"
echo "║  DIAGNÓSTICO DE MODO DE EJECUCIÓN - NEXT.JS    ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

echo "📊 1. PROCESO CORRIENDO:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker exec riogasgestion-app ps aux 2>/dev/null | grep -E "node|next" | grep -v grep || echo "⚠️  Contenedor no está corriendo"
echo ""

echo "🔧 2. VARIABLE NODE_ENV:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
NODE_ENV=$(docker exec riogasgestion-app env 2>/dev/null | grep NODE_ENV)
if [ -z "$NODE_ENV" ]; then
    echo "❌ NODE_ENV no está definida"
else
    echo "$NODE_ENV"
    if [[ "$NODE_ENV" == *"production"* ]]; then
        echo "✅ Modo PRODUCCIÓN detectado"
    else
        echo "⚠️  NO está en modo producción"
    fi
fi
echo ""

echo "🚀 3. COMANDO DE INICIO:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker inspect riogasgestion-app 2>/dev/null | grep -A 3 '"Cmd"' | tail -4 || echo "⚠️  No se pudo obtener el comando"
echo ""

echo "📝 4. ÚLTIMOS LOGS (10 líneas):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker logs riogasgestion-app --tail 10 2>/dev/null || echo "⚠️  No hay logs disponibles"
echo ""

echo "⏱️  5. TEST DE VELOCIDAD DE RESPUESTA:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
START=$(date +%s%N)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

if [ $? -eq 0 ]; then
    echo "HTTP Status: $HTTP_CODE"
    echo "Tiempo de respuesta: ${DURATION}ms"
    
    if [ $DURATION -lt 500 ]; then
        echo "✅ EXCELENTE - Respuesta rápida (Producción)"
    elif [ $DURATION -lt 2000 ]; then
        echo "⚠️  ACEPTABLE - Pero podría ser más rápido"
    else
        echo "❌ LENTO - Posiblemente en modo desarrollo"
    fi
else
    echo "❌ No se pudo conectar a localhost:3000"
fi
echo ""

echo "🔍 6. VERIFICAR ARCHIVO .next/ EN CONTENEDOR:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker exec riogasgestion-app ls -lh .next/ 2>/dev/null | head -5 || echo "⚠️  No se encuentra .next/"
echo ""

echo "📦 7. VERIFICAR server.js (standalone build):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if docker exec riogasgestion-app ls server.js 2>/dev/null; then
    echo "✅ server.js encontrado (Modo standalone - PRODUCCIÓN)"
else
    echo "❌ server.js NO encontrado (Posible problema con el build)"
fi
echo ""

echo "╔════════════════════════════════════════════════╗"
echo "║  RESUMEN DEL DIAGNÓSTICO                       ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Resumen automático
ISSUES=0

# Check NODE_ENV
if [[ "$NODE_ENV" != *"production"* ]]; then
    echo "❌ NODE_ENV no está en producción"
    ISSUES=$((ISSUES + 1))
fi

# Check response time
if [ $DURATION -gt 2000 ]; then
    echo "❌ Tiempo de respuesta muy lento"
    ISSUES=$((ISSUES + 1))
fi

# Check server.js
if ! docker exec riogasgestion-app ls server.js 2>/dev/null >/dev/null; then
    echo "❌ server.js no encontrado"
    ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
    echo "✅ TODO CORRECTO - La aplicación está en modo PRODUCCIÓN"
else
    echo "⚠️  Se encontraron $ISSUES problema(s)"
    echo ""
    echo "📝 Posibles soluciones:"
    echo "   1. Verificar docker-compose.yml (NODE_ENV=production)"
    echo "   2. Verificar .env.production"
    echo "   3. Hacer rebuild: ./deploy.sh"
fi
echo ""
