# 🔌 Configuración de API Proxy - Diagnóstico

## 📊 Flujo de Comunicación

```
Browser (192.168.7.14:3000)
    ↓
    | GET/POST /api/login
    ↓
Next.js Server (Docker Container)
    ↓
    | Rewrite Rule (next.config.ts)
    ↓
Backend API (192.168.1.72:8082/puestos/gestion/)
```

## ⚙️ Configuración Actual

### 1. **Frontend (axios.ts)**
```typescript
baseURL: "/api"  // Todas las llamadas van a /api/*
```

### 2. **Next.js Proxy (next.config.ts)**
```typescript
rewrites() {
  return [
    {
      source: "/api/:path*",
      destination: process.env.NEXT_PUBLIC_API_URL 
        ? `${process.env.NEXT_PUBLIC_API_URL}/puestos/gestion/:path*`
        : "http://192.168.1.72:8082/puestos/gestion/:path*"
    }
  ]
}
```

### 3. **Backend API**
- **IP**: `192.168.1.72`
- **Puerto**: `8082`
- **Path Base**: `/puestos/gestion/`

## 🎯 URLs Finales

Cuando el frontend hace:
```javascript
api.post("/login", { ... })
```

Se traduce a:
```
Browser → /api/login
Next.js → http://192.168.1.72:8082/puestos/gestion/login
```

## 🧪 Tests desde el Servidor

### Opción 1: Desde el contenedor Docker
```bash
# Conectarse al contenedor
docker exec -it riogasgestion-app sh

# Test básico
wget -O- http://192.168.1.72:8082/puestos/gestion/login

# O con curl (si está disponible)
curl -v http://192.168.1.72:8082/puestos/gestion/login
```

### Opción 2: Desde el host (servidor)
```bash
# Ping a la IP del backend
ping 192.168.1.72

# Test de conectividad al puerto
nc -zv 192.168.1.72 8082

# O con telnet
telnet 192.168.1.72 8082

# Test HTTP completo
curl -v http://192.168.1.72:8082/puestos/gestion/login \
  -H "Content-Type: application/json" \
  -d '{"UserName":"test","Password":"test"}'

# O con wget
wget -qO- --post-data='{"UserName":"test","Password":"test"}' \
  --header='Content-Type: application/json' \
  http://192.168.1.72:8082/puestos/gestion/login
```

### Opción 3: Test de DNS/Conectividad
```bash
# Ver rutas de red
traceroute 192.168.1.72

# Ver interfaces de red
ip addr show

# Ver tabla de ruteo
ip route

# Test de conectividad desde el contenedor
docker exec -it riogasgestion-app ping 192.168.1.72
```

## 🔍 Verificación de Configuración

### Verificar .env.production en el servidor
```bash
cat ~/goya/.env.production | grep API_URL
```

Debería mostrar:
```
NEXT_PUBLIC_API_URL=http://192.168.1.72:8082
```

### Verificar logs del contenedor
```bash
docker logs riogasgestion-app --tail 100
```

Buscar líneas como:
- `Error: connect ETIMEDOUT` → No llega a la IP
- `Error: connect ECONNREFUSED` → Llega pero el puerto está cerrado
- `Error: getaddrinfo ENOTFOUND` → Problema de DNS (no aplica con IP)

## 🛠️ Posibles Problemas y Soluciones

### Problema 1: Firewall bloqueando puerto 8082
```bash
# En el servidor del backend (192.168.1.72)
sudo ufw status
sudo ufw allow 8082/tcp

# O con iptables
sudo iptables -L -n | grep 8082
```

### Problema 2: Backend no escucha en todas las interfaces
El backend debe escuchar en `0.0.0.0:8082` y no en `localhost:8082` o `127.0.0.1:8082`

```bash
# Verificar en el servidor backend
netstat -tulpn | grep 8082
# o
ss -tulpn | grep 8082
```

Debería mostrar: `0.0.0.0:8082` y NO `127.0.0.1:8082`

### Problema 3: Docker sin acceso a red externa
```bash
# Verificar red de Docker
docker network inspect bridge

# Test de conectividad desde el contenedor
docker exec -it riogasgestion-app ping 8.8.8.8
docker exec -it riogasgestion-app ping 192.168.1.72
```

### Problema 4: Variable de entorno no configurada
```bash
# Verificar que el contenedor tenga la variable
docker exec -it riogasgestion-app env | grep NEXT_PUBLIC_API_URL
```

## 🔧 Solución Rápida

Si el problema es conectividad, prueba cambiar el `docker-compose.yml`:

```yaml
services:
  app:
    # ... otras configs
    network_mode: "host"  # ← Usar la red del host directamente
```

O agregar configuración de red:

```yaml
services:
  app:
    # ... otras configs
    extra_hosts:
      - "backend.local:192.168.1.72"
```

Y cambiar el `.env.production`:
```bash
NEXT_PUBLIC_API_URL=http://backend.local:8082
```

## 📋 Checklist de Diagnóstico

Ejecuta estos comandos en orden:

```bash
# 1. Verificar que el contenedor esté corriendo
docker ps | grep riogasgestion

# 2. Verificar variable de entorno
docker exec riogasgestion-app env | grep NEXT_PUBLIC_API_URL

# 3. Test de ping desde el contenedor
docker exec riogasgestion-app ping -c 3 192.168.1.72

# 4. Test de puerto desde el contenedor
docker exec riogasgestion-app nc -zv 192.168.1.72 8082

# 5. Test de ping desde el host
ping -c 3 192.168.1.72

# 6. Test de puerto desde el host
nc -zv 192.168.1.72 8082

# 7. Ver logs en tiempo real
docker logs -f riogasgestion-app
```

## 📊 Resultado Esperado

Si todo está bien configurado:

1. ✅ Ping exitoso a 192.168.1.72
2. ✅ Puerto 8082 abierto y accesible
3. ✅ Variable NEXT_PUBLIC_API_URL configurada
4. ✅ Logs muestran requests a `/api/login` sin errores de red

Si hay errores:
- ❌ `ETIMEDOUT` → Firewall o red bloqueando
- ❌ `ECONNREFUSED` → Backend no está escuchando o puerto incorrecto
- ❌ `ENOTFOUND` → Problema de DNS (no debería pasar con IP)

## 📞 Comandos Útiles de Diagnóstico

```bash
# Ver todas las conexiones activas
docker exec riogasgestion-app netstat -an

# Ver rutas desde el contenedor
docker exec riogasgestion-app ip route

# Test HTTP completo desde el contenedor
docker exec riogasgestion-app wget -qO- http://192.168.1.72:8082/puestos/gestion/login

# Ver configuración de red del contenedor
docker inspect riogasgestion-app | grep -A 20 NetworkSettings
```

---

**Próximo Paso**: Ejecuta el checklist en tu servidor y comparte el output para identificar exactamente dónde está el problema.
