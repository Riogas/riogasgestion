# 📧 Configuración de Email - Riogas

Guía para configurar el envío de emails con el servidor SMTP de Riogas.

---

## 🔐 Credenciales SMTP de Riogas

```
Servidor:      mail.riogas.com.uy
Puerto:        25
Usuario:       notificacionesautomaticas@riogas.com.uy
Contraseña:    1710
Autenticación: Sí (LOGIN)
```

---

## 🚀 Configuración Rápida

### Opción 1: Instalador Automático (Recomendado)

```bash
cd /var/www/goya
chmod +x scripts/*.sh

# Ejecutar instalador
./scripts/install-monitoring.sh

# Cuando pregunte por email, usar configuración por defecto (y)
```

El instalador:
- ✅ Detecta automáticamente la configuración de Riogas
- ✅ Configura Python para envío SMTP
- ✅ Crea cron job para verificación semanal
- ✅ Prueba el envío de email

### Opción 2: Manual

```bash
cd /var/www/goya

# Editar script con tus datos
nano scripts/check-vulnerabilities.sh

# Buscar y actualizar estas líneas:
EMAIL_TO="tu-email@riogas.com.ar"  # Email donde recibirás reportes
EMAIL_FROM="notificacionesautomaticas@riogas.com.uy"
SMTP_SERVER="mail.riogas.com.uy"
SMTP_PORT="25"
SMTP_USER="notificacionesautomaticas@riogas.com.uy"
SMTP_PASS="1710"
```

---

## 🧪 Probar Configuración

### Test Rápido

```bash
cd /var/www/goya
chmod +x scripts/test-email.sh

# Ejecutar test
./scripts/test-email.sh

# Ingresa tu email cuando lo pida
```

El script probará:
1. ✅ Conexión al servidor SMTP
2. ✅ Autenticación con credenciales
3. ✅ Envío de email de prueba
4. ✅ Métodos alternativos si Python no está disponible

### Verificar Recepción

Después de ejecutar el test:
1. Revisa tu bandeja de entrada
2. Revisa carpeta de **spam/correo no deseado**
3. Si no llega, revisa logs del test

---

## 🛠️ Métodos de Envío

El script intentará usar estos métodos en orden:

### 1. Python SMTP (Recomendado) ✅

**Ventajas**:
- ✅ Incluido en la mayoría de distribuciones Linux
- ✅ Soporte completo SMTP con autenticación
- ✅ Manejo de attachments y HTML
- ✅ Control total de errores

**Instalar Python** (si no está):
```bash
sudo apt-get update
sudo apt-get install python3
```

**Verificar**:
```bash
python3 --version
# Debe mostrar: Python 3.x.x
```

### 2. swaks (Opcional)

Swiss Army Knife for SMTP - herramienta especializada.

**Instalar**:
```bash
sudo apt-get install swaks
```

**Ventajas**:
- ✅ Específicamente diseñado para SMTP
- ✅ Excelente para testing
- ✅ Soporte completo de autenticación

### 3. sendmail (Fallback)

**Configurar sendmail** para usar relay:
```bash
sudo apt-get install sendmail

# Configurar relay SMTP
sudo nano /etc/mail/sendmail.mc

# Agregar:
define(`SMART_HOST', `mail.riogas.com.uy')dnl
define(`RELAY_MAILER_ARGS', `TCP $h 25')dnl

# Recompilar y reiniciar
sudo sendmailconfig
sudo systemctl restart sendmail
```

### 4. mail (Fallback simple)

```bash
sudo apt-get install mailutils
```

---

## 📊 Ejemplo de Email que Recibirás

### Asunto (Normal):
```
[Riogas] Reporte de Vulnerabilidades - 03/02/2026
```

### Asunto (Urgente):
```
⚠️ [URGENTE] [Riogas] Reporte de Vulnerabilidades - 03/02/2026
```

### Contenido HTML:

```html
🔒 Reporte de Vulnerabilidades - Riogas

Fecha: 03/02/2026 09:00:00

📊 Resumen General
┌─────────────┬──────────┐
│ Nivel       │ Cantidad │
├─────────────┼──────────┤
│ Críticas    │ 0        │
│ High        │ 0        │
│ Moderate    │ 0        │
│ Low         │ 0        │
└─────────────┴──────────┘

📦 Proyecto: goya
✅ Sin vulnerabilidades
- Next.js: 16.1.6
- React: 18.3.1

📦 Proyecto: track
✅ Sin vulnerabilidades
- Next.js: 16.1.6
- React: 19.2.4
```

**Adjunto**: Archivo TXT con reporte detallado

---

## 🔧 Troubleshooting

### Error: "Connection refused"

**Causa**: No se puede conectar al servidor SMTP

**Solución**:
```bash
# Verificar conectividad
ping mail.riogas.com.uy

# Verificar puerto abierto
nc -zv mail.riogas.com.uy 25

# O con telnet
telnet mail.riogas.com.uy 25
```

Si la conexión falla:
- Firewall bloqueando puerto 25
- Servidor SMTP no accesible desde esa red
- VPN requerida

### Error: "Authentication failed"

**Causa**: Credenciales incorrectas

**Verificar**:
```bash
# Ver configuración actual
grep -A 5 "SMTP" scripts/check-vulnerabilities.sh

# Debe mostrar:
# SMTP_SERVER="mail.riogas.com.uy"
# SMTP_PORT="25"
# SMTP_USER="notificacionesautomaticas@riogas.com.uy"
# SMTP_PASS="1710"
```

### Error: "Python not found"

**Solución**:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install python3

# CentOS/RHEL
sudo yum install python3
```

### Email no llega

**Checklist**:
1. ✅ Script ejecutado sin errores
2. ✅ Verificar carpeta de spam
3. ✅ Email correcto en configuración
4. ✅ Servidor SMTP accesible
5. ✅ Logs del sistema: `/var/log/mail.log`

**Ver logs**:
```bash
# Logs del script
tail -f /var/log/vulnerability-check.log

# Logs del sistema de mail
tail -f /var/log/mail.log

# O
tail -f /var/log/syslog | grep mail
```

---

## 🔐 Seguridad

### Proteger Credenciales

Las credenciales están en texto plano en el script. Para mayor seguridad:

#### Opción 1: Permisos restrictivos (Básico)
```bash
chmod 700 scripts/check-vulnerabilities.sh
chown riogas:riogas scripts/check-vulnerabilities.sh
```

#### Opción 2: Variables de entorno (Mejor)

**Crear archivo de configuración**:
```bash
sudo nano /etc/riogas-smtp.conf

# Contenido:
SMTP_SERVER="mail.riogas.com.uy"
SMTP_PORT="25"
SMTP_USER="notificacionesautomaticas@riogas.com.uy"
SMTP_PASS="1710"
```

**Proteger archivo**:
```bash
sudo chmod 600 /etc/riogas-smtp.conf
sudo chown riogas:riogas /etc/riogas-smtp.conf
```

**Modificar script para usar archivo**:
```bash
# Al inicio del script check-vulnerabilities.sh
if [ -f /etc/riogas-smtp.conf ]; then
    source /etc/riogas-smtp.conf
fi
```

#### Opción 3: Keyring (Avanzado)

Usar `secret-tool` para almacenar contraseña encriptada:
```bash
sudo apt-get install libsecret-tools

# Guardar password
secret-tool store --label='SMTP Riogas' service smtp username notificacionesautomaticas@riogas.com.uy

# En el script, recuperar:
SMTP_PASS=$(secret-tool lookup service smtp username notificacionesautomaticas@riogas.com.uy)
```

---

## 📅 Cron Job Configurado

El instalador crea un cron job que ejecuta cada **lunes a las 9:00 AM**:

```bash
# Ver cron jobs
crontab -l

# Debe mostrar algo como:
0 9 * * 1 /var/www/goya/scripts/check-vulnerabilities.sh >> /var/log/vulnerability-check.log 2>&1
```

### Modificar Horario

```bash
# Editar cron
crontab -e

# Ejemplos de horarios:
0 9 * * 1     # Lunes 9am
0 18 * * 5    # Viernes 6pm
0 22 * * 0    # Domingo 10pm
0 9 * * *     # Diario 9am
0 */6 * * *   # Cada 6 horas
```

### Ver Logs de Ejecución

```bash
# Logs del cron
tail -f /var/log/vulnerability-check.log

# Logs del sistema
tail -f /var/log/syslog | grep CRON
```

---

## ✅ Checklist de Configuración

- [ ] Python3 instalado (`python3 --version`)
- [ ] Scripts con permisos de ejecución (`chmod +x scripts/*.sh`)
- [ ] Test de email exitoso (`./scripts/test-email.sh`)
- [ ] Configuración SMTP en `check-vulnerabilities.sh`
- [ ] Cron job configurado (`crontab -l`)
- [ ] Email de prueba recibido
- [ ] Logs funcionando (`/var/log/vulnerability-check.log`)

---

## 🆘 Comandos Útiles

```bash
# Ejecutar verificación manualmente
cd /var/www/goya
bash scripts/check-vulnerabilities.sh

# Probar email
bash scripts/test-email.sh

# Ver logs
tail -f /var/log/vulnerability-check.log

# Ver cron jobs
crontab -l

# Editar cron jobs
crontab -e

# Ver reportes generados
ls -lh /tmp/vulnerability-report-*.txt
ls -lh /tmp/vulnerability-report-*.html

# Ver último reporte
cat /tmp/vulnerability-report-$(date +%Y%m%d).txt
```

---

## 📧 Contacto de Soporte

Si tienes problemas con el servidor SMTP de Riogas:
- Verificar con IT que el usuario tiene permisos
- Confirmar que puerto 25 no está bloqueado
- Verificar que el servidor acepta conexiones desde tu IP

---

**Última actualización**: 3 de Febrero, 2026  
**Configuración**: mail.riogas.com.uy:25
