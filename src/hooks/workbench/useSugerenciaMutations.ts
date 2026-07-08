import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  aceptarSugerencia,
  rechazarSugerencia,
  deshacerSugerencia,
} from "@/services/workbench";

export function useSugerenciaMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sugerencias"] });
  };

  const aceptar = useMutation({
    mutationFn: (id: number | string) => aceptarSugerencia(id),
    onSuccess: () => {
      invalidate();
      toast.success("Sugerencia aceptada");
    },
    onError: () => toast.error("Error al aceptar la sugerencia"),
  });

  const rechazar = useMutation({
    mutationFn: (id: number | string) => rechazarSugerencia(id),
    onSuccess: () => {
      invalidate();
      toast.success("Sugerencia rechazada");
    },
    onError: () => toast.error("Error al rechazar la sugerencia"),
  });

  const deshacer = useMutation({
    mutationFn: (id: number | string) => deshacerSugerencia(id),
    onSuccess: () => {
      invalidate();
      toast.success("Sugerencia deshecha");
    },
    onError: () => toast.error("Error al deshacer la sugerencia"),
  });

  return { aceptar, rechazar, deshacer };
}
