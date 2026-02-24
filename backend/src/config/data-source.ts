import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Cargar .env para CLI (migrations, etc.)
dotenv.config();

/**
 * DataSource para TypeORM CLI (migraciones).
 * En la app se usa TypeOrmModule.forRootAsync() en app.module.ts.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'riogas',
  password: process.env.DB_PASSWORD || 'riogas',
  database: process.env.DB_DATABASE || 'riogas_gestion',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: true,
});
