import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Postgres Int4 upper bound — keep integer columns within range (avoid 500s). */
const INT4_MAX = 2_147_483_647;

export class CreateReferatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  articol: string;

  @IsInt()
  @IsPositive()
  @Max(1_000_000)
  cantitate: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  justificare: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  centruCost: string;

  /** Estimated value in whole lei (integer — never a float). */
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  valoareLei: number;

  /** Routing flag: the referat needs an IT review step. */
  @IsOptional()
  @IsBoolean()
  necesitaIt?: boolean;

  /** Routing flag: the referat needs an SSM (safety) review step. */
  @IsOptional()
  @IsBoolean()
  necesitaSsm?: boolean;
}
