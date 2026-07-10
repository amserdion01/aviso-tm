import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// The acting user is no longer part of the payload — it comes from the JWT.

/** Approve: comment is optional. */
export class ApproveDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

/** Reject / send-back: comment is required. */
export class CommentRequiredDto {
  @IsString()
  @IsNotEmpty()
  comment: string;
}
