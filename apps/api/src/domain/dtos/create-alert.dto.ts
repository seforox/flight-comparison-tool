import { IsString, IsInt, Min, Max, IsNumber, IsDateString } from 'class-validator';

export class CreateAlertDto {
  @IsString()
  originIata!: string;

  @IsString()
  destinationIata!: string;

  @IsInt()
  @Min(1)
  @Max(7)
  departureDay!: number;

  @IsInt()
  @Min(1)
  @Max(7)
  returnDay!: number;

  @IsNumber()
  @Min(0)
  maxPriceEur!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
