# 🚀 Quick Start - Deployment

## Instalación en el Servidor (Primera vez)

```bash
# 1. Ejecutar setup (como root/sudo)
sudo bash setup-server.sh

# 2. Clonar repositorio
cd /opt/riogasgestion
git clone https://github.com/Riogas/riogasgestion.git .
git checkout dev

# 3. Configurar variables de entorno
cp .env.production.example .env.production
nano .env.production  # Editar con tus valores

# 4. Dar permisos
chmod +x deploy.sh webhook-deploy.sh helper.sh

# 5. Deploy!
./deploy.sh
```

## Deploy Manual

```bash
./deploy.sh
```

## Comandos Rápidos

```bash
./helper.sh start      # Iniciar
./helper.sh stop       # Detener
./helper.sh restart    # Reiniciar
./helper.sh logs       # Ver logs
./helper.sh status     # Estado
./helper.sh deploy     # Deploy completo
./helper.sh update     # Git pull + deploy
```

## Autodeploy con GitHub

### 1. Instalar webhook listener

```bash
sudo apt install -y webhook
```

### 2. Configurar webhook

```bash
# Copiar template
cp webhook.json.example webhook.json

# Editar y cambiar el SECRET
nano webhook.json
```

### 3. Crear servicio systemd

```bash
sudo nano /etc/systemd/system/github-webhook.service
```

Contenido:
```ini
[Unit]
Description=GitHub Webhook
After=network.target

[Service]
Type=simple
User=tu-usuario
WorkingDirectory=/opt/riogasgestion
ExecStart=/usr/bin/webhook -hooks /opt/riogasgestion/webhook.json -verbose -port 9000
Restart=always

[Install]
WantedBy=multi-user.target
```

### 4. Activar servicio

```bash
sudo systemctl daemon-reload
sudo systemctl start github-webhook
sudo systemctl enable github-webhook
sudo systemctl status github-webhook
```

### 5. Configurar en GitHub

- **Settings** → **Webhooks** → **Add webhook**
- **URL**: `http://tu-servidor:9000/hooks/riogasgestion-deploy`
- **Content type**: `application/json`
- **Secret**: El mismo que pusiste en `webhook.json`
- **Events**: Just the push event
- ✅ Active

## Verificar

```bash
# Healthcheck
curl http://localhost:3000/api/health

# Ver aplicación corriendo
curl http://localhost:3000

# Logs
docker logs -f riogasgestion-app
```

## Troubleshooting

```bash
# Ver todo el log del último deploy
ls -t logs/deploy_*.log | head -1 | xargs cat

# Ver estado del contenedor
docker ps
docker inspect riogasgestion-app

# Entrar al contenedor
docker exec -it riogasgestion-app sh
```

---

📖 **Documentación completa**: Ver `README-DEPLOY.md`
