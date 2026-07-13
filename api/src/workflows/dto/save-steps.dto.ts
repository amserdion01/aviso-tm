import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Role } from '@prisma/client';
import { isCondition } from '../../config/condition';

/** Rejects a malformed `appliesWhen` at the boundary (null is allowed). */
@ValidatorConstraint({ name: 'isCondition', async: false })
export class IsConditionConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isCondition(value);
  }
  defaultMessage(): string {
    return 'Condiția de aplicare (appliesWhen) are un format invalid.';
  }
}

/** One step in a PUT /workflows/:id/steps payload. */
export class WorkflowStepInput {
  @IsInt()
  @Min(1)
  order: number;

  @IsEnum(Role)
  role: Role;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label: string;

  /**
   * JSON routing condition (null / omitted = always applies). Structurally
   * validated here (see config/condition.ts → isCondition) so a malformed
   * condition is a 400 up front, never a 500 on later referat creation.
   */
  @Validate(IsConditionConstraint)
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
