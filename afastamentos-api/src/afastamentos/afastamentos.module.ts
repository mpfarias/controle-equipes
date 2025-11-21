import { Module } from '@nestjs/common';
import { AfastamentosService } from './afastamentos.service';
import { AfastamentosController } from './afastamentos.controller';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [AfastamentosController],
  providers: [AfastamentosService, PrismaService, AuditService],
})
export class AfastamentosModule {}

