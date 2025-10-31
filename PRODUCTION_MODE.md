# 🚀 Modo Producción en Next.js con Docker

## 📋 Estado Actual

Tu Dockerfile **YA ESTÁ CONFIGURADO CORRECTAMENTE** para producción:

```dockerfile
# Etapa 3: Runner (Imagen final)
ENV NODE_ENV=production
CMD ["node", "server.js"]  # ✅ Usa el build compilado, NO next dev
```

## 🔍 ¿Por qué Parece que Compila Cada Vez?

### Escenario 1: Compilación Durante el BUILD (Normal ✅)

Cuando ejecutas `./deploy.sh`, verás esto:

```bash
[INFO] Paso 4/7: Construyendo nueva imagen Docker...
# ⏳ Aquí compila durante 5-10 minutos
RUN pnpm build
```

**Esto es NORMAL y SOLO SUCEDE UNA VEZ** cuando se crea la imagen Docker.

### Escenario 2: La App YA ESTÁ Compilada (Correcto ✅)

Después del deploy, cuando accedes a la aplicación:
- ✅ **NO** debería compilar nada
- ✅ Debería responder **instantáneamente**
- ✅ Los archivos ya están pre-compilados en `.next/`

## 🧪 Verificación: ¿Está en Producción?

### Test 1: Verificar modo de ejecución

```bash
# En el servidor
docker exec riogasgestion-app ps aux

# Deberías ver:
# node server.js    ✅ CORRECTO (producción)
# 
# NO deberías ver:
# next dev          ❌ INCORRECTO (desarrollo)
```

### Test 2: Verificar NODE_ENV

```bash
docker exec riogasgestion-app env | grep NODE_ENV

# Debería mostrar:
# NODE_ENV=production  ✅
```

### Test 3: Verificar logs

```bash
docker logs riogasgestion-app --tail 20

# En PRODUCCIÓN deberías ver:
#   ▲ Next.js 15.3.4
#   - Local:        http://localhost:3000
#   ✓ Ready in 104ms  ✅ <- Inicia RÁPIDO
#
# En DESARROLLO verías:
#   Compiling /page ...
#   Compiled in 2.3s    ❌ <- Compila cada página
```

### Test 4: Velocidad de carga

```bash
# Medir tiempo de respuesta
time curl -s http://localhost:3000 > /dev/null

# En producción: < 200ms ✅
# En desarrollo: > 2000ms ❌
```

## 🐛 Si Aún Compila en Cada Request

### Problema: Comando incorrecto en docker-compose.yml

Verifica que **NO** tengas esto:

```yaml
# ❌ MAL - Esto ejecuta en modo desarrollo
command: pnpm dev
# o
command: npm run dev
```

Debería ser:

```yaml
# ✅ CORRECTO - No especificar command (usa el CMD del Dockerfile)
# (sin línea de command)
```

### Problema: Variable de entorno incorrecta

En `.env.production` o `docker-compose.yml`, verifica:

```bash
# Debe ser:
NODE_ENV=production  ✅

# NO:
NODE_ENV=development  ❌
```

## 🔧 Solución si NO Está en Producción

### Paso 1: Verificar docker-compose.yml

```bash
cat ~/goya/docker-compose.yml | grep -A 5 "environment:"
```

Debe tener:
```yaml
environment:
  - NODE_ENV=production  ✅
```

### Paso 2: Verificar .env.production

```bash
cat ~/goya/.env.production | grep NODE_ENV
```

Debe mostrar:
```
NODE_ENV=production  ✅
```

### Paso 3: Rebuild completo si hay dudas

```bash
cd ~/goya

# Limpiar TODO y rebuild from scratch
docker-compose down
docker rmi riogasgestion:latest
./deploy.sh
```

## 📊 Diferencias: Desarrollo vs Producción

| Aspecto | Desarrollo | Producción |
|---------|------------|------------|
| Comando | `next dev` | `node server.js` |
| Compilación | En cada request | Una sola vez al buildear |
| Tiempo de inicio | ~5-10s | ~100ms |
| Hot reload | ✅ Sí | ❌ No |
| Optimizaciones | ❌ No | ✅ Minificación, tree-shaking |
| Source maps | ✅ Completos | ⚠️ Limitados |
| Tamaño | ~500MB | ~150MB |

## 🎯 Script de Diagnóstico

Ejecuta esto en tu servidor:

```bash
#!/bin/bash
echo "=== DIAGNÓSTICO DE MODO DE EJECUCIÓN ==="
echo ""

echo "1. Proceso corriendo:"
docker exec riogasgestion-app ps aux | grep -E "node|next"
echo ""

echo "2. Variable NODE_ENV:"
docker exec riogasgestion-app env | grep NODE_ENV
echo ""

echo "3. Comando de inicio (desde Dockerfile):"
docker inspect riogasgestion-app | jq '.[0].Config.Cmd'
echo ""

echo "4. Últimos logs:"
docker logs riogasgestion-app --tail 5
echo ""

echo "5. Test de velocidad:"
time curl -s -o /dev/null http://localhost:3000
echo ""

echo "=== FIN DEL DIAGNÓSTICO ==="
```

Guárdalo como `check-production.sh` y ejecuta:

```bash
chmod +x check-production.sh
./check-production.sh
```

## ✅ Resultado Esperado

Después de ejecutar `./deploy.sh`, deberías ver:

```bash
docker logs riogasgestion-app --tail 10

# Output:
   ▲ Next.js 15.3.4
   - Local:        http://localhost:3000
   - Network:      http://0.0.0.0:3000

 ✓ Starting...
 ✓ Ready in 104ms    # ← MUY RÁPIDO = Producción ✅
```

Y al acceder desde el navegador:
- ⚡ Carga instantánea
- ❌ Sin mensajes de compilación
- ✅ Respuestas < 200ms

---

**Comparte el output del diagnóstico** para confirmar que está en producción correctamente. 🚀
