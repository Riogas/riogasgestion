"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Importar LogRocket dinámicamente solo en el cliente
const useLogRocket = () => {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined' || initialized) return;

    // Página pública del sorteo (/sorteo): NO grabar sesión. Ahí navegan
    // consumidores finales y LogRocket capturaría PII (nombre/teléfono/email,
    // código de canje, bodies de /api/sorteo-publico/*). A /sorteo se llega
    // siempre por carga completa desde el QR (no hay navegación client-side
    // desde el dashboard hacia ahí), así que este chequeo al montar alcanza.
    const { pathname } = window.location;
    if (pathname === '/sorteo' || pathname.startsWith('/sorteo/')) return;

    // Importar LogRocket dinámicamente
    import('logrocket')
      .then((LogRocket) => {
        try {
          console.log('🎯 Inicializando LogRocket...');
          LogRocket.default.init('w2ree2/goya');
          console.log('✅ LogRocket inicializado correctamente');
          
          // 🔍 Verificar Sentry DSN
          console.log('🔍 Sentry DSN:', process.env.NEXT_PUBLIC_SENTRY_DSN);
          console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
          
          // Verificar si hay un usuario ya logueado
          try {
            const savedUser = localStorage.getItem('user');
            if (savedUser) {
              const user = JSON.parse(savedUser);
              LogRocket.default.identify(user.email || 'user-' + Date.now(), {
                name: user.name,
                email: user.email,
                role: user.role,
                sessionType: 'returning_user',
                lastLogin: new Date().toISOString(),
              });
              console.log('👤 Usuario existente identificado en LogRocket:', user.name);
            }
          } catch (error) {
            console.warn('⚠️ No se pudo cargar usuario guardado:', error);
          }
          
          // Generar eventos de prueba
          setTimeout(() => {
            LogRocket.default.track('App Loaded');
            console.log('📊 Evento de prueba enviado a LogRocket');
          }, 1000);

          setInitialized(true);
        } catch (error) {
          console.error('❌ Error inicializando LogRocket:', error);
        }
      })
      .catch((error) => {
        console.error('❌ Error cargando LogRocket:', error);
      });
  }, [initialized]);
};

function LogRocketInit() {
  useLogRocket();
  return null; // No renderiza nada
}

export default LogRocketInit;
