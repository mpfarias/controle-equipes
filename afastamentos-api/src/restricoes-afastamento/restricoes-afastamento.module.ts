import { Module } from '@nestjs/common';
import { RestricoesAfastamentoService } from './restricoes-afastamento.service';
import { RestricoesAfastamentoController } from './restricoes-afastamento.controller';
import { PrismaService } from '../prisma.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [RestricoesAfastamentoController],
  providers: [RestricoesAfastamentoService, PrismaService],
  exports: [RestricoesAfastamentoService],
})
export class RestricoesAfastamentoModule {}
