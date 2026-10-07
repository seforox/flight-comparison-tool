import { FlightDateCalculatorService } from './flight-date-calculator.service';

describe('FlightDateCalculatorService', () => {
  let service: FlightDateCalculatorService;

  beforeEach(() => {
    service = new FlightDateCalculatorService();
  });

  describe('generateDateTuples', () => {
    it('should return valid departure and return date pairs within the given range', () => {
      const startDate = new Date('2026-11-01T00:00:00Z');
      const endDate = new Date('2026-11-15T23:59:59Z');
      const departureDay = 1;
      const returnDay = 3;

      const tuples = service.generateDateTuples(startDate, endDate, departureDay, returnDay);

      expect(tuples).toHaveLength(2);
      expect(tuples[0].departureDate).toEqual(new Date('2026-11-02T00:00:00Z'));
      expect(tuples[0].returnDate).toEqual(new Date('2026-11-04T00:00:00Z'));
      expect(tuples[1].departureDate).toEqual(new Date('2026-11-09T00:00:00Z'));
      expect(tuples[1].returnDate).toEqual(new Date('2026-11-11T00:00:00Z'));
    });

    it('EDGE CASE: Años bisiestos y rangos temporales que cruzan el cambio de año', () => {
      const startDate = new Date('2024-02-28T00:00:00Z');
      const endDate = new Date('2024-03-05T23:59:59Z');
      const tuples = service.generateDateTuples(startDate, endDate, 4, 7);

      expect(tuples).toHaveLength(1);
      expect(tuples[0].departureDate).toEqual(new Date('2024-02-29T00:00:00Z'));
      expect(tuples[0].returnDate).toEqual(new Date('2024-03-03T00:00:00Z'));
    });

    it('EDGE CASE: Rangos donde la fecha de vuelta sea anterior o igual a la de ida', () => {
      const startDate = new Date('2026-11-01T00:00:00Z'); // Domingo
      const endDate = new Date('2026-11-09T23:59:59Z'); // Lunes
      
      // Salida domingo (7), vuelta lunes (1)
      const tuples = service.generateDateTuples(startDate, endDate, 7, 1);

      expect(tuples).toHaveLength(2);
      expect(tuples[0].departureDate).toEqual(new Date('2026-11-01T00:00:00Z'));
      expect(tuples[0].returnDate).toEqual(new Date('2026-11-02T00:00:00Z'));
      
      expect(tuples[1].departureDate).toEqual(new Date('2026-11-08T00:00:00Z'));
      expect(tuples[1].returnDate).toEqual(new Date('2026-11-09T00:00:00Z'));
    });
  });
});
