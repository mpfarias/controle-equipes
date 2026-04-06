import { Module } from '@nestjs/common';
import { OrionQualidadeController } from './orion-qualidade.controller';
import { OrionQualidadeService } from './orion-qualidade.service';

@Module({
  controllers: [OrionQualidadeController],
  providers: [OrionQualidadeService],
  exports: [OrionQualidadeService],
})
export class OrionQualidadeModule {}
