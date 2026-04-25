import { Module } from '@nestjs/common';
import { OrionOperacoesController } from './orion-operacoes.controller';
import { OrionOperacoesService } from './orion-operacoes.service';

@Module({
  controllers: [OrionOperacoesController],
  providers: [OrionOperacoesService],
  exports: [OrionOperacoesService],
})
export class OrionOperacoesModule {}
