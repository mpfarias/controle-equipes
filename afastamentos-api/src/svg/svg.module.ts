import { Module } from '@nestjs/common';
import { SvgController } from './svg.controller';
import { SvgService } from './svg.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SvgController],
  providers: [SvgService, PrismaService],
  exports: [SvgService],
})
export class SvgModule {}
