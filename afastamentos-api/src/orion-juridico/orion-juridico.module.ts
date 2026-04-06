import { Module } from '@nestjs/common';
import { OrionJuridicoController } from './orion-juridico.controller';
import { OrionJuridicoService } from './orion-juridico.service';

@Module({
  controllers: [OrionJuridicoController],
  providers: [OrionJuridicoService],
  exports: [OrionJuridicoService],
})
export class OrionJuridicoModule {}
