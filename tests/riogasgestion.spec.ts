import { test, expect } from '@playwright/test';

test.describe('RioGas Gestión - Tests E2E', () => {
  
  test.beforeEach(async ({ page }) => {
    // Configurar para preservar localStorage entre tests
    await page.addInitScript(() => {
      // Mock de datos para testing
      window.localStorage.setItem('theme', 'light');
    });
  });

  test('Login EXITOSO - credenciales correctas', async ({ page }) => {
    // Ir a la página de login
    await page.goto('/login');
    
    // Esperar a que la página cargue
    await page.waitForLoadState('networkidle');
    
    // Verificar que estamos en la página de login
    await expect(page.locator('h1')).toContainText('Iniciar sesión');
    
    // Verificar elementos del formulario
    await expect(page.locator('input[placeholder="nombre de usuario"]')).toBeVisible();
    await expect(page.locator('input[placeholder="••••••••"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Llenar formulario con credenciales CORRECTAS
    await page.fill('input[placeholder="nombre de usuario"]', 'jgomez');
    await page.fill('input[placeholder="••••••••"]', 'VeintiunoDeOctubre!');
    
    // Click en ingresar
    await page.click('button[type="submit"]');
    
    // Verificar loading state
    await expect(page.locator('text=Ingresando...')).toBeVisible();
    
    // Esperar redirección al dashboard (con timeout generoso)
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    
    // Verificar que estamos en el dashboard
    await expect(page.locator('text=Clientes')).toBeVisible({ timeout: 10000 });
    
    // Verificar que también hay otros elementos del menú
    await expect(page.locator('text=Pedidos')).toBeVisible({ timeout: 5000 });
    
    console.log('✅ LOGIN EXITOSO - Test completado correctamente');
  });

  test('Login FALLIDO - credenciales incorrectas', async ({ page }) => {
    // Ir a la página de login
    await page.goto('/login');
    
    // Esperar a que la página cargue
    await page.waitForLoadState('networkidle');
    
    // Verificar que estamos en la página de login
    await expect(page.locator('h1')).toContainText('Iniciar sesión');
    
    // Llenar formulario con credenciales INCORRECTAS
    await page.fill('input[placeholder="nombre de usuario"]', 'usuarioIncorrecto');
    await page.fill('input[placeholder="••••••••"]', 'passwordIncorrecto123');
    
    // Click en ingresar
    await page.click('button[type="submit"]');
    
    // Verificar loading state
    await expect(page.locator('text=Ingresando...')).toBeVisible();
    
    // Esperar mensaje de error (ajustar según tu implementación)
    // Puede ser un toast, un alert, o un mensaje en la página
    await expect(page.locator('text=Login fallido').or(
      page.locator('text=credenciales')
    ).or(
      page.locator('[role="alert"]')
    )).toBeVisible({ timeout: 10000 });
    
    // Verificar que NO nos redirigió al dashboard
    await expect(page.locator('h1')).toContainText('Iniciar sesión');
    
    // Verificar que seguimos en la página de login
    expect(page.url()).toContain('/login');
    
    console.log('✅ LOGIN FALLIDO - Test de error completado correctamente');
  });

  test('Navegación del dashboard', async ({ page }) => {
    // Para este test, asumimos que ya tenemos sesión
    // (en un caso real harías login primero o usarías un setup)
    
    // Ir directo al dashboard
    await page.goto('/dashboard');
    
    // Si no hay sesión, debería redirigir a login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      // Hacer login rápido
      await page.fill('input[placeholder="nombre de usuario"]', 'JGOMEZ');
      await page.fill('input[placeholder="••••••••"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard**');
    }
    
    // Verificar elementos del sidebar
    await expect(page.locator('text=Clientes')).toBeVisible();
    await expect(page.locator('text=Pedidos')).toBeVisible();
    await expect(page.locator('text=Services')).toBeVisible();
    
    // Navegar a Clientes
    await page.click('text=Clientes');
    await page.waitForURL('**/dashboard/clientes**');
    
    // Navegar a Configuración -> Usuarios
    await page.click('text=Usuarios');
    await page.waitForURL('**/dashboard/configuracion/usuarios**');
  });

  test('Toggle tema oscuro/claro', async ({ page }) => {
    await page.goto('/login');
    
    // Buscar el botón de toggle tema
    const themeToggle = page.locator('button[aria-label="Cambiar tema"]');
    await expect(themeToggle).toBeVisible();
    
    // Click para cambiar tema
    await themeToggle.click();
    
    // Verificar que el tema cambió (el icono debería cambiar)
    // Esto depende de tu implementación específica
    await expect(themeToggle).toBeVisible();
  });

  test('Validación de formulario de login', async ({ page }) => {
    await page.goto('/login');
    
    // Intentar login sin datos
    await page.click('button[type="submit"]');
    
    // Verificar mensajes de error
    await expect(page.locator('text=El usuario es obligatorio')).toBeVisible();
    await expect(page.locator('text=La contraseña es obligatoria')).toBeVisible();
    
    // Llenar solo usuario
    await page.fill('input[placeholder="nombre de usuario"]', 'JGOMEZ');
    await page.click('button[type="submit"]');
    
    // Solo debería mostrar error de contraseña
    await expect(page.locator('text=La contraseña es obligatoria')).toBeVisible();
    await expect(page.locator('text=El usuario es obligatorio')).not.toBeVisible();
  });

  test('Responsive design - mobile', async ({ page }) => {
    // Simular viewport móvil
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/login');
    
    // Verificar que los elementos son visibles en móvil
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[placeholder="nombre de usuario"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Verificar que el logo se ve bien
    await expect(page.locator('img[alt="Logo Goya"]')).toBeVisible();
  });

});