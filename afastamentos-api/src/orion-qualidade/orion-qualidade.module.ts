import { Module } from '@nestjs/common';
import { IntegraSspPoolService } from './integra-ssp-pool.service';
import { OrionQualidadeController } from './orion-qualidade.controller';
import { OrionQualidadeService } from './orion-qualidade.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OrionQualidadeController],
  providers: [IntegraSspPoolService, OrionQualidadeService, PrismaService],
  exports: [OrionQualidadeService],
})
export class OrionQualidadeModule {}
