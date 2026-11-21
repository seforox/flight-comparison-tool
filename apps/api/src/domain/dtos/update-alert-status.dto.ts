import { IsIn } from 'class-validator';

export class UpdateAlertStatusDto {
  @IsIn(['ACTIVE', 'PAUSED', 'TRIGGERED', 'COMPLETED'])
  status!: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'COMPLETED';
}
