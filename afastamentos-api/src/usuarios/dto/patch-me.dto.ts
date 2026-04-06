import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Atualização do próprio cadastro (apenas campos permitidos ao usuário autenticado). */
export class PatchMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(10_000_000)
  fotoUrl?: string;
}
