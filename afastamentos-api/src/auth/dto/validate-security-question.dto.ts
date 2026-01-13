import { IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';

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
  @MinLength(8, {
    message: 'A senha deve ter pelo menos 8 caracteres.',
  })
  @MaxLength(100, {
    message: 'A senha não pode ter mais de 100 caracteres.',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'A senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número.',
  })
  novaSenha: string;
}

