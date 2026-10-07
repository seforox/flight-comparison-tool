import { FlightSearchProvider } from '../../domain/interfaces/flight-search.provider';
import { NotificationProvider } from '../../domain/interfaces/notification.provider';

export interface FlightSearchJobPayload {
  alertId: string;
  userId: string;
  telegramChatId: string | null;
  originIata: string;
  destinationIata: string;
  departureDate: string;
  returnDate: string;
  maxPriceEur: number;
}

export class FlightSearchProcessorService {
  constructor(
    private readonly flightSearchProvider: FlightSearchProvider,
    private readonly notificationProvider: NotificationProvider,
    private readonly prismaService: any,
  ) {}

  async processJob(jobData: FlightSearchJobPayload): Promise<void> {
    const results = await this.flightSearchProvider.searchFlights({
      originIata: jobData.originIata,
      destinationIata: jobData.destinationIata,
      departureDate: jobData.departureDate,
      returnDate: jobData.returnDate,
    });

    if (!results || results.length === 0) {
      return;
    }

    const validMatches = results.filter(f => f.foundPriceEur <= jobData.maxPriceEur);

    if (validMatches.length > 0) {
      validMatches.sort((a, b) => a.foundPriceEur - b.foundPriceEur);
      const bestMatch = validMatches[0];

      await this.prismaService.match.create({
        data: {
          alertId: jobData.alertId,
          departureDate: new Date(bestMatch.departureDate),
          returnDate: new Date(bestMatch.returnDate),
          foundPriceEur: bestMatch.foundPriceEur,
          airlineCode: bestMatch.airlineCode,
          bookingUrl: bestMatch.bookingUrl,
        }
      });

      if (jobData.telegramChatId) {
        const message = `¡Vuelo encontrado! ${jobData.originIata} - ${jobData.destinationIata} por solo ${bestMatch.foundPriceEur} EUR.`;
        await this.notificationProvider.sendNotification(jobData.telegramChatId, message);
      }
    }
  }
}
