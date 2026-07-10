import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateReferatDto {
  @IsString()
  @IsNotEmpty()
  articol: string;

  @IsInt()
  @IsPositive()
  cantitate: number;

  @IsString()
  @IsNotEmpty()
  justificare: string;

  @IsString()
  @IsNotEmpty()
  centruCost: string;

  /** Estimated value in whole lei (integer — never a float). */
  @IsInt()
  @Min(0)
  valoareLei: number;

  /** Routing flag: the referat needs an IT review step. */
  @IsOptional()
  @IsBoolean()
  necesitaIt?: boolean;

  /** Routing flag: the referat needs an SSM (safety) review step. */
  @IsOptional()
  @IsBoolean()
  necesitaSsm?: boolean;

  /** Faked auth: the requester id is supplied by the client. */
  @IsString()
  @IsNotEmpty()
  requesterId: string;
}
