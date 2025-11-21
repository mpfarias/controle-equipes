import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[0-9xX]+$/, {
    message: 'A matrícula deve conter apenas números ou X.',
  })
  matricula: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  senha: string;
}
