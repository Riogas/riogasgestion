"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, X, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

// Sencillo proveedor de Chat con un globito flotante.
// Envía los mensajes a un servicio n8n en localhost:5678 por defecto.
// Configurable con NEXT_PUBLIC_CHAT_API_URL

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
};

const STORAGE_CHAT_OPEN = "chat_open";
const STORAGE_CHAT_MESSAGES = "chat_messages";

const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || "http://localhost:5678";
const CHAT_ENDPOINT = (process.env.NEXT_PUBLIC_CHAT_ENDPOINT || "/chat").replace(/\/+$/, "");

// Extrae una respuesta de distintas formas comunes devueltas por backends (n8n/OpenAI/etc)
function extractReply(data: any): string | undefined {
  if (!data) return undefined;
  // Si es string directo
  if (typeof data === "string") return data;
  // Si viene como array
  if (Array.isArray(data)) {
    // Busca el primer campo conocido dentro de los items
    for (const item of data) {
      const r = extractReply(item);
      if (r) return r;
    }
  }
  // Formas típicas
  // 1) { reply: string }
  if (typeof data.reply === "string" && data.reply.trim()) return data.reply;
  // 2) { text: string }
  if (typeof data.text === "string" && data.text.trim()) return data.text;
  // 3) { output: string }
  if (typeof data.output === "string" && data.output.trim()) return data.output;
  // 4) { message: { content: string } }
  if (data.message && typeof data.message.content === "string" && data.message.content.trim()) {
    return data.message.content;
  }
  // 5) OpenAI-like { choices: [{ message: { content } }] }
  const c = data.choices?.[0]?.message?.content;
  if (typeof c === "string" && c.trim()) return c;
  // 6) { content: string }
  if (typeof data.content === "string" && data.content.trim()) return data.content;
  // 7) { result: string } o { result_text: string }
  if (typeof data.result === "string" && data.result.trim()) return data.result;
  if (typeof data.result_text === "string" && data.result_text.trim()) return data.result_text;
  // 8) { data: { message: { content } }}
  const nested = data.data?.message?.content;
  if (typeof nested === "string" && nested.trim()) return nested;
  return undefined;
}

export default function ChatProvider() {
  const [isMounted, setIsMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Asegurar que el componente está montado antes de acceder a localStorage
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cargar estado de localStorage solo después de montarse
  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return;
    
    const o = localStorage.getItem(STORAGE_CHAT_OPEN);
    setOpen(o === "1");
    const raw = localStorage.getItem(STORAGE_CHAT_MESSAGES);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ChatMessage[];
        setMessages(parsed);
      } catch {
        // no-op
      }
    } else {
      // saludo inicial
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "¡Hola! Soy tu asistente. ¿En qué puedo ayudarte hoy?",
          createdAt: Date.now(),
        },
      ]);
    }
  }, [isMounted]);

  // Persistir
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_CHAT_OPEN, open ? "1" : "0");
  }, [open]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_CHAT_MESSAGES, JSON.stringify(messages));
  }, [messages]);

  // Scroll al final cuando lleguen mensajes
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  const sendMessage = async () => {
    if (!canSend) return;
    const text = input.trim();
    setInput("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    setSending(true);
    try {
      const res = await fetch(`${CHAT_API_URL}${CHAT_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages.slice(-10) }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Intentar JSON; si no, caer a texto y reintentar parseo
      let data: any;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json().catch(() => ({}));
      } else {
        const raw = await res.text().catch(() => "");
        try { data = JSON.parse(raw); } catch { data = { text: raw }; }
      }

      const reply = extractReply(data) ?? "(sin respuesta)";

      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: String(reply),
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "No pude contactar el asistente. Verifica que n8n esté en ejecución en " +
          `${CHAT_API_URL}${CHAT_ENDPOINT}`,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* FAB flotante con gradient brand */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar chat" : "Abrir chat"}
          title={open ? "Cerrar chat" : "Abrir chat"}
          className={cn(
            "h-14 w-14 rounded-full inline-flex items-center justify-center text-white",
            "bg-gradient-to-br from-primary to-accent shadow-lg",
            "transition-all duration-200 ease-[var(--ease-out-quart)]",
            "hover:scale-105 hover:shadow-[var(--shadow-glow-primary)]",
            "active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </button>
      </div>

      {/* Ventana de chat — glass panel */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-50 w-[92vw] max-w-sm sm:max-w-md",
          open ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-3",
          "transition-all duration-200 ease-[var(--ease-out-quart)]"
        )}
      >
        <Card variant="glass" className="shadow-lg">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-primary to-accent text-white shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">Asistente</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
                Conectado
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Mensajes */}
          <div ref={listRef} className="px-4 py-3 max-h-[60vh] overflow-y-auto space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex items-start gap-2", m.role === "user" ? "justify-end" : "justify-start")}>                
                {m.role !== "user" && (
                  <Avatar className="h-7 w-7 mt-0.5">
                    <AvatarFallback className="text-[10px]">AI</AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={cn(
                    "rounded-[var(--radius-lg)] px-3 py-2 text-sm whitespace-pre-wrap max-w-[80%] shadow-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  )}
                >
                  {m.content}
                </div>

                {m.role === "user" && (
                  <Avatar className="h-7 w-7 mt-0.5">
                    <AvatarFallback className="text-[10px]">Yo</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex items-start gap-2">
                <Avatar size="sm" className="mt-0.5">
                  <AvatarFallback className="text-[10px]">AI</AvatarFallback>
                </Avatar>
                <div className="rounded-[var(--radius-lg)] px-3 py-2 text-sm bg-card border border-border text-muted-foreground inline-flex items-center gap-1.5 shadow-sm">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse-soft" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse-soft" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse-soft" style={{ animationDelay: "300ms" }} />
                  </span>
                  Escribiendo
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border/60 p-3">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje..."
                disabled={sending}
              />
              <Button onClick={sendMessage} disabled={!canSend}>
                <Send className="h-4 w-4 mr-1" /> Enviar
              </Button>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Enter para enviar • Shift+Enter para nueva línea
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
