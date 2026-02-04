# 📧 Configuración de Múltiples Destinatarios de Email

## 🎯 Funcionalidad

Los scripts de monitoreo ahora soportan **múltiples destinatarios** para los reportes de vulnerabilidades.

---

## ✨ Características

- ✅ Múltiples emails separados por **punto y coma (;)** o **coma (,)**
- ✅ Soportado en ambos scripts: `check-vulnerabilities.sh` y `check-vulnerabilities-v2.sh`
- ✅ Configuración durante la instalación con `install-monitoring.sh`
- ✅ Edición manual fácil

---

## 🚀 Configuración

### Opción 1: Durante la Instalación (Recomendado)

```bash
cd /var/www/goya
./scripts/install-monitoring.sh
```

**Cuando pregunte por el email:**
```
Email(s) para recibir reportes [jgomez@riogas.com.ar]:
```

**Ingresa múltiples emails:**
```
julio.gomez@riogas.com.uy;maria.lopez@riogas.com.uy;admin@riogas.com.uy
```

✅ El instalador automáticamente configurará todos los destinatarios.

---

### Opción 2: Editar Manualmente el Script

#### Para check-vulnerabilities-v2.sh (Nuevo - Recomendado)

```bash
cd /var/www/goya
nano scripts/check-vulnerabilities-v2.sh
```

**Buscar la línea 13:**
```bash
EMAIL_TO="julio.gomez@riogas.com.uy"
```

**Reemplazar por:**
```bash
EMAIL_TO="julio.gomez@riogas.com.uy;maria.lopez@riogas.com.uy;admin@riogas.com.uy"
```

**Guardar:** `Ctrl+O`, `Enter`, `Ctrl+X`

#### Para check-vulnerabilities.sh (Viejo)

```bash
nano scripts/check-vulnerabilities.sh
```

**Buscar la línea 13:**
```bash
EMAIL_TO="jgomez@riogas.com.ar"
```

**Reemplazar por:**
```bash
EMAIL_TO="email1@ejemplo.com;email2@ejemplo.com;email3@ejemplo.com"
```

---

### Opción 3: Comando Rápido (Sed)

#### Para check-vulnerabilities-v2.sh

```bash
cd /var/www/goya

# Configurar múltiples emails
sed -i 's|EMAIL_TO=".*"|EMAIL_TO="julio.gomez@riogas.com.uy;maria.lopez@riogas.com.uy;admin@riogas.com.uy"|' scripts/check-vulnerabilities-v2.sh

# Verificar cambio
grep EMAIL_TO scripts/check-vulnerabilities-v2.sh
```

#### Para ambos scripts

```bash
# Variable con los emails
EMAILS="julio.gomez@riogas.com.uy;maria.lopez@riogas.com.uy;admin@riogas.com.uy"

# Actualizar ambos scripts
sed -i "s|EMAIL_TO=\".*\"|EMAIL_TO=\"$EMAILS\"|" scripts/check-vulnerabilities.sh
sed -i "s|EMAIL_TO=\".*\"|EMAIL_TO=\"$EMAILS\"|" scripts/check-vulnerabilities-v2.sh

# Verificar
grep EMAIL_TO scripts/check-vulnerabilities*.sh
```

---

## 📋 Formatos Soportados

### ✅ Punto y coma (Recomendado)
```bash
EMAIL_TO="email1@ejemplo.com;email2@ejemplo.com;email3@ejemplo.com"
```

### ✅ Coma
```bash
EMAIL_TO="email1@ejemplo.com,email2@ejemplo.com,email3@ejemplo.com"
```

### ✅ Mezcla (se normaliza automáticamente)
```bash
EMAIL_TO="email1@ejemplo.com;email2@ejemplo.com,email3@ejemplo.com"
```

---

## 🧪 Probar Configuración

### Verificar emails configurados

```bash
cd /var/www/goya
grep EMAIL_TO scripts/check-vulnerabilities-v2.sh
```

**Salida esperada:**
```
EMAIL_TO="julio.gomez@riogas.com.uy;maria.lopez@riogas.com.uy;admin@riogas.com.uy"
```

### Ejecutar prueba de email

```bash
# Ejecutar el script manualmente
bash scripts/check-vulnerabilities-v2.sh
```

**Todos los destinatarios configurados recibirán el email.**

---

## 🔍 Cómo Funciona Internamente

El script Python convierte automáticamente los separadores:

```python
# Código interno del script
recipients = "$EMAIL_TO".replace(';', ',')
msg['To'] = recipients
```

**Ejemplo:**
- **Entrada**: `"julio.gomez@riogas.com.uy;maria.lopez@riogas.com.uy"`
- **Procesado**: `"julio.gomez@riogas.com.uy,maria.lopez@riogas.com.uy"`
- **Resultado**: Ambos reciben el email

---

## 📊 Ejemplos de Uso

### Caso 1: Equipo de Desarrollo
```bash
EMAIL_TO="dev1@riogas.com.uy;dev2@riogas.com.uy;dev3@riogas.com.uy"
```

### Caso 2: Equipo + Manager
```bash
EMAIL_TO="julio.gomez@riogas.com.uy;maria.lopez@riogas.com.uy;manager@riogas.com.uy"
```

### Caso 3: Múltiples Departamentos
```bash
EMAIL_TO="it@riogas.com.uy;security@riogas.com.uy;devops@riogas.com.uy;admin@riogas.com.uy"
```

### Caso 4: Un solo destinatario (también funciona)
```bash
EMAIL_TO="julio.gomez@riogas.com.uy"
```

---

## 🛠️ Comandos Útiles

### Ver destinatarios actuales
```bash
grep EMAIL_TO /var/www/goya/scripts/check-vulnerabilities-v2.sh | head -1
```

### Agregar un nuevo destinatario
```bash
cd /var/www/goya

# Obtener emails actuales
CURRENT=$(grep 'EMAIL_TO=' scripts/check-vulnerabilities-v2.sh | head -1 | cut -d'"' -f2)

# Agregar nuevo email
NEW_EMAIL="nuevo@ejemplo.com"
UPDATED="$CURRENT;$NEW_EMAIL"

# Actualizar
sed -i "s|EMAIL_TO=\".*\"|EMAIL_TO=\"$UPDATED\"|" scripts/check-vulnerabilities-v2.sh

# Verificar
grep EMAIL_TO scripts/check-vulnerabilities-v2.sh
```

### Remover un destinatario
```bash
cd /var/www/goya

# Ejemplo: remover maria.lopez@riogas.com.uy
sed -i 's/maria.lopez@riogas.com.uy;//g' scripts/check-vulnerabilities-v2.sh
sed -i 's/;maria.lopez@riogas.com.uy//g' scripts/check-vulnerabilities-v2.sh

# Verificar
grep EMAIL_TO scripts/check-vulnerabilities-v2.sh
```

### Reemplazar todos los destinatarios
```bash
cd /var/www/goya

# Nuevos emails
NEW_EMAILS="admin@riogas.com.uy;support@riogas.com.uy"

# Actualizar ambos scripts
sed -i "s|EMAIL_TO=\".*\"|EMAIL_TO=\"$NEW_EMAILS\"|" scripts/check-vulnerabilities.sh
sed -i "s|EMAIL_TO=\".*\"|EMAIL_TO=\"$NEW_EMAILS\"|" scripts/check-vulnerabilities-v2.sh
```

---

## 🔐 Consideraciones de Seguridad

### ✅ Buenas Prácticas

1. **Usar emails corporativos**: Solo emails `@riogas.com.uy` o `@riogas.com.ar`
2. **Limitar destinatarios**: Máximo 5-10 destinatarios para evitar problemas de SMTP
3. **Emails válidos**: Verificar que todos los emails existan antes de configurar
4. **Permisos del script**: El archivo contiene credenciales SMTP
   ```bash
   chmod 700 scripts/check-vulnerabilities-v2.sh
   ```

### ⚠️ Evitar

- ❌ Emails externos no autorizados
- ❌ Más de 20 destinatarios (puede saturar SMTP)
- ❌ Emails con espacios o caracteres especiales

---

## 📧 Formato del Email Recibido

**Todos los destinatarios recibirán:**

```
De: notificacionesautomaticas@riogas.com.uy
Para: julio.gomez@riogas.com.uy, maria.lopez@riogas.com.uy, admin@riogas.com.uy
Asunto: ⚠️ [URGENTE] Reporte de Vulnerabilidades - 04/02/2026

[Cuerpo HTML con tabla de vulnerabilidades]

Adjuntos:
- vulnerability-report-20260204.txt
- fix-commands-20260204.sh
```

---

## 🧪 Test de Configuración

### Script de prueba rápida

```bash
#!/bin/bash
cd /var/www/goya

echo "========================================="
echo "Test de Configuración de Múltiples Emails"
echo "========================================="
echo ""

echo "📧 Destinatarios configurados en check-vulnerabilities-v2.sh:"
grep "EMAIL_TO=" scripts/check-vulnerabilities-v2.sh | head -1

echo ""
echo "📧 Destinatarios configurados en check-vulnerabilities.sh:"
grep "EMAIL_TO=" scripts/check-vulnerabilities.sh | head -1

echo ""
echo "🧪 Ejecutando test de envío..."
bash scripts/check-vulnerabilities-v2.sh

echo ""
echo "✅ Verifica que todos los destinatarios recibieron el email"
```

---

## ❓ FAQ

### ¿Puedo usar emails de diferentes dominios?

Sí, pero el servidor SMTP `mail.riogas.com.uy` debe permitir el relay:
```bash
EMAIL_TO="interno@riogas.com.uy;externo@gmail.com"
```

### ¿Hay límite de destinatarios?

Técnicamente no, pero se recomienda máximo **10 destinatarios** para evitar:
- Clasificación como spam
- Problemas de rendimiento SMTP
- Rate limiting

### ¿Cómo sé si todos recibieron el email?

Revisa los logs del script:
```bash
tail -f /var/log/vulnerability-check.log
```

Busca la línea:
```
[SUCCESS] Email enviado correctamente con 2 adjuntos
```

### ¿Qué pasa si un email es inválido?

El envío puede fallar completamente. Verifica que todos los emails sean válidos:
```bash
# Test individual por email
for email in $(echo "email1@ejemplo.com;email2@ejemplo.com" | tr ';' ' '); do
    echo "Testing: $email"
    # Aquí podrías usar un validador de emails
done
```

---

## 📚 Archivos Relacionados

- `scripts/check-vulnerabilities.sh` - Script original (línea 13)
- `scripts/check-vulnerabilities-v2.sh` - Script mejorado (línea 13)
- `scripts/install-monitoring.sh` - Instalador (línea 76)

---

## 🔄 Actualizar Después de Cambios

Si modificas manualmente los emails, **no necesitas reiniciar nada**:

```bash
# Los cambios aplican inmediatamente
bash scripts/check-vulnerabilities-v2.sh
```

Si tienes cron configurado, **no necesitas reconfigurar**:
```bash
# El cron usará la nueva configuración automáticamente
crontab -l
```

---

**Última actualización**: 4 de Febrero, 2026
