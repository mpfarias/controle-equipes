import { Module } from '@nestjs/common';
import { EscalasService } from './escalas.service';
import { EscalasController } from './escalas.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [EscalasController],
  providers: [EscalasService, PrismaService],
  exports: [EscalasService],
})
export class EscalasModule {}
