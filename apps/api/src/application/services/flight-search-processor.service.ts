import { FlightSearchProvider, FlightSearchResult } from '../../domain/interfaces/flight-search.provider';
import { NotificationProvider } from '../../domain/interfaces/notification.provider';

export interface FlightDateTuplePayload {
  departureDate: string;
  returnDate: string;
}

export interface FlightSearchJobPayload {
  alertId: string;
  userId: string;
  telegramChatId: string | null;
  originIata: string;
  destinationIata: string;
  maxPriceEur: number;
  dateTuples: FlightDateTuplePayload[];
}

export class FlightSearchProcessorService {
  constructor(
    private readonly flightSearchProvider: FlightSearchProvider,
    private readonly notificationProvider: NotificationProvider,
    private readonly prismaService: any,
  ) {}

  async processJob(jobData: FlightSearchJobPayload): Promise<void> {
    if (this.prismaService.alert?.findUnique) {
      const currentAlert = await this.prismaService.alert.findUnique({
        where: { id: jobData.alertId },
        select: { status: true },
      });
      if (currentAlert && currentAlert.status !== 'ACTIVE') {
        return;
      }
    }

    const foundDeals: FlightSearchResult[] = [];

    for (const tuple of jobData.dateTuples) {
      const results = await this.flightSearchProvider.searchFlights({
        originIata: jobData.originIata,
        destinationIata: jobData.destinationIata,
        departureDate: tuple.departureDate,
        returnDate: tuple.returnDate,
      });

      if (!results || results.length === 0) {
        continue;
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
          },
        });

        foundDeals.push(bestMatch);
      }
    }

    if (foundDeals.length > 0) {
      if (jobData.telegramChatId) {
        const lines = foundDeals.map(deal => {
          const airline = deal.airlineCode || 'Desconocida';
          return `📅 ${deal.departureDate} ➔ ${deal.returnDate}\n💰 ${deal.foundPriceEur} EUR | 🏢 Aerolínea: ${airline}`;
        });

        const message = [
          `✈️ ¡Vuelos encontrados para ${jobData.originIata} ➔ ${jobData.destinationIata}! (Máx: ${jobData.maxPriceEur} EUR)`,
          '',
          ...lines.join('\n\n').split('\n'),
        ].join('\n');

        await this.notificationProvider.sendNotification(jobData.telegramChatId, message);
      }

      // Solo pasar a TRIGGERED si se ha encontrado al menos un resultado válido
      await this.prismaService.alert.update({
        where: { id: jobData.alertId },
        data: { status: 'TRIGGERED' },
      });
    }
  }
}
