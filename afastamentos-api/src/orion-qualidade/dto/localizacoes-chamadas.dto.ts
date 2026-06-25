import { IsArray, ArrayMaxSize, ArrayMinSize, IsInt, Min } from 'class-validator';

export class LocalizacoesChamadasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
