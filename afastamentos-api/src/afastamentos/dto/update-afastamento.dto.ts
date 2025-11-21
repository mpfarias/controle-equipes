import { PartialType } from '@nestjs/mapped-types';
import { CreateAfastamentoDto } from './create-afastamento.dto';

export class UpdateAfastamentoDto extends PartialType(CreateAfastamentoDto) {}

