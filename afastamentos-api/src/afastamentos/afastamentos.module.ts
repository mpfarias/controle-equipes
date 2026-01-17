import { Module } from '@nestjs/common';
import { AfastamentosService } from './afastamentos.service';
import { AfastamentosController } from './afastamentos.controller';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { RestricoesAfastamentoModule } from '../restricoes-afastamento/restricoes-afastamento.module';

@Module({
  imports: [RestricoesAfastamentoModule],
  controllers: [AfastamentosController],
  providers: [AfastamentosService, PrismaService, AuditService],
})
export class AfastamentosModule {}

