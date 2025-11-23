import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9xX]+$/, {
    message: 'A matrícula deve conter apenas números ou o X.',
  })
  matricula: string;
}

