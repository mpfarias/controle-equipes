import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get('db')
  async checkDatabase() {
    try {
      // Usar query Prisma simples ao invés de queryRaw
      await this.prisma.usuario.count();
      return { ok: true, db: 'connected' };
    } catch (err) {
      // Não expor detalhes de erro em produção
      const isDevelopment = process.env.NODE_ENV !== 'production';
      return {
        ok: false,
        db: 'error',
        ...(isDevelopment && { error: String(err) }),
      };
    }
  }
}