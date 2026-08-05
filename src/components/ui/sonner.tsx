"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      richColors
      closeButton
      // El FAB del chat del dashboard vive fijo en bottom-6 right-6 (56px de
      // alto): sin este offset los toasts bottom-right quedan tapados por él.
      offset={{ bottom: "5.5rem" }}
      mobileOffset={{ bottom: "5.5rem" }}
      style={
        {
          "--normal-bg": "color-mix(in oklch, var(--card) 88%, transparent)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "color-mix(in oklch, var(--card) 88%, transparent)",
          "--error-bg": "color-mix(in oklch, var(--card) 88%, transparent)",
          "--info-bg": "color-mix(in oklch, var(--card) 88%, transparent)",
          "--warning-bg": "color-mix(in oklch, var(--card) 88%, transparent)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "surface-glass shadow-md rounded-[var(--radius-lg)] border-0",
          title: "text-foreground font-medium",
          description: "text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
