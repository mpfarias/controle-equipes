import { Module } from '@nestjs/common';
import { OrionAgendaController } from './orion-agenda.controller';
import { OrionAgendaService } from './orion-agenda.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OrionAgendaController],
  providers: [OrionAgendaService, PrismaService],
  exports: [OrionAgendaService],
})
export class OrionAgendaModule {}
