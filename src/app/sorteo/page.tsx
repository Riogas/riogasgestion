// Página pública del sorteo: todo el flujo (estado → form → resultado) vive
// en el orquestador client-side. El código del QR viaja en cookie httpOnly,
// así que esta página no recibe ni maneja ningún parámetro.
import SorteoPublicoView from "@/components/sorteo/SorteoPublicoView";

export default function SorteoPage() {
  return <SorteoPublicoView />;
}
