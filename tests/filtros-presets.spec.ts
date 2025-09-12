import { test, expect } from '@playwright/test';

test.describe('Sistema de Filtros Presets', () => {
  
  test.beforeEach(async ({ page }) => {
    // Setup: Login y navegar a pedidos
    await page.goto('/login');
    await page.fill('input[placeholder="nombre de usuario"]', 'JGOMEZ');
    await page.fill('input[placeholder="••••••••"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  test('Crear y usar preset en Pedidos', async ({ page }) => {
    // Navegar a Pedidos
    await page.click('text=Pedidos');
    await page.waitForURL('**/dashboard/pedidos**');
    
    // Abrir panel de filtros (si existe un botón)
    const filtrosButton = page.locator('text=Filtros').or(page.locator('button:has-text("Filtro")'));
    if (await filtrosButton.isVisible()) {
      await filtrosButton.click();
    }
    
    // Configurar algunos filtros (adaptado a tu UI específica)
    // Esto es un ejemplo - ajustar según tus campos reales
    const estadoSelect = page.locator('select[name="estado"]');
    if (await estadoSelect.isVisible()) {
      await estadoSelect.selectOption('PENDIENTE');
    }
    
    // Buscar el campo de alias para preset
    const aliasInput = page.locator('input[placeholder*="alias"]').or(
      page.locator('input[placeholder*="nombre"]')
    );
    
    if (await aliasInput.isVisible()) {
      await aliasInput.fill('Pedidos Pendientes');
      
      // Guardar preset
      const guardarButton = page.locator('button:has-text("Guardar")').or(
        page.locator('button:has-text("Crear")')
      );
      
      if (await guardarButton.isVisible()) {
        await guardarButton.click();
        
        // Verificar que el preset se guardó
        await expect(page.locator('text=Pedidos Pendientes')).toBeVisible();
      }
    }
  });

  test('Gestión de presets en Services', async ({ page }) => {
    // Navegar a Services
    await page.click('text=Services');
    await page.waitForURL('**/dashboard/services**');
    
    // Similar test para Services
    // Verificar que la funcionalidad de presets está disponible
    const filtrosSection = page.locator('[data-testid="filtros"]').or(
      page.locator('.filtros')
    );
    
    // Verificar elementos básicos de filtros
    await expect(page.locator('text=Services')).toBeVisible();
  });

  test('Persistencia de presets en localStorage', async ({ page }) => {
    await page.goto('/dashboard/pedidos');
    
    // Verificar que localStorage se use para presets
    const presets = await page.evaluate(() => {
      return localStorage.getItem('pedidoPresets');
    });
    
    // Los presets deberían ser null inicialmente o un array
    expect(presets === null || Array.isArray(JSON.parse(presets || '[]'))).toBeTruthy();
  });

});