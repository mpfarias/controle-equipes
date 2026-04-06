import { IsEnum } from 'class-validator';
import { ErrorReportStatus } from '@prisma/client';

export class UpdateErrorReportStatusDto {
  @IsEnum(ErrorReportStatus)
  status: ErrorReportStatus;
}
