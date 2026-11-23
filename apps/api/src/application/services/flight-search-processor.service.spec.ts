import { FlightSearchProcessorService, FlightSearchJobPayload } from './flight-search-processor.service';
import { FlightSearchProvider } from '../../domain/interfaces/flight-search.provider';
import { NotificationProvider } from '../../domain/interfaces/notification.provider';

describe('FlightSearchProcessorService', () => {
  let processor: FlightSearchProcessorService;
  let mockFlightSearch: jest.Mocked<FlightSearchProvider>;
  let mockNotification: jest.Mocked<NotificationProvider>;
  let mockPrisma: any;

  beforeEach(() => {
    mockFlightSearch = {
      searchFlights: jest.fn(),
    };

    mockNotification = {
      sendNotification: jest.fn(),
    };

    mockPrisma = {
      match: {
        create: jest.fn(),
      },
      alert: {
        update: jest.fn(),
      },
    };

    processor = new FlightSearchProcessorService(
      mockFlightSearch,
      mockNotification,
      mockPrisma
    );
  });

  describe('processJob', () => {
    it('should evaluate multiple date tuples, create Matches and send a SINGLE aggregated Telegram message with dates and airlines', async () => {
      const payload: FlightSearchJobPayload = {
        alertId: 'alert-123',
        userId: 'user-123',
        telegramChatId: 'chat-123',
        originIata: 'MAD',
        destinationIata: 'LON',
        adults: 2,
        maxPriceEur: 100,
        dateTuples: [
          { departureDate: '2026-11-02', returnDate: '2026-11-04' },
          { departureDate: '2026-11-09', returnDate: '2026-11-11' },
        ],
      };

      mockFlightSearch.searchFlights
        .mockResolvedValueOnce([
          {
            departureDate: '2026-11-02',
            returnDate: '2026-11-04',
            foundPriceEur: 45.5,
            airlineCode: 'Ryanair',
            isDirect: true,
            stopsCount: 0,
            departureTime: '08:30',
            durationMinutes: 150,
            bookingUrl: 'http://book.com/1',
          },
        ])
        .mockResolvedValueOnce([
          {
            departureDate: '2026-11-09',
            returnDate: '2026-11-11',
            foundPriceEur: 80,
            airlineCode: 'Iberia',
            isDirect: false,
            stopsCount: 1,
            departureTime: '14:15',
            durationMinutes: 310,
            bookingUrl: 'http://book.com/2',
          },
        ]);

      await processor.processJob(payload);

      expect(mockFlightSearch.searchFlights).toHaveBeenCalledTimes(2);
      expect(mockPrisma.match.create).toHaveBeenCalledTimes(2);

      // Debe enviar UN SOLO mensaje con ambas fechas, aerolíneas, escalas, hora, duración y enlaces
      expect(mockNotification.sendNotification).toHaveBeenCalledTimes(1);
      const sentMessage = mockNotification.sendNotification.mock.calls[0][1];
      expect(sentMessage).toContain('2 pasajeros');
      expect(sentMessage).toContain('2026-11-02');
      expect(sentMessage).toContain('2026-11-04');
      expect(sentMessage).toContain('Ryanair');
      expect(sentMessage).toContain('Directo');
      expect(sentMessage).toContain('08:30');
      expect(sentMessage).toContain('2h 30m');
      expect(sentMessage).toContain('45.5');
      expect(sentMessage).toContain('http://book.com/1');
      expect(sentMessage).toContain('2026-11-09');
      expect(sentMessage).toContain('2026-11-11');
      expect(sentMessage).toContain('Iberia');
      expect(sentMessage).toContain('Con escala (1)');
      expect(sentMessage).toContain('14:15');
      expect(sentMessage).toContain('5h 10m');
      expect(sentMessage).toContain('80');
      expect(sentMessage).toContain('http://book.com/2');

      // Y debe cambiar el estado de la alerta a TRIGGERED al terminar el recorrido
      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-123' },
        data: { status: 'TRIGGERED' },
      });
    });

    it('EDGE CASE: Should NOT create Match or notify if flight price > maxPriceEur', async () => {
      const payload: FlightSearchJobPayload = {
        alertId: 'alert-123',
        userId: 'user-123',
        telegramChatId: 'chat-123',
        originIata: 'MAD',
        destinationIata: 'LON',
        maxPriceEur: 50,
        dateTuples: [
          { departureDate: '2026-11-01', returnDate: '2026-11-04' },
        ],
      };

      mockFlightSearch.searchFlights.mockResolvedValue([
        {
          departureDate: '2026-11-01',
          returnDate: '2026-11-04',
          foundPriceEur: 80,
          airlineCode: 'IB',
          bookingUrl: 'http://book.com',
        },
      ]);

      await processor.processJob(payload);

      expect(mockPrisma.match.create).not.toHaveBeenCalled();
      expect(mockNotification.sendNotification).not.toHaveBeenCalled();
      expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    });

    it('EDGE CASE: Should create Match but NOT notify if telegramChatId is null', async () => {
      const payload: FlightSearchJobPayload = {
        alertId: 'alert-123',
        userId: 'user-123',
        telegramChatId: null,
        originIata: 'MAD',
        destinationIata: 'LON',
        maxPriceEur: 100,
        dateTuples: [
          { departureDate: '2026-11-01', returnDate: '2026-11-04' },
        ],
      };

      mockFlightSearch.searchFlights.mockResolvedValue([
        {
          departureDate: '2026-11-01',
          returnDate: '2026-11-04',
          foundPriceEur: 80,
          airlineCode: 'IB',
          bookingUrl: 'http://book.com',
        },
      ]);

      await processor.processJob(payload);

      expect(mockPrisma.match.create).toHaveBeenCalled();
      expect(mockNotification.sendNotification).not.toHaveBeenCalled();
    });

    it('EDGE CASE: Should skip processing if alert is no longer ACTIVE when job starts', async () => {
      mockPrisma.alert.findUnique = jest.fn().mockResolvedValue({ status: 'TRIGGERED' });

      const payload: FlightSearchJobPayload = {
        alertId: 'alert-123',
        userId: 'user-123',
        telegramChatId: 'chat-123',
        originIata: 'MAD',
        destinationIata: 'LON',
        maxPriceEur: 100,
        dateTuples: [
          { departureDate: '2026-11-01', returnDate: '2026-11-04' },
        ],
      };

      await processor.processJob(payload);

      expect(mockFlightSearch.searchFlights).not.toHaveBeenCalled();
      expect(mockPrisma.match.create).not.toHaveBeenCalled();
      expect(mockNotification.sendNotification).not.toHaveBeenCalled();
    });

    it('EDGE CASE: Should STILL mark alert as TRIGGERED and notify if later date tuple fails (e.g. HTTP 429) after finding at least one flight', async () => {
      const payload: FlightSearchJobPayload = {
        alertId: 'alert-tokio',
        userId: 'user-123',
        telegramChatId: 'chat-123',
        originIata: 'MAD',
        destinationIata: 'NRT',
        adults: 3,
        maxPriceEur: 3000,
        dateTuples: [
          { departureDate: '2026-10-02', returnDate: '2026-10-05' },
          { departureDate: '2026-10-09', returnDate: '2026-10-12' },
          { departureDate: '2026-10-16', returnDate: '2026-10-19' },
          { departureDate: '2026-10-23', returnDate: '2026-10-26' },
        ],
      };

      mockFlightSearch.searchFlights
        .mockResolvedValueOnce([
          {
            departureDate: '2026-10-02',
            returnDate: '2026-10-05',
            foundPriceEur: 2814,
            airlineCode: 'JAL',
            isDirect: false,
            stopsCount: 1,
            bookingUrl: 'http://book.com/t1',
          },
        ])
        .mockResolvedValueOnce([
          {
            departureDate: '2026-10-09',
            returnDate: '2026-10-12',
            foundPriceEur: 2814,
            airlineCode: 'JAL',
            isDirect: false,
            stopsCount: 1,
            bookingUrl: 'http://book.com/t2',
          },
        ])
        .mockRejectedValueOnce(new Error('HTTP 429 Too Many Requests'));

      await processor.processJob(payload);

      // Debe haberse detenido tras el 429 (3 llamadas, no 4)
      expect(mockFlightSearch.searchFlights).toHaveBeenCalledTimes(3);
      expect(mockPrisma.match.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-tokio' },
        data: { status: 'TRIGGERED' },
      });
      expect(mockNotification.sendNotification).toHaveBeenCalledTimes(1);
    });

    it('EDGE CASE: Should STILL keep alert as TRIGGERED even if Telegram notification throws an error', async () => {
      const payload: FlightSearchJobPayload = {
        alertId: 'alert-tg-fail',
        userId: 'user-123',
        telegramChatId: 'bad-chat',
        originIata: 'MAD',
        destinationIata: 'LON',
        maxPriceEur: 200,
        dateTuples: [
          { departureDate: '2026-11-02', returnDate: '2026-11-04' },
        ],
      };

      mockFlightSearch.searchFlights.mockResolvedValueOnce([
        {
          departureDate: '2026-11-02',
          returnDate: '2026-11-04',
          foundPriceEur: 114,
          airlineCode: 'Ryanair',
          isDirect: true,
          stopsCount: 0,
          bookingUrl: 'http://book.com/lon',
        },
      ]);
      mockNotification.sendNotification.mockRejectedValueOnce(new Error('400: Bad Request: chat not found'));

      await expect(processor.processJob(payload)).resolves.toBeUndefined();

      expect(mockPrisma.match.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-tg-fail' },
        data: { status: 'TRIGGERED' },
      });
    });
  });
});
