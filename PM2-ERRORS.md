# 🔧 Solución de Errores Específicos de PM2

## 🚨 Errores Detectados en los Logs

### Error 1: "Cron exists"
**Causa:** Existe un cron job duplicado o un proceso en segundo plano que interfiere.

**Solución:**
```bash
# Ver cron jobs actuales
crontab -l

# Editar y eliminar duplicados
crontab -e

# O limpiar todos los cron jobs (¡cuidado!)
crontab -r
```

---

### Error 2: "mkdir: cannot create directory '/tmp/.XIN-unix': File exists"
**Causa:** Directorio temporal corrupto o con permisos incorrectos.

**Solución:**
```bash
# Limpiar directorios temporales problemáticos
sudo rm -rf /tmp/.XIN-unix
sudo rm -rf /tmp/.X11-unix

# Reiniciar PM2
pm2 kill
pm2 start pm2.config.js
```

---

### Error 3: `[Error: x]` con usuario codificado
**Causa:** Error de autenticación o token JWT inválido en las peticiones.

**Posibles causas:**
1. Variable `JWT_SECRET` no está configurada en `.env.production`
2. La API backend no está respondiendo correctamente
3. Headers de autenticación mal formados

**Solución:**
```bash
# 1. Verificar que .env.production tenga JWT_SECRET
cat .env.production | grep JWT_SECRET

# Si no existe, agregar:
echo 'JWT_SECRET=tu-secret-super-seguro-aqui' >> .env.production
echo 'NEXTAUTH_SECRET=otro-secret-diferente' >> .env.production

# 2. Verificar que la API backend esté corriendo
curl http://tu-api-backend:8082/health

# 3. Reiniciar la aplicación
pm2 restart goya
```

---

## 🚀 Solución Automática Rápida

He creado un script que soluciona todos estos problemas:

```bash
cd /var/www/goya

# Actualizar desde GitHub
git pull origin dev

# Dar permisos
chmod +x fix-pm2-errors.sh

# Ejecutar
./fix-pm2-errors.sh
```

Este script hará:
1. ✓ Detener PM2 completamente
2. ✓ Limpiar directorios temporales problemáticos
3. ✓ Rotar logs antiguos
4. ✓ Limpiar configuración de PM2
5. ✓ Verificar .env.production
6. ✓ Verificar que el build exista
7. ✓ Ajustar permisos
8. ✓ Iniciar aplicación limpiamente

---

## 🔍 Diagnóstico Manual

### Ver logs en tiempo real:
```bash
# Ver todos los logs
pm2 logs goya

# Solo errores
pm2 logs goya --err

# Solo stdout
pm2 logs goya --out

# Últimas 50 líneas
pm2 logs goya --lines 50
```

### Ver estado detallado:
```bash
pm2 status
pm2 describe goya
pm2 monit
```

### Limpiar logs manualmente:
```bash
pm2 flush  # Limpiar todos los logs de PM2
pm2 reloadLogs  # Recargar configuración de logs
```

---

## 🛠️ Solución Manual Paso a Paso

### 1. Detener completamente PM2:
```bash
pm2 delete goya
pm2 kill
```

### 2. Limpiar archivos temporales:
```bash
sudo rm -rf /tmp/.XIN-unix
sudo rm -rf /tmp/.X11-unix
rm -rf ~/.pm2/logs/*
rm -rf ~/.pm2/pids/*
```

### 3. Verificar .env.production:
```bash
nano .env.production
```

Asegúrate de tener estas variables críticas:
```env
# Backend API
NEXT_PUBLIC_API_URL=http://tu-ip:8082

# JWT Secrets (IMPORTANTE)
JWT_SECRET=genera-un-secret-super-seguro
NEXTAUTH_SECRET=otro-secret-diferente

# URL de la aplicación
NEXT_PUBLIC_APP_URL=http://tu-dominio.com

# Node
NODE_ENV=production
```

### 4. Generar secrets seguros:
```bash
# Generar JWT_SECRET
openssl rand -base64 32

# Generar NEXTAUTH_SECRET
openssl rand -base64 32
```

### 5. Verificar que el backend API esté corriendo:
```bash
# Verificar conectividad con la API
curl -v http://192.168.1.72:8082/health

# O el endpoint que uses
curl -v http://192.168.1.72:8082/api/health
```

### 6. Limpiar y rebuilder si es necesario:
```bash
rm -rf .next
rm -rf node_modules
pnpm install
pnpm build
```

### 7. Iniciar con PM2:
```bash
pm2 start pm2.config.js
pm2 save
pm2 startup  # Configurar inicio automático
```

---

## 🔐 Variables de Entorno Críticas

Crea o edita `.env.production`:

```env
# ============================================
# CONFIGURACIÓN DE PRODUCCIÓN
# ============================================

# Node Environment
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# ============================================
# API BACKEND (¡MUY IMPORTANTE!)
# ============================================
NEXT_PUBLIC_API_URL=http://192.168.1.72:8082

# ============================================
# SEGURIDAD - JWT SECRETS
# Genera con: openssl rand -base64 32
# ============================================
JWT_SECRET=TU_SECRET_AQUI_32_CARACTERES_MIN
NEXTAUTH_SECRET=OTRO_SECRET_DIFERENTE_32_CHAR

# ============================================
# URLs PÚBLICAS
# ============================================
NEXT_PUBLIC_APP_URL=http://tu-servidor-ip:3000

# ============================================
# CONFIGURACIÓN DEL MAPA (GOYA)
# ============================================
NEXT_PUBLIC_DEFAULT_LAT=-27.4606
NEXT_PUBLIC_DEFAULT_LNG=-58.8341
NEXT_PUBLIC_DEFAULT_ZOOM=13

# ============================================
# ZONA HORARIA
# ============================================
TZ=America/Argentina/Buenos_Aires

# ============================================
# CERTIFICADOS SSL (Si aplica)
# ============================================
NODE_TLS_REJECT_UNAUTHORIZED=0
```

---

## 🧪 Verificaciones Post-Inicio

### 1. Verificar que PM2 esté corriendo:
```bash
pm2 status
```

Debe mostrar:
```
┌─────┬──────┬─────────┬─────────┬─────────┬──────────┐
│ id  │ name │ status  │ restart │ uptime  │ cpu      │
├─────┼──────┼─────────┼─────────┼─────────┼──────────┤
│ 0   │ goya │ online  │ 0       │ 2m      │ 0%       │
└─────┴──────┴─────────┴─────────┴─────────┴──────────┘
```

### 2. Probar health endpoint:
```bash
curl http://localhost:3000/api/health
```

Debe responder:
```json
{"status":"ok","timestamp":"2026-01-22T18:30:00.000Z","uptime":120}
```

### 3. Ver logs en tiempo real:
```bash
pm2 logs goya --lines 100
```

No debe mostrar errores `[Error: x]` ni "Cron exists".

### 4. Verificar conectividad con el backend:
```bash
# Desde el servidor Next.js
curl http://192.168.1.72:8082/api/health

# Debe responder con 200 OK
```

---

## 🆘 Si Aún Hay Problemas

### Verificar puertos en uso:
```bash
# Ver qué usa el puerto 3000
sudo lsof -i :3000

# Ver qué usa el puerto 8082 (API)
sudo lsof -i :8082
```

### Verificar conectividad de red:
```bash
# Ping al servidor API
ping 192.168.1.72

# Telnet al puerto de la API
telnet 192.168.1.72 8082
```

### Verificar firewall:
```bash
# Si usas ufw
sudo ufw status
sudo ufw allow 3000/tcp

# Si usas firewalld
sudo firewall-cmd --list-all
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### Ver logs del sistema:
```bash
# Logs de PM2
journalctl -u pm2-riogas -n 50

# Logs del sistema
tail -f /var/log/syslog | grep goya
```

---

## 📊 Monitoreo Continuo

### Instalar PM2 Plus (Opcional):
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### Configurar alertas:
```bash
# Ver descripción detallada
pm2 describe goya

# Monitoreo en tiempo real
pm2 monit
```

---

## 📝 Checklist de Verificación

Antes de reportar un problema, verifica:

- [ ] PM2 está corriendo: `pm2 status`
- [ ] No hay directorios temporales corruptos: `ls -la /tmp/.X*`
- [ ] `.env.production` existe y tiene `JWT_SECRET`
- [ ] La API backend está respondiendo: `curl backend-ip:8082/health`
- [ ] El puerto 3000 no está en uso por otro proceso
- [ ] Los logs no muestran errores de autenticación
- [ ] El build de Next.js se completó: `ls -la .next`
- [ ] No hay cron jobs duplicados: `crontab -l`

---

**Última actualización:** 2026-01-22

**Script de solución:** `./fix-pm2-errors.sh`
