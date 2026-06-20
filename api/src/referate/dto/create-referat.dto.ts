import {
  IsInt,
  IsNotEmpty,
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

  /** Faked auth: the requester id is supplied by the client. */
  @IsString()
  @IsNotEmpty()
  requesterId: string;
}
