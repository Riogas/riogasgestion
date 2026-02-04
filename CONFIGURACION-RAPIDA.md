# 📋 Guía de Configuración Rápida

Esta guía te muestra cómo configurar el destinatario del email y el horario del cron job.

---

## 📧 Configurar Email Destinatario

### Opción 1: Durante la Instalación (Recomendado)

Cuando ejecutes el instalador, te preguntará:

```bash
cd /var/www/goya
./scripts/install-monitoring.sh
```

**Te preguntará:**
```
💡 Tip: Puedes ingresar múltiples emails separados por punto y coma (;)
   Ejemplo: email1@ejemplo.com;email2@ejemplo.com;email3@ejemplo.com

Email(s) para recibir reportes [jgomez@riogas.com.ar]: 
```

- Presiona **Enter** para usar el predeterminado: `jgomez@riogas.com.ar`
- O escribe uno o más emails separados por **;** y presiona Enter

**Ejemplos:**
- Un solo email: `julio.gomez@riogas.com.uy`
- Múltiples emails: `julio.gomez@riogas.com.uy;maria.lopez@riogas.com.uy;admin@riogas.com.uy`

---

### Opción 2: Editar Manualmente

**En el servidor:**

```bash
cd /var/www/goya
nano scripts/check-vulnerabilities.sh
```

**Busca esta línea** (cerca del inicio, línea 13):

```bash
EMAIL_TO="jgomez@riogas.com.ar"
```

**Cámbiala por:**

```bash
EMAIL_TO="tu-email@ejemplo.com"
```

**Guardar y salir:**
- Presiona `Ctrl + O` (guardar)
- Presiona `Enter` (confirmar)
- Presiona `Ctrl + X` (salir)

---

### Opción 3: Comando Rápido (Una Línea)

```bash
cd /var/www/goya

# Cambiar email (uno o múltiples separados por ;)
sed -i 's/EMAIL_TO=".*"/EMAIL_TO="nuevo-email@ejemplo.com"/' scripts/check-vulnerabilities.sh

# O múltiples emails:
sed -i 's/EMAIL_TO=".*"/EMAIL_TO="email1@ejemplo.com;email2@ejemplo.com;email3@ejemplo.com"/' scripts/check-vulnerabilities.sh

# Verificar cambio
grep EMAIL_TO scripts/check-vulnerabilities.sh
```

💡 **Tip**: También puedes usar comas (,) como separador: `email1@ejemplo.com,email2@ejemplo.com`

---

## 🕐 Configurar Horario del Cron Job

### Opción 1: Durante la Instalación (Recomendado)

Cuando ejecutes el instalador:

```bash
./scripts/install-monitoring.sh
```

**Te mostrará opciones:**
```
Configuración de Cron Job
-------------------------
Opciones disponibles:
  1) Lunes a las 09:00
  2) Viernes a las 18:00
  3) Domingo a las 22:00
  4) Personalizado
Selecciona una opción [1]: 
```

Elige el número que prefieras y presiona Enter.

---

### Opción 2: Editar Cron Manualmente

**Editar cron jobs:**

```bash
crontab -e
```

**Busca la línea:**
```bash
0 9 * * 1 /var/www/goya/scripts/check-vulnerabilities.sh >> /var/log/vulnerability-check.log 2>&1
```

**Formato del cron:**
```
┌───────────── minuto (0 - 59)
│ ┌───────────── hora (0 - 23)
│ │ ┌───────────── día del mes (1 - 31)
│ │ │ ┌───────────── mes (1 - 12)
│ │ │ │ ┌───────────── día de la semana (0 - 7) (Domingo=0 o 7)
│ │ │ │ │
│ │ │ │ │
* * * * * comando a ejecutar
```

---

### Horarios Comunes

**Lunes 9:00 AM** (predeterminado):
```bash
0 9 * * 1 /var/www/goya/scripts/check-vulnerabilities.sh >> /var/log/vulnerability-check.log 2>&1
```

**Viernes 6:00 PM**:
```bash
0 18 * * 5 /var/www/goya/scripts/check-vulnerabilities.sh >> /var/log/vulnerability-check.log 2>&1
```

**Domingo 10:00 PM**:
```bash
0 22 * * 0 /var/www/goya/scripts/check-vulnerabilities.sh >> /var/log/vulnerability-check.log 2>&1
```

**Diario a las 9:00 AM**:
```bash
0 9 * * * /var/www/goya/scripts/check-vulnerabilities.sh >> /var/log/vulnerability-check.log 2>&1
```

**Cada 6 horas**:
```bash
0 */6 * * * /var/www/goya/scripts/check-vulnerabilities.sh >> /var/log/vulnerability-check.log 2>&1
```

**Primer día de cada mes a las 8:00 AM**:
```bash
0 8 1 * * /var/www/goya/scripts/check-vulnerabilities.sh >> /var/log/vulnerability-check.log 2>&1
```

---

### Herramienta Online para Cron

Si no estás seguro de la sintaxis, usa:
👉 https://crontab.guru/

---

## 🔄 Aplicar Cambios

### Después de Editar el Email Manualmente

No necesitas reiniciar nada. El cambio se aplica inmediatamente.

**Probar:**
```bash
cd /var/www/goya
./scripts/check-vulnerabilities.sh
```

Deberías recibir el email en la nueva dirección.

---

### Después de Editar el Cron

El cron daemon recarga automáticamente después de `crontab -e`.

**Verificar que está guardado:**
```bash
crontab -l
```

**Ver logs del cron:**
```bash
# Ubuntu/Debian
grep CRON /var/log/syslog

# O específicos del script
tail -f /var/log/vulnerability-check.log
```

---

## 🧪 Probar Configuración

### Probar Email

```bash
cd /var/www/goya

# Test de email
./scripts/test-email.sh

# Te pedirá el email de prueba
# Ingresa el email que configuraste
```

### Ejecutar Verificación Manualmente

```bash
cd /var/www/goya

# Ejecutar ahora (sin esperar el cron)
./scripts/check-vulnerabilities.sh
```

Recibirás el email inmediatamente si todo está bien configurado.

---

## 📊 Resumen de Configuración Actual

**Ver configuración de email:**
```bash
cd /var/www/goya
grep -E "EMAIL_TO|EMAIL_FROM|SMTP" scripts/check-vulnerabilities.sh | head -6
```

**Salida esperada:**
```bash
EMAIL_TO="jgomez@riogas.com.ar"           ← Destinatario (TÚ CAMBIAS ESTO)
EMAIL_FROM="notificacionesautomaticas@riogas.com.uy"
SMTP_SERVER="mail.riogas.com.uy"
SMTP_PORT="25"
SMTP_USER="notificacionesautomaticas@riogas.com.uy"
SMTP_PASS="1710"
```

**Ver cron jobs:**
```bash
crontab -l
```

**Salida esperada:**
```bash
0 9 * * 1 /var/www/goya/scripts/check-vulnerabilities.sh >> /var/log/vulnerability-check.log 2>&1
```

---

## 🚀 Configuración Rápida Completa

### Script Todo-en-Uno

```bash
cd /var/www/goya

# 1. Cambiar email destinatario
read -p "Email destinatario: " MI_EMAIL
sed -i "s/EMAIL_TO=\".*\"/EMAIL_TO=\"$MI_EMAIL\"/" scripts/check-vulnerabilities.sh

# 2. Verificar cambio
echo "Email configurado:"
grep EMAIL_TO scripts/check-vulnerabilities.sh

# 3. Probar email
./scripts/test-email.sh

# 4. Configurar cron (si no está configurado)
echo "Configurar cron manualmente con: crontab -e"
echo "O ejecutar: ./scripts/install-monitoring.sh"
```

---

## 📍 Ubicaciones de Archivos

```
/var/www/goya/
├── scripts/
│   ├── check-vulnerabilities.sh    ← CONFIGURAR EMAIL AQUÍ (línea 13)
│   ├── test-email.sh               ← Para probar
│   └── install-monitoring.sh       ← Instalador interactivo
└── .env.production                 ← (no tiene config de email)

/var/log/
└── vulnerability-check.log         ← Logs del script

/var/spool/cron/crontabs/
└── riogas                          ← Cron jobs (editar con: crontab -e)
```

---

## ❓ Preguntas Frecuentes

### ¿Puedo enviar a múltiples emails?

✅ **Sí! Soportado nativamente desde la versión v2**

**Opción 1: Separar por punto y coma (Recomendado)**
```bash
EMAIL_TO="email1@ejemplo.com;email2@ejemplo.com;email3@ejemplo.com"
```

**Opción 2: Separar por comas**
```bash
EMAIL_TO="email1@ejemplo.com,email2@ejemplo.com,email3@ejemplo.com"
```

**Configurar con sed:**
```bash
EMAILS="julio.gomez@riogas.com.uy;maria.lopez@riogas.com.uy;admin@riogas.com.uy"
sed -i "s|EMAIL_TO=\".*\"|EMAIL_TO=\"$EMAILS\"|" scripts/check-vulnerabilities-v2.sh
```

📚 **Ver guía completa**: [MULTIPLES-EMAILS.md](MULTIPLES-EMAILS.md)

---

### ¿Cómo cambio el email de origen (FROM)?

**Editar:**
```bash
nano scripts/check-vulnerabilities.sh
```

**Cambiar línea 14:**
```bash
EMAIL_FROM="notificacionesautomaticas@riogas.com.uy"
```

**Por:**
```bash
EMAIL_FROM="tu-email@ejemplo.com"
```

⚠️ **Nota**: El servidor SMTP debe permitir enviar desde ese email.

---

### ¿Cómo desactivo los emails temporalmente?

**Opción 1: Comentar el cron job**
```bash
crontab -e

# Agregar # al inicio de la línea:
# 0 9 * * 1 /var/www/goya/scripts/check-vulnerabilities.sh >> /var/log/vulnerability-check.log 2>&1
```

**Opción 2: Eliminar el cron job**
```bash
crontab -e
# Eliminar la línea completa y guardar
```

**Opción 3: Vaciar contraseña SMTP**
```bash
nano scripts/check-vulnerabilities.sh

# Cambiar:
SMTP_PASS="1710"
# Por:
SMTP_PASS=""
```

---

### ¿Cómo ejecuto el script sin enviar email?

```bash
cd /var/www/goya

# Temporal: vaciar password
SMTP_PASS="" ./scripts/check-vulnerabilities.sh

# O ver solo el reporte generado
cat /tmp/vulnerability-report-$(date +%Y%m%d).txt
```

---

## 🛠️ Comandos Útiles

```bash
# Ver configuración actual de email
grep EMAIL_TO /var/www/goya/scripts/check-vulnerabilities.sh

# Cambiar email rápidamente
sed -i 's/EMAIL_TO=".*"/EMAIL_TO="nuevo@ejemplo.com"/' /var/www/goya/scripts/check-vulnerabilities.sh

# Ver cron jobs
crontab -l

# Editar cron jobs
crontab -e

# Probar email
/var/www/goya/scripts/test-email.sh

# Ejecutar verificación ahora
/var/www/goya/scripts/check-vulnerabilities.sh

# Ver último reporte
cat /tmp/vulnerability-report-$(date +%Y%m%d).txt

# Ver logs
tail -f /var/log/vulnerability-check.log
```

---

## 📞 Siguiente Paso

1. **Cambiar email destinatario** (si es diferente de `jgomez@riogas.com.ar`)
2. **Ejecutar instalador** para configurar el cron: `./scripts/install-monitoring.sh`
3. **Probar**: `./scripts/test-email.sh`

---

**Última actualización**: 3 de Febrero, 2026
