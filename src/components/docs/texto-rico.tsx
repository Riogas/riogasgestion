// Render mínimo del texto de las anotaciones: párrafos, saltos de línea y
// `código` entre backticks. No se monta un renderer de markdown entero por
// esto — lo único que usan las notas es el backtick, y meter una dependencia
// nueva para eso es peor que resolverlo en doce líneas.
import { Fragment } from "react";
import { cn } from "@/lib/utils";

function conCodigo(texto: string, clave: string) {
  return texto.split("`").map((parte, i) =>
    i % 2 === 1 ? (
      <code
        key={`${clave}-${i}`}
        // `overflow-wrap: anywhere` y no `break-all`: las notas traen cosas como
        // `calid|nombre|localidad|departamento|fuente|matchEstado`, que sin esto
        // empujan el ancho del documento en un teléfono. `break-all` corta
        // igual en el desktop, donde entra de sobra, y parte palabras al medio
        // dejando el fondo del chip cortado; `anywhere` sólo parte cuando el
        // token no entra de ninguna forma.
        className="[overflow-wrap:anywhere] rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground"
      >
        {parte}
      </code>
    ) : (
      <Fragment key={`${clave}-${i}`}>{parte}</Fragment>
    ),
  );
}

export function TextoRico({ texto, className }: { texto: string; className?: string }) {
  const limpio = (texto ?? "").trim();
  if (!limpio) return null;
  const parrafos = limpio.split(/\n\s*\n/);
  return (
    <div className={cn("space-y-2 break-words text-sm leading-relaxed text-foreground/85", className)}>
      {parrafos.map((parrafo, i) => (
        <p key={i}>
          {parrafo.split("\n").map((linea, j, todas) => (
            <Fragment key={j}>
              {conCodigo(linea, `${i}-${j}`)}
              {j < todas.length - 1 ? " " : null}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
