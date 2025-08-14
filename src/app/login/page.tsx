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
        console.log("✅ Login exitoso:", response.data);


        // Guardar datos de sesión
        localStorage.setItem("user", JSON.stringify(response.data.user));
        // Guardar puesto por defecto (cookie y localStorage)
        const puestoDefault = { puestoId: 4, PuestoDsc: "SALTO" };
        localStorage.setItem("puesto", JSON.stringify(puestoDefault));
        // Guardar en cookie (expira en 30 días)
        document.cookie = `puestoId=4; path=/; max-age=${60 * 60 * 24 * 30}`;
        document.cookie = `PuestoDsc=SALTO; path=/; max-age=${60 * 60 * 24 * 30}`;

        // 🎯 Identificar usuario en LogRocket
        const user = response.data.user;
        LogRocket.identify(user.email || 'user-' + Date.now(), {
          name: user.name,
          email: user.email,
          role: user.role,
          // Añadir cualquier otra propiedad útil
          loginTime: new Date().toISOString(),
        });

        // 📊 Registrar evento de login exitoso
        LogRocket.track('Login Success', {
          email: user.email,
          role: user.role,
          timestamp: new Date().toISOString()
        });

        toast.success("Inicio de sesión exitoso", {
          description: "Redirigiendo al panel...",
          duration: 3000,
        });

        router.push("/dashboard");
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
