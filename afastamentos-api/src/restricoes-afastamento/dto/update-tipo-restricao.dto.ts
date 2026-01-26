import { PartialType } from '@nestjs/mapped-types';
import { CreateTipoRestricaoDto } from './create-tipo-restricao.dto';

export class UpdateTipoRestricaoDto extends PartialType(CreateTipoRestricaoDto) {}
