"use client";

// src/app/dashboard/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";

export default function DashboardPage() {
  // Datos de ejemplo
  const usuariosData = [
    { name: "Lun", value: 210 },
    { name: "Mar", value: 240 },
    { name: "Mié", value: 230 },
    { name: "Jue", value: 260 },
    { name: "Vie", value: 280 },
    { name: "Sáb", value: 300 },
    { name: "Dom", value: 290 },
  ];

  const ordenesData = [
    { name: "8h", value: 5 },
    { name: "10h", value: 9 },
    { name: "12h", value: 12 },
    { name: "14h", value: 7 },
    { name: "16h", value: 15 },
    { name: "18h", value: 20 },
  ];

  const ingresosData = [
    { name: "Ene", value: 8200 },
    { name: "Feb", value: 10400 },
    { name: "Mar", value: 9300 },
    { name: "Abr", value: 12200 },
    { name: "May", value: 11400 },
    { name: "Jun", value: 13430 },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Panel Principal</h1>

      {/* KPIs más grandes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="py-2 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Usuarios Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-extrabold tracking-tight">245</p>
            <p className="text-sm text-muted-foreground mt-1">+12% vs semana pasada</p>
          </CardContent>
        </Card>

        <Card className="py-2 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Órdenes del Día</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-extrabold tracking-tight">68</p>
            <p className="text-sm text-muted-foreground mt-1">+5 nuevas en la última hora</p>
          </CardContent>
        </Card>

        <Card className="py-2 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Kg</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-extrabold tracking-tight">12.430 kg</p>
            <p className="text-sm text-muted-foreground mt-1">+3.2% vs mes anterior</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficas con efectos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Área: Usuarios activos */}
        <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle>Usuarios activos (7 días)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usuariosData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#4f46e5" fill="url(#colorUsers)" animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Barras: Órdenes del día */}
        <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle>Órdenes por franja horaria</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordenesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Línea: Kg */}
        <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle>Kg mensuales</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ingresosData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: any) => [`${v.toLocaleString()} kg`, "Kg"]} />
                <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={800} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
