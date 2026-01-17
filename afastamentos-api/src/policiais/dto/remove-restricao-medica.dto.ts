import { IsString, IsNotEmpty } from 'class-validator';

export class RemoveRestricaoMedicaDto {
  @IsString()
  @IsNotEmpty()
  senha: string;
}
