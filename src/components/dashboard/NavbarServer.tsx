// src/app/_components/NavbarServer.tsx
import { headers, cookies } from "next/headers";
import { Navbar } from "./Navbar"; // tu Navbar client

export default async function NavbarServer() {
  const h = await headers();
  const c = await cookies();

  // Valores desde el middleware (headers) con fallback a cookies
  const routeCode = h.get("x-route-code") ?? c.get("routeCode")?.value ?? "";
  const routeName = h.get("x-route-name") ?? c.get("routeName")?.value ?? "";
  const userName  = h.get("x-user-name")  ?? c.get("userName")?.value  ?? "";

  // Prefijo de app
  const appId = process.env.NEXT_PUBLIC_APLICACION_ID ?? "0";
  const codeWithApp = routeCode ? `${appId}|${routeCode}` : "";

  // Fecha/hora fija (del render server de esta request)
  const dateTime = new Intl.DateTimeFormat("es-UY", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date());

  // Logs de depuración del server render
  console.log("[NavbarServer] routeName:", routeName || "(vacío)");
  console.log("[NavbarServer] routeCode:", routeCode || "(vacío)");
  console.log("[NavbarServer] codeWithApp:", codeWithApp || "(vacío)");
  console.log("[NavbarServer] userName:", userName || "(vacío)");
  console.log("[NavbarServer] dateTime:", dateTime);

  return (
    <Navbar
      routeName={routeName}
      routeCode={routeCode}
      codeWithApp={codeWithApp}
      userNameFromServer={userName}
      dateTime={dateTime}
    />
  );
}
