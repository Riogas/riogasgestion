# 🚀 GUÍA PASO A PASO - INSTALACIÓN EN SERVIDOR GOYA

## 📋 Información del Servidor
- **Usuario**: riogas
- **Directorio**: /home/riogas/goya
- **Sistema**: Linux (Ubuntu/Debian)
- **Repositorio**: https://github.com/Riogas/riogasgestion
- **Rama**: dev

---

## 🔐 PASO 1: Conectarse al Servidor

```bash
ssh riogas@tu-servidor-ip
```

O si usas una clave SSH:
```bash
ssh -i ~/.ssh/tu-clave.pem riogas@tu-servidor-ip
```

---

## 🛠️ PASO 2: Instalación Inicial (Solo Primera Vez)

### Opción A: Instalación Automática (Recomendado)

**2.1** Descargar el script de setup:
```bash
cd ~
wget https://raw.githubusercontent.com/Riogas/riogasgestion/dev/setup-server.sh
# O si prefieres curl:
# curl -O https://raw.githubusercontent.com/Riogas/riogasgestion/dev/setup-server.sh
```

**2.2** Dar permisos y ejecutar:
```bash
chmod +x setup-server.sh
sudo ./setup-server.sh
```

**2.3** Cuando te pregunte el usuario, escribe: `riogas`

**2.4** **¡IMPORTANTE!** Cerrar sesión y volver a entrar:
```bash
exit
# Volver a conectar
ssh riogas@tu-servidor-ip
```

### Opción B: Instalación Manual

Si prefieres hacerlo manualmente:

**2.1** Actualizar sistema:
```bash
sudo apt update && sudo apt upgrade -y
```

**2.2** Instalar Docker:
```bash
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
```

**2.3** Instalar Docker Compose:
```bash
sudo apt install -y docker-compose
```

**2.4** Instalar Git:
```bash
sudo apt install -y git
```

**2.5** Agregar tu usuario al grupo docker:
```bash
sudo usermod -aG docker riogas
```

**2.6** Cerrar sesión y volver a entrar:
```bash
exit
# Volver a conectar
ssh riogas@tu-servidor-ip
```

**2.7** Verificar que Docker funciona sin sudo:
```bash
docker ps
# Debe funcionar sin errores
```

---

## 📁 PASO 3: Crear Estructura de Directorios

```bash
# Crear directorio principal
mkdir -p /home/riogas/goya
cd /home/riogas/goya
```

---

## 📥 PASO 4: Clonar el Repositorio

### ⚠️ Importante: Autenticación con GitHub

GitHub ya no permite usar contraseña. Debes usar **SSH** (recomendado) o **Personal Access Token**.

#### Opción A: Usar SSH (Recomendado)

**4.1a** Generar clave SSH:
```bash
ssh-keygen -t ed25519 -C "computos.riogas@gmail.com"
# Presionar Enter 3 veces
```

**4.1b** Copiar clave pública:
```bash
cat ~/.ssh/id_ed25519.pub
# Copiar TODO el contenido
```

**4.1c** Agregar a GitHub:
- Ve a https://github.com/settings/keys
- Click "New SSH key"
- Pega la clave copiada
- Guardar

**4.1d** Probar conexión:
```bash
ssh -T git@github.com
# Debe responder: "Hi Riogas! You've successfully authenticated..."
```

**4.1e** Clonar con SSH:
```bash
cd /home/riogas/goya
git clone git@github.com:Riogas/riogasgestion.git .
```

#### Opción B: Usar Personal Access Token

**4.1b-1** Crear token en GitHub:
- Ve a https://github.com/settings/tokens
- "Generate new token (classic)"
- Marca: `repo` y `workflow`
- Copiar el token generado (empieza con `ghp_...`)

**4.1b-2** Clonar con token:
```bash
cd /home/riogas/goya
git clone https://ghp_TU_TOKEN_AQUI@github.com/Riogas/riogasgestion.git .
```

**Nota:** El punto (`.`) al final es importante, clona el contenido directamente en la carpeta actual.

**4.2** Cambiar a la rama dev:
```bash
git checkout dev
```

**4.3** Verificar que todo esté clonado:
```bash
ls -la
# Deberías ver: Dockerfile, docker-compose.yml, package.json, etc.
```

---

## ⚙️ PASO 5: Configurar Variables de Entorno

**5.1** Copiar el template:
```bash
cp .env.production.example .env.production
```

**5.2** Editar el archivo:
```bash
nano .env.production
```

**5.3** Configurar los valores importantes:

```env
# API Backend (IMPORTANTE - Cambiar por tu IP/dominio real)
NEXT_PUBLIC_API_URL=http://192.168.1.72:8082

# URL pública de la aplicación
NEXT_PUBLIC_APP_URL=https://tudominio.com

# JWT Secret (Generar uno seguro)
JWT_SECRET=genera-un-secret-super-seguro-aqui
NEXTAUTH_SECRET=otro-secret-diferente-para-nextauth

# Coordenadas del mapa (Goya)
NEXT_PUBLIC_DEFAULT_LAT=-27.4606
NEXT_PUBLIC_DEFAULT_LNG=-58.8341
NEXT_PUBLIC_DEFAULT_ZOOM=13

# Zona horaria
TZ=America/Argentina/Buenos_Aires
```

**5.4** Guardar y salir:
- Presiona `Ctrl + O` (guardar)
- Presiona `Enter` (confirmar)
- Presiona `Ctrl + X` (salir)

---

## 🔑 PASO 6: Dar Permisos a los Scripts

```bash
chmod +x deploy.sh
chmod +x webhook-deploy.sh
chmod +x helper.sh
```

Verificar:
```bash
ls -l *.sh
# Deben tener la 'x' en los permisos
```

---

## 🚀 PASO 7: Primer Deploy

**7.1** Ejecutar el script de deploy:
```bash
./deploy.sh
```

Este proceso tomará varios minutos la primera vez (descarga imagen de Node, instala dependencias, compila).

**7.2** Ver el progreso:
El script mostrará cada paso con colores:
- Verde ✓ = Éxito
- Azul = Información
- Amarillo = Advertencias
- Rojo = Errores

**7.3** Esperar a que complete todos los pasos:
1. Backup de imagen actual
2. Detener contenedores
3. Limpiar imágenes antiguas
4. Construir nueva imagen
5. Verificar variables de entorno
6. Iniciar contenedores
7. Healthcheck

---

## ✅ PASO 8: Verificar que Funcione

**8.1** Ver contenedores corriendo:
```bash
docker ps
```

Deberías ver algo como:
```
CONTAINER ID   IMAGE                  STATUS                   PORTS
abc123def456   riogasgestion:latest   Up 30 seconds (healthy)  0.0.0.0:3000->3000/tcp
```

**8.2** Verificar healthcheck:
```bash
curl http://localhost:3000/api/health
```

Debe responder:
```json
{"status":"ok","timestamp":"...","uptime":123}
```

**8.3** Ver logs en tiempo real:
```bash
docker logs -f riogasgestion-app
```

Presiona `Ctrl + C` para salir.

**8.4** Probar desde tu navegador:
```
http://tu-servidor-ip:3000
```

---

## 📊 PASO 9: Comandos Útiles

Ahora puedes usar el helper para comandos comunes:

```bash
# Ver ayuda
./helper.sh

# Ver logs en tiempo real
./helper.sh logs

# Ver estado
./helper.sh status

# Reiniciar
./helper.sh restart

# Detener
./helper.sh stop

# Iniciar
./helper.sh start
```

---

## 🔄 PASO 10: Configurar Autodeploy (Opcional pero Recomendado)

### 10.1 Instalar Webhook Listener

```bash
sudo apt install -y webhook
```

### 10.2 Crear Configuración del Webhook

**Crear archivo webhook.json:**
```bash
nano /home/riogas/goya/webhook.json
```

**Copiar este contenido:**
```json
[
  {
    "id": "riogasgestion-deploy",
    "execute-command": "/home/riogas/goya/webhook-deploy.sh",
    "command-working-directory": "/home/riogas/goya",
    "response-message": "Deploy iniciado correctamente",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hash-sha256",
            "secret": "TU_SECRET_SUPER_SEGURO_AQUI_12345",
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

**⚠️ IMPORTANTE:** Cambia `TU_SECRET_SUPER_SEGURO_AQUI_12345` por un secret real. Puedes generar uno:
```bash
openssl rand -base64 32
```

Guarda este secret, lo necesitarás en GitHub.

### 10.3 Crear Servicio Systemd

```bash
sudo nano /etc/systemd/system/github-webhook.service
```

**Copiar este contenido:**
```ini
[Unit]
Description=GitHub Webhook Listener - RioGas Goya
After=network.target

[Service]
Type=simple
User=riogas
WorkingDirectory=/home/riogas/goya
ExecStart=/usr/bin/webhook -hooks /home/riogas/goya/webhook.json -verbose -port 9000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Guardar y salir (`Ctrl+O`, `Enter`, `Ctrl+X`).

### 10.4 Iniciar el Servicio

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Iniciar webhook
sudo systemctl start github-webhook

# Habilitar inicio automático
sudo systemctl enable github-webhook

# Ver estado
sudo systemctl status github-webhook
```

Debe mostrar "active (running)" en verde.

### 10.5 Abrir Puerto en Firewall (si tienes firewall)

```bash
# Si usas ufw
sudo ufw allow 9000/tcp

# O si usas firewalld
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --reload
```

### 10.6 Configurar en GitHub

**1.** Ve a tu repositorio: https://github.com/Riogas/riogasgestion

**2.** Click en **Settings** → **Webhooks** → **Add webhook**

**3.** Configurar:
   - **Payload URL**: `http://TU-SERVIDOR-IP:9000/hooks/riogasgestion-deploy`
   - **Content type**: `application/json`
   - **Secret**: El secret que generaste en el paso 10.2
   - **Which events**: Selecciona "Just the push event"
   - **Active**: ✅ Marcado

**4.** Click en **Add webhook**

**5.** GitHub intentará enviar un ping. Si ves un ✓ verde, ¡funciona!

### 10.7 Probar el Autodeploy

```bash
# Ver logs del webhook en tiempo real
sudo journalctl -u github-webhook -f
```

Ahora haz un cambio en GitHub (o haz push) y verás cómo se ejecuta automáticamente el deploy.

---

## 🔧 PASO 11: Configurar Nginx (Tu servidor Nginx)

En tu servidor de Nginx, configura el proxy reverso:

```nginx
# /etc/nginx/sites-available/goya
upstream goya_backend {
    server TU-SERVIDOR-GOYA-IP:3000;
}

server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    location / {
        proxy_pass http://goya_backend;
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

Activar y recargar:
```bash
sudo ln -s /etc/nginx/sites-available/goya /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📝 Resumen de Comandos Rápidos

```bash
# Deploy manual
cd /home/riogas/goya && ./deploy.sh

# Ver logs
./helper.sh logs

# Estado
./helper.sh status

# Actualizar desde Git y deploy
./helper.sh update

# Entrar al contenedor
./helper.sh shell

# Ver webhook en acción
sudo journalctl -u github-webhook -f
```

---

## 🆘 Troubleshooting

### Error: "Password authentication is not supported"

**Causa:** GitHub ya no permite contraseñas. Debes usar SSH o Token.

**Solución rápida con Token:**
```bash
# 1. Crear token en: https://github.com/settings/tokens
# 2. Copiar el token (empieza con ghp_)
# 3. Clonar así:
git clone https://ghp_TU_TOKEN@github.com/Riogas/riogasgestion.git .
```

**Solución permanente con SSH:**
```bash
# 1. Generar clave
ssh-keygen -t ed25519 -C "computos.riogas@gmail.com"

# 2. Copiar clave pública
cat ~/.ssh/id_ed25519.pub

# 3. Agregar en GitHub: https://github.com/settings/keys

# 4. Clonar
git clone git@github.com:Riogas/riogasgestion.git .
```

### El contenedor no inicia
```bash
docker logs riogasgestion-app
docker-compose logs
```

### Puerto 3000 en uso
```bash
sudo lsof -i :3000
# Matar proceso si es necesario
sudo kill -9 <PID>
```

### Webhook no funciona
```bash
# Ver logs
sudo journalctl -u github-webhook -n 50

# Reiniciar servicio
sudo systemctl restart github-webhook

# Test manual
curl -X POST http://localhost:9000/hooks/riogasgestion-deploy
```

### Rollback a versión anterior
```bash
cd /home/riogas/goya
git log --oneline -5  # Ver commits
git reset --hard <commit-hash>
./deploy.sh
```

---

## ✅ Checklist Final

- [ ] Docker instalado y funcionando
- [ ] Usuario riogas en grupo docker
- [ ] Repositorio clonado en /home/riogas/goya
- [ ] Archivo .env.production configurado
- [ ] Permisos de ejecución en scripts
- [ ] Primer deploy exitoso
- [ ] Aplicación responde en puerto 3000
- [ ] Webhook listener instalado (opcional)
- [ ] Webhook configurado en GitHub (opcional)
- [ ] Nginx apuntando al puerto 3000 (si aplica)

---

**🎉 ¡Listo! Tu aplicación está en producción.**

Para deploy futuro: `./deploy.sh`  
Para autodeploy: Push a GitHub rama `dev`
