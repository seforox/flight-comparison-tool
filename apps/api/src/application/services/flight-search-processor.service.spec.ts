import { FlightSearchProcessorService, FlightSearchJobPayload } from './flight-search-processor.service';
import { FlightSearchProvider, FlightSearchResult } from '../../domain/interfaces/flight-search.provider';
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
    };

    processor = new FlightSearchProcessorService(
      mockFlightSearch,
      mockNotification,
      mockPrisma
    );
  });

  describe('processJob', () => {
    it('should create Match and notify if found flight price is <= maxPriceEur', async () => {
      const payload: FlightSearchJobPayload = {
        alertId: 'alert-123',
        userId: 'user-123',
        telegramChatId: 'chat-123',
        originIata: 'MAD',
        destinationIata: 'LON',
        departureDate: '2026-11-01',
        returnDate: '2026-11-04',
        maxPriceEur: 100, // Umbral de 100 EUR
      };

      const searchResult: FlightSearchResult[] = [
        {
          departureDate: '2026-11-01',
          returnDate: '2026-11-04',
          foundPriceEur: 80, // Por debajo del umbral!
          airlineCode: 'IB',
          bookingUrl: 'http://book.com'
        }
      ];

      mockFlightSearch.searchFlights.mockResolvedValue(searchResult);

      await processor.processJob(payload);

      expect(mockFlightSearch.searchFlights).toHaveBeenCalledWith({
        originIata: 'MAD',
        destinationIata: 'LON',
        departureDate: '2026-11-01',
        returnDate: '2026-11-04',
      });

      expect(mockPrisma.match.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          alertId: 'alert-123',
          foundPriceEur: 80,
          airlineCode: 'IB'
        })
      });

      expect(mockNotification.sendNotification).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('80')
      );
    });

    it('EDGE CASE: Should NOT create Match or notify if flight price > maxPriceEur', async () => {
      const payload: FlightSearchJobPayload = {
        alertId: 'alert-123',
        userId: 'user-123',
        telegramChatId: 'chat-123',
        originIata: 'MAD',
        destinationIata: 'LON',
        departureDate: '2026-11-01',
        returnDate: '2026-11-04',
        maxPriceEur: 50, // Umbral de 50 EUR
      };

      const searchResult: FlightSearchResult[] = [
        {
          departureDate: '2026-11-01',
          returnDate: '2026-11-04',
          foundPriceEur: 80, // Por encima del umbral!
          airlineCode: 'IB',
          bookingUrl: 'http://book.com'
        }
      ];

      mockFlightSearch.searchFlights.mockResolvedValue(searchResult);

      await processor.processJob(payload);

      expect(mockPrisma.match.create).not.toHaveBeenCalled();
      expect(mockNotification.sendNotification).not.toHaveBeenCalled();
    });

    it('EDGE CASE: Should create Match but NOT notify if telegramChatId is null', async () => {
      const payload: FlightSearchJobPayload = {
        alertId: 'alert-123',
        userId: 'user-123',
        telegramChatId: null, // Sin Telegram
        originIata: 'MAD',
        destinationIata: 'LON',
        departureDate: '2026-11-01',
        returnDate: '2026-11-04',
        maxPriceEur: 100,
      };

      const searchResult: FlightSearchResult[] = [
        {
          departureDate: '2026-11-01',
          returnDate: '2026-11-04',
          foundPriceEur: 80,
          airlineCode: 'IB',
          bookingUrl: 'http://book.com'
        }
      ];

      mockFlightSearch.searchFlights.mockResolvedValue(searchResult);

      await processor.processJob(payload);

      expect(mockPrisma.match.create).toHaveBeenCalled(); // DB sí
      expect(mockNotification.sendNotification).not.toHaveBeenCalled(); // Notificación no
    });
  });
});
