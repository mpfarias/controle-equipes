import { Module } from '@nestjs/common';
import { ErrosService } from './erros.service';
import { ErrosController } from './erros.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ErrosController],
  providers: [ErrosService, PrismaService],
  exports: [ErrosService],
})
export class ErrosModule {}
