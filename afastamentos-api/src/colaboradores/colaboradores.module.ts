import { Module } from '@nestjs/common';
import { ColaboradoresService } from './colaboradores.service';
import { ColaboradoresController } from './colaboradores.controller';
import { ArquivoProcessorService } from './arquivo-processor.service';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [ColaboradoresController],
  providers: [ColaboradoresService, ArquivoProcessorService, PrismaService, AuditService],
  exports: [ColaboradoresService],
})
export class ColaboradoresModule {}

