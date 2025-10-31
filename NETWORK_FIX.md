# 🔧 SOLUCIÓN: Docker no puede alcanzar 192.168.1.72

## ❌ Problema Detectado

```bash
docker exec riogasgestion-app ping -c 3 192.168.1.72
# Result: 100% packet loss ❌
```

**Causa**: El contenedor Docker está aislado en su propia red y no puede acceder a la red local LAN (192.168.1.0/24).

## ✅ SOLUCIÓN RÁPIDA (Recomendada)

### Opción 1: Usar `network_mode: "host"` ⭐ RECOMENDADO

Esto hace que el contenedor use directamente la red del host.

#### Ya he modificado `docker-compose.yml` con esta solución:

```yaml
services:
  riogasgestion:
    # ...
    network_mode: "host"  # ← Usar red del host
```

#### Pasos en el servidor:

```bash
cd ~/goya

# 1. Pull de los cambios
git pull origin dev

# 2. Rebuild y restart
./deploy.sh

# 3. Verificar que ahora sí funcione el ping
docker exec riogasgestion-app ping -c 3 192.168.1.72
# Debería responder: 3 packets transmitted, 3 received ✅
```

### ⚠️ Nota sobre network_mode: host

Con `network_mode: "host"`:
- ✅ El contenedor puede acceder a TODA la red del host (incluyendo 192.168.1.72)
- ✅ No necesitas mapear puertos (el contenedor usa directamente el puerto 3000 del host)
- ✅ Mejor rendimiento de red
- ⚠️ Solo funciona en Linux (no en Mac/Windows con Docker Desktop)

## 🔀 Opción 2: Si network_mode: host no funciona

Si tu servidor NO soporta `network_mode: host` (muy raro), usa esta alternativa:

### A. Usar `extra_hosts` con red bridge

```bash
# Usar el archivo docker-compose alternativo
cd ~/goya
mv docker-compose.yml docker-compose.host.yml.bak
mv docker-compose.bridge.yml docker-compose.yml
```

Y modificar `.env.production`:
```bash
# Cambiar de IP a hostname
NEXT_PUBLIC_API_URL=http://backend.riogas:8082
```

Luego:
```bash
./deploy.sh
```

### B. Usar la IP del gateway de Docker

```bash
# Encontrar la IP del host desde la perspectiva del contenedor
ip addr show docker0
# o
docker network inspect bridge | grep Gateway
```

Luego usar esa IP en lugar de 192.168.1.72 en el `.env.production`.

### C. Usar `host.docker.internal` (si está disponible)

En algunos sistemas, Docker provee un hostname especial:

```bash
# En .env.production
NEXT_PUBLIC_API_URL=http://host.docker.internal:8082
```

## 📋 Checklist Post-Solución

Después de aplicar la solución, verifica:

```bash
# 1. Ping debe funcionar
docker exec riogasgestion-app ping -c 3 192.168.1.72
# Esperado: 3 packets transmitted, 3 received ✅

# 2. Puerto debe estar accesible
docker exec riogasgestion-app nc -zv 192.168.1.72 8082
# Esperado: Connection to 192.168.1.72 8082 port [tcp/*] succeeded! ✅

# 3. HTTP debe responder
docker exec riogasgestion-app wget -qO- http://192.168.1.72:8082/puestos/gestion/login
# Esperado: Respuesta JSON del backend ✅

# 4. Logs sin errores de red
docker logs riogasgestion-app --tail 50
# No debe haber: ETIMEDOUT, ECONNREFUSED, fetch failed ✅
```

## 🎯 ¿Qué solución usar?

| Solución | Cuándo usarla | Dificultad |
|----------|---------------|------------|
| **network_mode: host** | Servidor Linux, sin restricciones de red | ⭐ Fácil |
| **extra_hosts** | Necesitas aislamiento de red | ⭐⭐ Media |
| **Gateway IP** | Docker en configuración especial | ⭐⭐⭐ Avanzada |
| **host.docker.internal** | Docker Desktop o configuración especial | ⭐⭐ Media |

## 🚀 Comando Rápido

```bash
cd ~/goya && \
git pull origin dev && \
./deploy.sh && \
echo "Verificando conectividad..." && \
docker exec riogasgestion-app ping -c 3 192.168.1.72 && \
echo "✅ Solución aplicada correctamente"
```

---

**Status**: ✅ Los cambios ya están pusheados a GitHub en la rama `dev`  
**Archivo modificado**: `docker-compose.yml`  
**Cambio principal**: Agregado `network_mode: "host"`
