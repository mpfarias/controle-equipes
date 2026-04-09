import { Module } from '@nestjs/common';
import { TrocaServicoController } from './troca-servico.controller';
import { TrocaServicoService } from './troca-servico.service';
import { PrismaService } from '../prisma.service';
import { AuditModule } from '../audit/audit.module';
import { EscalasModule } from '../escalas/escalas.module';

@Module({
  imports: [AuditModule, EscalasModule],
  controllers: [TrocaServicoController],
  providers: [TrocaServicoService, PrismaService],
  exports: [TrocaServicoService],
})
export class TrocaServicoModule {}
