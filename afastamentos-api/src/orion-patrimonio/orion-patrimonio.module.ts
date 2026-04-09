import { Module } from '@nestjs/common';
import { OrionPatrimonioController } from './orion-patrimonio.controller';
import { OrionPatrimonioService } from './orion-patrimonio.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OrionPatrimonioController],
  providers: [OrionPatrimonioService, PrismaService],
  exports: [OrionPatrimonioService],
})
export class OrionPatrimonioModule {}
