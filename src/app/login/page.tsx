"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Loader2 } from "lucide-react";
import { useTheme } from "@/lib/useTheme";
import { useState } from "react";
import { toast } from "sonner"; // 👈 Notificaciones visuales
import { apiLogin } from "@/services/api"; // 👈 Importa tu API
import { useRouter } from "next/navigation"; // 👈 Para redirección
import LogRocket from 'logrocket'; // 👈 Para identificar usuario
import * as Sentry from '@sentry/nextjs'; // 👈 Para testing de errores
import Image from "next/image";

export default function LoginPage() {
  const { theme, toggleTheme } = useTheme();

  // Reemplazar email por usuario
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ usuario?: string; password?: string }>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!usuario.trim()) newErrors.usuario = "El usuario es obligatorio";
    if (!password.trim()) newErrors.password = "La contraseña es obligatoria";

    if (newErrors.usuario || newErrors.password) {
      console.log("❌ Datos inválidos, mostrar errores:", newErrors);
      toast.error("Por favor, corrige los errores", {
        description: "Revisa los campos resaltados",
        duration: 3000,
      });
      setErrors(newErrors);
      return;
    }

    if (Object.keys(newErrors).length === 0) {
      try {
        setLoading(true);

        const res = await apiLogin(usuario, password);
        const response = res as { data: any };
        
        // 📋 GRUPO DE LOGS DE LOGIN - Inicio
        console.group("🔐 PROCESO DE LOGIN");
        console.log("✅ Login exitoso:", response.data);
        console.log("✅ Estructura completa del response:", JSON.stringify(response, null, 2));

        // Extraer el token y usuario de la respuesta directa
        let token = null;
        let user = null;
        
        // El API ahora devuelve el token directamente en response.data.user.token
        if (response.data.user && response.data.user.token) {
          token = response.data.user.token;
          user = response.data.user;
          console.log("✅ Token encontrado en user:", token.substring(0, 30) + "...");
          console.log("✅ Usuario:", user);
        } else {
          console.error("❌ No se encontró token en response.data.user.token");
          console.log("📋 Estructura disponible:", Object.keys(response.data));
        }
        
        // Para desarrollo: si no hay token del API, crear uno mock
        if (!token) {
          console.warn("⚠️ No se encontró token del API, usando token mock para desarrollo");
          token = "mock-jwt-token-for-development-" + Date.now();
        }
        
        console.log("🔑 Token a usar:", token ? "SÍ" : "NO", token?.substring(0, 30) + "...");
        
        // Establecer cookie sin flags problemáticos para localhost
        document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 30}`;
        console.log("🍪 Cookie token establecida");
        
        // Verificar que se estableció correctamente
        const cookieCheck = document.cookie.includes('token=');
        console.log("🔍 Cookie verificada en document.cookie:", cookieCheck);

        // Guardar datos de sesión (usar el user parseado si existe)
        if (user) {
          localStorage.setItem("user", JSON.stringify(user));
          console.log("💾 Usuario guardado en localStorage");
        } else {
          localStorage.setItem("user", JSON.stringify(response.data.user || {}));
          console.log("💾 Usuario (fallback) guardado en localStorage");
        }
        
        // Guardar puesto por defecto (cookie y localStorage)
        const puestoDefault = { puestoId: 4, PuestoDsc: "SALTO" };
        localStorage.setItem("puesto", JSON.stringify(puestoDefault));
        // Guardar en cookie (expira en 30 días)
        document.cookie = `puestoId=4; path=/; max-age=${60 * 60 * 24 * 30}`;
        document.cookie = `PuestoDsc=SALTO; path=/; max-age=${60 * 60 * 24 * 30}`;
        console.log("🏢 Puesto por defecto guardado (localStorage + cookies)");

        // 🎯 Identificar usuario en LogRocket
        const finalUser = user || response.data.user || {};
        LogRocket.identify(finalUser.email || finalUser.username || 'user-' + Date.now(), {
          name: finalUser.nombre || finalUser.name,
          email: finalUser.email,
          username: finalUser.username,
          id: finalUser.id,
          // Añadir cualquier otra propiedad útil
          loginTime: new Date().toISOString(),
        });
        console.log("📊 Usuario identificado en LogRocket");

        // 📊 Registrar evento de login exitoso
        LogRocket.track('Login Success', {
          username: finalUser.username,
          userId: finalUser.id,
          timestamp: new Date().toISOString()
        });
        console.log("📈 Evento 'Login Success' registrado en LogRocket");
        
        console.log("✅ TODOS LOS PROCESOS COMPLETADOS - Redirigiendo en 2 segundos...");
        console.groupEnd();
        // 📋 GRUPO DE LOGS DE LOGIN - Fin

        toast.success("Inicio de sesión exitoso", {
          description: "Redirigiendo al panel...",
          duration: 3000,
        });

        // Pequeña pausa para ver los logs antes de redirigir
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } catch (error: any) {
        console.error("❌ Error al iniciar sesión:", error);

        // 📊 Registrar intento de login fallido
        LogRocket.track('Login Failed', {
          username: usuario,
          error: error.message || 'Unknown error',
          timestamp: new Date().toISOString()
        });

        toast.error("Login fallido", {
          description:
            error.response?.data?.message || "Verifica tus credenciales.",
          duration: 4000,
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // 🧪 Función de prueba para Sentry
  const testSentryError = () => {
    console.log('🧪 Generando error de prueba para Sentry...');
    Sentry.captureException(new Error('Error de prueba desde Login Page'));
    throw new Error('Error de prueba manual');
  };

  return (
    <main className="min-h-screen flex items-center justify-center text-foreground px-4 relative">
      <div
        className="absolute inset-0 w-full h-full -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/backgroundgoya.png')" }}
      />
      <div className="absolute inset-0 w-full h-full -z-5 bg-black/30" />

      {/* Toggle Dark/Light */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition"
        aria-label="Cambiar tema"
      >
        {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="w-full max-w-sm space-y-6 p-6 rounded-2xl shadow-xl border bg-card/70 backdrop-blur-md">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Image
              src="/logogoya.png"
              alt="Logo Goya"
              width={280}
              height={280}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold">Iniciar sesión</h1>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="usuario">Usuario</Label>
            <Input
              id="usuario"
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="nombre de usuario"
              className={errors.usuario ? "border-red-500" : ""}
            />
            {errors.usuario && (
              <p className="text-sm text-red-500">{errors.usuario}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={errors.password ? "border-red-500" : ""}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password}</p>
            )}
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading && <Loader2 className="animate-spin w-4 h-4 mr-2" />}
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          ¿Has olvidado la contraseña?{" "}
          <a href="#" className="underline">
            Recuperar contraseña
          </a>
        </p>
      </div>
    </main>
  );
}
