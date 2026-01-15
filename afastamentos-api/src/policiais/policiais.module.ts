import { Module } from '@nestjs/common';
import { PoliciaisService } from './policiais.service';
import { PoliciaisController } from './policiais.controller';
import { ArquivoProcessorService } from './arquivo-processor.service';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [PoliciaisController],
  providers: [PoliciaisService, ArquivoProcessorService, PrismaService, AuditService],
  exports: [PoliciaisService],
})
export class PoliciaisModule {}
