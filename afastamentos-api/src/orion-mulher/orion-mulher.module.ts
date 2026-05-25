import { Module } from '@nestjs/common';
import { OrionMulherController } from './orion-mulher.controller';
import { OrionMulherService } from './orion-mulher.service';
import { MulherDashboardService } from './mulher-dashboard.service';
import { MulherExcelImportService } from './mulher-excel-import.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OrionMulherController],
  providers: [OrionMulherService, MulherDashboardService, MulherExcelImportService, PrismaService],
  exports: [OrionMulherService],
})
export class OrionMulherModule {}
