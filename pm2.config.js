module.exports = {
  apps: [
    // ============================================
    // FRONTEND — Next.js (Goya)
    // ============================================
    {
      name: 'goya',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',           // Tiempo mínimo antes de considerar "iniciado"
      max_restarts: 50,            // Reintentos antes de rendirse
      restart_delay: 4000,         // Esperar 4s entre reinicios
      kill_timeout: 5000,          // Esperar 5s antes de forzar cierre
      listen_timeout: 5000,        // Timeout para que la app esté lista
      exp_backoff_restart_delay: 100, // Backoff exponencial en reinicios
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',  // Ignorar errores de certificado SSL
        UV_THREADPOOL_SIZE: '2'  // Limitar el pool de threads de libuv
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Cargar variables de entorno desde .env.production
      env_file: '.env.production'
    },

    // ============================================
    // BACKEND — NestJS + PostgreSQL
    // ============================================
    {
      name: 'goya-api',
      cwd: './backend',
      script: 'dist/main.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 50,
      restart_delay: 4000,
      kill_timeout: 5000,
      listen_timeout: 5000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '../logs/pm2-api-error.log',
      out_file: '../logs/pm2-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env_file: '.env'
    }
  ]
};
