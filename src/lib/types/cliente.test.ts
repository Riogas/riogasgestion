/**
 * Unit tests for cliente zod schemas.
 * Run with: npx tsx src/lib/types/cliente.test.ts
 */
import assert from "node:assert";
import { createClienteSchema, telefonoSchema, clienteSchema } from "./cliente";

// ─── createClienteSchema ──────────────────────────────────────────────────────

// 1. Rejects when nombre is missing
{
  const result = createClienteSchema.safeParse({
    nombre: "",
    telefonos: [{ numero: "099123456", principal: true }],
    direcciones: [{ calle: "Av. Italia", principal: true }],
  });
  assert.equal(result.success, false, "Should fail: nombre is empty");
  const issues = (result as { success: false; error: { issues: { path: string[] }[] } }).error.issues;
  assert.ok(
    issues.some((i) => i.path.includes("nombre")),
    "Error should mention nombre",
  );
  console.log("PASS: createClienteSchema rejects empty nombre");
}

// 2. Rejects when telefonos array is missing
{
  const result = createClienteSchema.safeParse({
    nombre: "Juan",
    telefonos: [],
    direcciones: [{ calle: "Av. Italia", principal: true }],
  });
  assert.equal(result.success, false, "Should fail: no telefonos");
  console.log("PASS: createClienteSchema rejects empty telefonos");
}

// 3. Accepts a valid full payload
{
  const result = createClienteSchema.safeParse({
    nombre: "María",
    telefonos: [{ numero: "099123456", principal: true }],
    direcciones: [{ calle: "Av. Italia 2345", principal: true }],
  });
  assert.equal(result.success, true, "Should succeed with valid payload");
  if (result.success) {
    assert.equal(result.data.nombre, "María");
    assert.equal(result.data.telefonos[0].numero, "099123456");
    assert.equal(result.data.direcciones[0].calle, "Av. Italia 2345");
  }
  console.log("PASS: createClienteSchema accepts valid payload");
}

// ─── telefonoSchema ───────────────────────────────────────────────────────────

// 4. Validates numero field is required
{
  const result = telefonoSchema.safeParse({ numero: "" });
  assert.equal(result.success, false, "Should fail: numero is empty");
  console.log("PASS: telefonoSchema rejects empty numero");
}

// 5. Accepts valid telefono
{
  const result = telefonoSchema.safeParse({
    numero: "26001234",
    alias: "Casa",
    tipo: "FI",
    principal: true,
  });
  assert.equal(result.success, true, "Should accept valid telefono");
  if (result.success) {
    assert.equal(result.data.numero, "26001234");
    assert.equal(result.data.principal, true);
  }
  console.log("PASS: telefonoSchema accepts valid telefono");
}

// ─── clienteSchema ────────────────────────────────────────────────────────────

// 6. Invalid email is rejected
{
  const result = clienteSchema.safeParse({ nombre: "Test", email: "not-an-email" });
  assert.equal(result.success, false, "Should fail: bad email");
  console.log("PASS: clienteSchema rejects bad email");
}

// 7. Empty string email is allowed (optional field)
{
  const result = clienteSchema.safeParse({ nombre: "Test", email: "" });
  assert.equal(result.success, true, "Should accept empty string email");
  console.log("PASS: clienteSchema accepts empty string email");
}

console.log("\nAll zod schema tests passed.");
