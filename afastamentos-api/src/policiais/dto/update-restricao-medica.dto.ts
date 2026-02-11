import { PartialType } from '@nestjs/mapped-types';
import { CreateRestricaoMedicaDto } from './create-restricao-medica.dto';

export class UpdateRestricaoMedicaDto extends PartialType(CreateRestricaoMedicaDto) {}

