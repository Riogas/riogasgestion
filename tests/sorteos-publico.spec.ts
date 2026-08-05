import { test, expect } from '@playwright/test';

/**
 * Flujo público de Sorteos (`/sorteo/<codigo>` → `/sorteo`).
 *
 * Asume el front y el backend Nest ya levantados (no hay webServer en
 * playwright.config.ts) y un código de sorteo VÁLIDO Y SIN USAR en
 * `E2E_SORTEO_CODIGO`. Sin esa env los tests que la necesitan se saltean.
 *
 *   E2E_SORTEO_CODIGO=K5CGA57HNU6V npx playwright test tests/sorteos-publico.spec.ts --project=chromium
 *
 * Ninguno de estos tests confirma el formulario: el código NO se consume, así
 * que la suite se puede correr varias veces con el mismo código.
 */
const CODIGO = process.env.E2E_SORTEO_CODIGO;

// No cumple el `CODIGO_REGEX` de `src/lib/sorteo/publicApi.ts` (largo != 12 y
// letras fuera del alfabeto Base32): el handler lo descarta sin tocar la base.
const CODIGO_MALFORMADO = 'CODIGOFALSO123';

test.describe('Sorteo público', () => {
  test('el código del QR se cambia por una cookie y la URL queda limpia', async ({
    page,
  }) => {
    test.skip(!CODIGO, 'Seteá E2E_SORTEO_CODIGO con un código válido sin usar');

    await page.goto(`/sorteo/${CODIGO}`);

    // 302 a /sorteo: el código no queda ni en la barra ni en el historial.
    await expect(page).toHaveURL(/\/sorteo$/);
    expect(page.url()).not.toContain(CODIGO as string);

    // El código viaja en una cookie httpOnly (invisible para el JS del cliente).
    const cookies = await page.context().cookies();
    const cookieCodigo = cookies.find((c) => c.name === 'sorteo_codigo');
    expect(cookieCodigo?.value).toBe(CODIGO);
    expect(cookieCodigo?.httpOnly).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      CODIGO as string,
    );

    // Estado ok → formulario visible.
    await expect(
      page.getByRole('textbox', { name: /Nombre y apellido/ }),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Celular/ })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: /Edad/ })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Participar del sorteo/ }),
    ).toBeVisible();
  });

  test('un código malformado no muestra el formulario', async ({ page }) => {
    // Sin cookie previa: el handler no setea nada y la página pide reescanear.
    await page.context().clearCookies();

    await page.goto(`/sorteo/${CODIGO_MALFORMADO}`);

    await expect(page).toHaveURL(/\/sorteo$/);
    await expect(
      page.getByRole('heading', {
        name: /Escaneá el QR para participar|Código no válido/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Participar del sorteo/ }),
    ).toHaveCount(0);
  });

  test('el formulario rechaza un teléfono inválido sin enviar nada', async ({
    page,
  }) => {
    test.skip(!CODIGO, 'Seteá E2E_SORTEO_CODIGO con un código válido sin usar');

    await page.goto(`/sorteo/${CODIGO}`);
    await expect(
      page.getByRole('button', { name: /Participar del sorteo/ }),
    ).toBeVisible();

    await page.getByRole('textbox', { name: /Nombre y apellido/ }).fill('Test E2E');
    await page.getByRole('textbox', { name: /Celular/ }).fill('123');
    await page.getByRole('spinbutton', { name: /Edad/ }).fill('30');

    await page.getByRole('button', { name: /Participar del sorteo/ }).click();

    // zod frena el submit: aparece el error y el formulario sigue en pantalla.
    await expect(page.getByText(/Revisá el número/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Participar del sorteo/ }),
    ).toBeVisible();
  });
});
