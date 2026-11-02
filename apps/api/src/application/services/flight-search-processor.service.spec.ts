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
            airlineCode: 'FR',
            bookingUrl: 'http://book.com/1',
          },
        ])
        .mockResolvedValueOnce([
          {
            departureDate: '2026-11-09',
            returnDate: '2026-11-11',
            foundPriceEur: 80,
            airlineCode: 'IB',
            bookingUrl: 'http://book.com/2',
          },
        ]);

      await processor.processJob(payload);

      expect(mockFlightSearch.searchFlights).toHaveBeenCalledTimes(2);
      expect(mockPrisma.match.create).toHaveBeenCalledTimes(2);

      // Debe enviar UN SOLO mensaje con ambas fechas y aerolíneas
      expect(mockNotification.sendNotification).toHaveBeenCalledTimes(1);
      const sentMessage = mockNotification.sendNotification.mock.calls[0][1];
      expect(sentMessage).toContain('2026-11-02');
      expect(sentMessage).toContain('2026-11-04');
      expect(sentMessage).toContain('FR');
      expect(sentMessage).toContain('45.5');
      expect(sentMessage).toContain('2026-11-09');
      expect(sentMessage).toContain('2026-11-11');
      expect(sentMessage).toContain('IB');
      expect(sentMessage).toContain('80');

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
  });
});
