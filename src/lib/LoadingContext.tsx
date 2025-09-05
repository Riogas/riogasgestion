// src/lib/LoadingContext.tsx
"use client";
import React, { createContext, useState, useContext, useEffect } from "react";

interface LoadingContextType {
  isLoading: boolean;
  message?: string;
  setLoading: (loading: boolean, message?: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

// Global setter so non-React code (e.g., axios interceptors) can toggle loading
let externalSetLoading: ((loading: boolean, message?: string) => void) | null = null;
export function setGlobalLoading(loading: boolean, message?: string) {
  if (externalSetLoading) {
    externalSetLoading(loading, message);
  }
}

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  const setLoading = (loading: boolean, msg?: string) => {
    setIsLoading(loading);
    setMessage(loading ? msg : undefined);
  };

  // Register/unregister the external setter
  useEffect(() => {
    externalSetLoading = (loading: boolean, msg?: string) => {
      setIsLoading(loading);
      setMessage(loading ? msg : undefined);
    };
    return () => {
      externalSetLoading = null;
    };
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, message, setLoading }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}
