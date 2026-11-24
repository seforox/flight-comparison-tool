import {
  IsString,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsDateString,
  IsOptional,
  IsBoolean,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { FlightDateCalculatorService } from '../services/flight-date-calculator.service';

export interface AlertSearchValidationInput {
  originIata?: string;
  destinationIata?: string;
  departureDay?: number;
  returnDay?: number;
  startDate?: string | Date;
  endDate?: string | Date;
}

export function extractUtcDateKey(value?: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parsed = new Date(`${str}T00:00:00.000Z`);
    if (!isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === str) {
      return str;
    }
    return null;
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function getTodayUtcDateKey(referenceDate: Date = new Date()): string {
  return referenceDate.toISOString().slice(0, 10);
}

const dateCalculator = new FlightDateCalculatorService();

export function validateAlertSearchRules(
  input: AlertSearchValidationInput,
  referenceDate: Date = new Date(),
): string[] {
  const errors: string[] = [];

  const origin = (input.originIata || '').trim().toUpperCase();
  const destination = (input.destinationIata || '').trim().toUpperCase();
  if (origin && destination && origin === destination) {
    errors.push('El aeropuerto de origen y el de destino no pueden ser el mismo.');
  }

  const todayKey = getTodayUtcDateKey(referenceDate);

  if (input.startDate !== undefined && input.endDate !== undefined) {
    const startKey = extractUtcDateKey(input.startDate);
    const endKey = extractUtcDateKey(input.endDate);

    if (!startKey || !endKey) {
      errors.push('Las fechas de inicio y fin deben ser válidas.');
    } else {
      if (startKey < todayKey) {
        errors.push('La fecha de salida (desde) no puede ser anterior al día actual.');
      }

      if (startKey > endKey) {
        errors.push('La fecha de inicio no puede ser posterior a la fecha de fin.');
      } else if (startKey === endKey) {
        errors.push(
          'No se permiten búsquedas de ida y vuelta en el mismo día. La fecha de regreso (hasta) debe ser posterior a la fecha de salida (desde).',
        );
      } else if (
        input.departureDay !== undefined &&
        input.returnDay !== undefined &&
        input.departureDay >= 1 &&
        input.departureDay <= 7 &&
        input.returnDay >= 1 &&
        input.returnDay <= 7
      ) {
        const tuples = dateCalculator.generateDateTuples(
          new Date(`${startKey}T00:00:00.000Z`),
          new Date(`${endKey}T23:59:59.999Z`),
          input.departureDay,
          input.returnDay,
        );
        if (tuples.length === 0) {
          errors.push(
            'No hay ninguna combinación válida de ida y vuelta para los días seleccionados dentro de ese rango de fechas (la vuelta debe ser un día posterior dentro del rango).',
          );
        }
      }
    }
  } else if (input.startDate !== undefined) {
    const startKey = extractUtcDateKey(input.startDate);
    if (!startKey) {
      errors.push('La fecha de salida debe ser válida.');
    } else if (startKey < todayKey) {
      errors.push('La fecha de salida (desde) no puede ser anterior al día actual.');
    }
  }

  return errors;
}

@ValidatorConstraint({ name: 'DifferentAirports', async: false })
class DifferentAirportsConstraint implements ValidatorConstraintInterface {
  validate(destinationIata: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateAlertDto;
    const origin = typeof dto.originIata === 'string' ? dto.originIata.trim().toUpperCase() : '';
    const dest = typeof destinationIata === 'string' ? destinationIata.trim().toUpperCase() : '';
    if (!origin || !dest) return true;
    return origin !== dest;
  }

  defaultMessage(): string {
    return 'El aeropuerto de origen y el de destino no pueden ser el mismo.';
  }
}

@ValidatorConstraint({ name: 'ValidAlertDateRange', async: false })
class ValidAlertDateRangeConstraint implements ValidatorConstraintInterface {
  validate(_endDate: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateAlertDto;
    const errors = validateAlertSearchRules({
      departureDay: dto.departureDay,
      returnDay: dto.returnDay,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
    return errors.length === 0;
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as CreateAlertDto;
    const errors = validateAlertSearchRules({
      departureDay: dto.departureDay,
      returnDay: dto.returnDay,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
    return (
      errors.join(' ') ||
      'No se permiten búsquedas de ida y vuelta en el mismo día. La fecha de regreso (hasta) debe ser posterior a la fecha de salida (desde).'
    );
  }
}

export class CreateAlertDto {
  @IsString()
  originIata!: string;

  @IsString()
  @Validate(DifferentAirportsConstraint)
  destinationIata!: string;

  @IsInt()
  @Min(1)
  @Max(7)
  departureDay!: number;

  @IsInt()
  @Min(1)
  @Max(7)
  returnDay!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  adults?: number;

  @IsOptional()
  @IsBoolean()
  directOnly?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPriceEur?: number | null;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  @Validate(ValidAlertDateRangeConstraint)
  endDate!: string;
}
