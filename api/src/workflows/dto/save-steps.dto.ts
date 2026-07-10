import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Role } from '@prisma/client';

/** One step in a PUT /workflows/:id/steps payload. */
export class WorkflowStepInput {
  @IsInt()
  @Min(1)
  order: number;

  @IsEnum(Role)
  role: Role;

  @IsString()
  @IsNotEmpty()
  label: string;

  /**
   * JSON routing condition (null / omitted = always applies). Not deeply
   * validated here — the engine (config/condition.ts) evaluates it defensively.
   */
  @IsOptional()
  appliesWhen?: unknown;
}

/** Replace the entire ordered step list of a workflow in one request. */
export class SaveStepsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepInput)
  steps: WorkflowStepInput[];
}
