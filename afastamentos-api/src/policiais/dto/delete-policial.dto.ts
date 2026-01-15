import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class DeletePolicialDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  responsavelId?: number;

  @IsString()
  @IsNotEmpty()
  senha: string;
}
