import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get('db')
  async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: 'connected' };
    } catch (err) {
      return { ok: false, db: 'error', error: String(err) };
    }
  }
}