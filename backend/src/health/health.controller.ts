import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check general' })
  @ApiResponse({ status: 200, description: 'Backend activo' })
  async check() {
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    let dbStatus = 'disconnected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      environment: process.env.NODE_ENV || 'development',
      database: dbStatus,
      memory: {
        rss: `${(memory.rss / 1024 / 1024).toFixed(1)}MB`,
        heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(1)}MB`,
        heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(1)}MB`,
      },
    };
  }

  @Get('db')
  @ApiOperation({ summary: 'Check de conexión a la base de datos' })
  @ApiResponse({ status: 200, description: 'Base de datos conectada' })
  async checkDb() {
    try {
      const result = await this.prisma.$queryRaw<
        Array<{ db: string; usr: string; ver: string }>
      >`SELECT current_database() as db, current_user as usr, version() as ver`;
      return {
        status: 'connected',
        ...result[0],
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }
}
