import { Module } from '@nestjs/common';
import { OrionAssessoriaController } from './orion-assessoria.controller';
import { OrionAssessoriaService } from './orion-assessoria.service';

@Module({
  controllers: [OrionAssessoriaController],
  providers: [OrionAssessoriaService],
  exports: [OrionAssessoriaService],
})
export class OrionAssessoriaModule {}
