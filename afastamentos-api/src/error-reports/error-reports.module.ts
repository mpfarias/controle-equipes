import { Module } from '@nestjs/common';
import { ErrorReportsService } from './error-reports.service';
import { ErrorReportsController } from './error-reports.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ErrorReportsController],
  providers: [ErrorReportsService, PrismaService],
  exports: [ErrorReportsService],
})
export class ErrorReportsModule {}
