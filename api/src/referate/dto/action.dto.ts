import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// The acting user is no longer part of the payload — it comes from the JWT.

/** Approve: comment is optional. */
export class ApproveDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

/** Reject: comment is required. */
export class CommentRequiredDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comment: string;
}

/**
 * Send-back: comment required + an optional target step. `sendBackTo` is the
 * stepOrder of ANY earlier step to return to; omitted = the previous step.
 */
export class SendBackDto extends CommentRequiredDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  sendBackTo?: number;
}
