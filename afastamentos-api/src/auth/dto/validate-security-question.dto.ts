import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class ValidateSecurityQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  matricula: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  respostaSeguranca: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, {
    message: 'A senha deve ter pelo menos 6 caracteres.',
  })
  @MaxLength(100, {
    message: 'A senha não pode ter mais de 100 caracteres.',
  })
  novaSenha: string;
}

