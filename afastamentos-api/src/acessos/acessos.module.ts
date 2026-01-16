import { Module } from '@nestjs/common';
import { AcessosService } from './acessos.service';
import { AcessosController } from './acessos.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AcessosController],
  providers: [AcessosService, PrismaService],
  exports: [AcessosService],
})
export class AcessosModule {}
