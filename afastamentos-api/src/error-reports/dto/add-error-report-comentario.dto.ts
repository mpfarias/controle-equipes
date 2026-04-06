import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddErrorReportComentarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  texto: string;
}
