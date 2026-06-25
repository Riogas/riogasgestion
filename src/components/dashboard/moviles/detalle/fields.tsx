"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ─── Campo de texto / número ────────────────────────────────────────────────────

export function Field({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
  placeholder,
  className,
}: {
  label: string;
  value: string | number | null | undefined;
  onChange?: (v: string) => void;
  type?: "text" | "number" | "date";
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value ?? ""}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={cn(readOnly && "opacity-60 cursor-not-allowed bg-muted/40")}
      />
    </div>
  );
}

// ─── Textarea ───────────────────────────────────────────────────────────────────

export function TextareaField({
  label,
  value,
  onChange,
  rows = 3,
  className,
}: {
  label: string;
  value: string | null | undefined;
  onChange?: (v: string) => void;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <textarea
        value={value ?? ""}
        rows={rows}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="flex w-full rounded-[var(--radius-md)] border-[1.5px] border-input bg-card px-3.5 py-2 text-sm shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[var(--shadow-glow-primary)]"
      />
    </div>
  );
}

// ─── Select nativo (estética dark) ──────────────────────────────────────────────

export function SelectField({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <select
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="h-10 w-full rounded-[var(--radius-md)] border-[1.5px] border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Fila de switch (azul ON / gris OFF) ────────────────────────────────────────

export function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border/60 bg-card/40 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
