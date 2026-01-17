import { PartialType } from '@nestjs/mapped-types';
import { CreateRestricaoAfastamentoDto } from './create-restricao-afastamento.dto';

export class UpdateRestricaoAfastamentoDto extends PartialType(CreateRestricaoAfastamentoDto) {}
