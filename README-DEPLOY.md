# 🚀 Guía de Deployment - RioGasGestion

Esta guía explica cómo deployar la aplicación **RioGasGestion** en un servidor Linux usando Docker.

---

## 📋 Tabla de Contenidos

1. [Prerequisitos](#prerequisitos)
2. [Instalación Inicial](#instalación-inicial)
3. [Configuración](#configuración)
4. [Deploy Manual](#deploy-manual)
5. [Autodeploy con GitHub Webhook](#autodeploy-con-github-webhook)
6. [Comandos Útiles](#comandos-útiles)
7. [Troubleshooting](#troubleshooting)
8. [Monitoreo](#monitoreo)

---

## 🔧 Prerequisitos

### En el servidor Linux:

```bash
# 1. Docker y Docker Compose
sudo apt update
sudo apt install -y docker.io docker-compose

# Verificar instalación
docker --version
docker-compose --version

# 2. Git
sudo apt install -y git

# 3. Agregar tu usuario al grupo docker (opcional)
sudo usermod -aG docker $USER
# Cerrar sesión y volver a entrar para que tenga efecto

# 4. Crear directorio del proyecto
sudo mkdir -p /opt/riogasgestion
sudo chown $USER:$USER /opt/riogasgestion
```

---

## 📦 Instalación Inicial

### 1. Clonar el repositorio

```bash
cd /opt/riogasgestion
git clone https://github.com/Riogas/riogasgestion.git .

# O si ya tienes el código:
# git clone <tu-repo-url> .

# Cambiar a la rama dev (o la que uses)
git checkout dev
```

### 2. Configurar variables de entorno

```bash
# Copiar el template de producción
cp .env.production.example .env.production

# Editar con tus valores reales
nano .env.production
```

**Variables críticas a configurar:**
- `NEXT_PUBLIC_API_URL` - URL de tu API backend
- `JWT_SECRET` - Secret para JWT (genera uno seguro)
- `NEXT_PUBLIC_APP_URL` - URL pública de tu app
- Cualquier API key de servicios externos (mapas, etc.)

### 3. Dar permisos de ejecución a los scripts

```bash
chmod +x deploy.sh
chmod +x webhook-deploy.sh
```

---

## 🚀 Deploy Manual

Para deployar manualmente, simplemente ejecuta:

```bash
./deploy.sh
```

Este script automáticamente:
1. ✅ Hace backup de la imagen actual
2. ✅ Detiene contenedores en ejecución
3. ✅ Construye nueva imagen Docker
4. ✅ Inicia los contenedores
5. ✅ Verifica el healthcheck
6. ✅ Hace rollback automático si hay errores

### Ver logs del deploy

```bash
# Logs guardados
cat logs/deploy_YYYYMMDD_HHMMSS.log

# Ver último log
ls -t logs/deploy_*.log | head -1 | xargs cat
```

---

## 🔄 Autodeploy con GitHub Webhook

### Configuración del Webhook en el Servidor

#### 1. Instalar webhook listener (usando `webhook` de GitHub)

```bash
# Instalar webhook
sudo apt install -y webhook

# O instalar desde Go (más actualizado)
sudo apt install -y golang
go install github.com/adnanh/webhook@latest
```

#### 2. Crear configuración del webhook

Crear archivo `/opt/riogasgestion/webhook.json`:

```json
[
  {
    "id": "riogasgestion-deploy",
    "execute-command": "/opt/riogasgestion/webhook-deploy.sh",
    "command-working-directory": "/opt/riogasgestion",
    "response-message": "Deploy iniciado correctamente",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hash-sha256",
            "secret": "TU_SECRET_AQUI",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/dev",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  }
]
```

**⚠️ Importante:** Cambia `TU_SECRET_AQUI` por un secret seguro.

#### 3. Crear servicio systemd para el webhook

Crear archivo `/etc/systemd/system/github-webhook.service`:

```ini
[Unit]
Description=GitHub Webhook Listener
After=network.target

[Service]
Type=simple
User=tu-usuario
WorkingDirectory=/opt/riogasgestion
ExecStart=/usr/bin/webhook -hooks /opt/riogasgestion/webhook.json -verbose -port 9000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 4. Iniciar el servicio

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Iniciar webhook
sudo systemctl start github-webhook

# Habilitar para inicio automático
sudo systemctl enable github-webhook

# Ver estado
sudo systemctl status github-webhook
```

#### 5. Configurar firewall (si es necesario)

```bash
# Permitir puerto 9000 (o el que uses)
sudo ufw allow 9000/tcp
```

### Configuración en GitHub

1. Ve a tu repositorio en GitHub
2. **Settings** → **Webhooks** → **Add webhook**
3. Configurar:
   - **Payload URL**: `http://tu-servidor.com:9000/hooks/riogasgestion-deploy`
   - **Content type**: `application/json`
   - **Secret**: El mismo que pusiste en `webhook.json`
   - **Events**: Selecciona "Just the push event"
   - **Active**: ✅ Marcado

4. **Add webhook**

### Probar el webhook

```bash
# Ver logs del servicio
sudo journalctl -u github-webhook -f

# Hacer un push a la rama dev y ver si se ejecuta automáticamente
```

---

## 🛠️ Comandos Útiles

### Docker

```bash
# Ver contenedores corriendo
docker ps

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker logs -f riogasgestion-app

# Reiniciar contenedor
docker-compose restart

# Detener todo
docker-compose down

# Reconstruir sin caché
docker-compose build --no-cache

# Entrar al contenedor
docker exec -it riogasgestion-app sh
```

### Mantenimiento

```bash
# Limpiar imágenes antiguas
docker image prune -a

# Ver uso de disco
docker system df

# Limpiar todo (⚠️ cuidado)
docker system prune -a --volumes
```

### Logs de la aplicación

```bash
# Ver logs guardados
ls -lh logs/

# Ver último deploy
tail -f logs/deploy_*.log

# Ver logs de webhook
tail -f logs/webhook_*.log
```

---

## 🐛 Troubleshooting

### Contenedor no inicia

```bash
# Ver logs detallados
docker-compose logs

# Ver eventos de Docker
docker events

# Verificar variables de entorno
docker exec riogasgestion-app env
```

### Error de permisos

```bash
# Asegurar ownership correcto
sudo chown -R $USER:$USER /opt/riogasgestion

# Dar permisos a scripts
chmod +x *.sh
```

### Puerto en uso

```bash
# Ver qué está usando el puerto 3000
sudo lsof -i :3000

# Matar proceso si es necesario
sudo kill -9 <PID>
```

### Aplicación no responde

```bash
# Verificar healthcheck
curl http://localhost:3000/api/health

# Reiniciar contenedor
docker-compose restart

# Ver uso de recursos
docker stats
```

### Webhook no se ejecuta

```bash
# Ver logs del servicio webhook
sudo journalctl -u github-webhook -n 50

# Verificar que el servicio está corriendo
sudo systemctl status github-webhook

# Reiniciar servicio
sudo systemctl restart github-webhook

# Test manual del webhook
curl -X POST http://localhost:9000/hooks/riogasgestion-deploy
```

### Rollback manual

```bash
# Ver commits recientes
git log --oneline -5

# Volver a commit anterior
git reset --hard <commit-hash>

# Re-deploy
./deploy.sh
```

---

## 📊 Monitoreo

### Healthcheck

```bash
# Verificar salud del contenedor
curl http://localhost:3000/api/health

# Ver estado de healthcheck
docker inspect --format='{{.State.Health.Status}}' riogasgestion-app
```

### Recursos

```bash
# Ver uso de CPU/RAM en tiempo real
docker stats riogasgestion-app

# Ver límites configurados
docker inspect riogasgestion-app | grep -A 10 "Memory"
```

### Espacio en disco

```bash
# Ver tamaño de imágenes
docker images

# Ver tamaño de volúmenes
docker system df -v

# Ver logs más grandes
du -sh logs/*
```

---

## 📝 Notas Adicionales

### Nginx Reverse Proxy (ya configurado en tu caso)

Si tienes Nginx en otro servidor, asegúrate de que apunte al puerto 3000:

```nginx
upstream riogasgestion {
    server tu-servidor-app:3000;
}

server {
    listen 80;
    server_name tudominio.com;

    location / {
        proxy_pass http://riogasgestion;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Backups

```bash
# Backup del código
tar -czf backup_$(date +%Y%m%d).tar.gz /opt/riogasgestion

# Backup de variables de entorno (sin exponerlas)
cp .env.production .env.production.backup
```

### SSL/HTTPS

Si usas Nginx con SSL (Let's Encrypt), recuerda:

```bash
# Renovar certificados
sudo certbot renew

# Verificar auto-renovación
sudo systemctl status certbot.timer
```

---

## 🆘 Soporte

Para problemas o dudas:
- Ver logs: `cat logs/deploy_*.log`
- GitHub Issues: [tu-repo/issues]
- Contacto: [tu-email]

---

**✅ Listo! Tu aplicación está en producción.**

Para deploy: `./deploy.sh`  
Para autodeploy: Push a `dev` en GitHub
