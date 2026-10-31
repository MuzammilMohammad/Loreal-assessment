import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class AssessClaimDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  claimId?: string;

  @ValidateIf((request: AssessClaimDto) => !request.claimId)
  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  claimText!: string;

  @ValidateIf((request: AssessClaimDto) => !request.claimId)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  productName!: string;

  @IsString()
  @MinLength(30)
  @MaxLength(30000)
  evidence!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  population?: string;
}
