import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Approve: comment is optional. */
export class ApproveDto {
  @IsString()
  @IsNotEmpty()
  actingUserId: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

/** Reject / send-back: comment is required. */
export class CommentRequiredDto {
  @IsString()
  @IsNotEmpty()
  actingUserId: string;

  @IsString()
  @IsNotEmpty()
  comment: string;
}
