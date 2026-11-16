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
  adults?: number;
  directOnly?: boolean;
  maxPriceEur: number;
  dateTuples: FlightDateTuplePayload[];
}

export class FlightSearchProcessorService {
  constructor(
    private readonly flightSearchProvider: FlightSearchProvider,
    private readonly notificationProvider: NotificationProvider,
    private readonly prismaService: any,
  ) {}

  private formatDuration(minutes?: number | null): string {
    if (!minutes || minutes <= 0) return 'N/D';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

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
    const adults = jobData.adults ?? 1;

    for (const tuple of jobData.dateTuples) {
      const results = await this.flightSearchProvider.searchFlights({
        originIata: jobData.originIata,
        destinationIata: jobData.destinationIata,
        departureDate: tuple.departureDate,
        returnDate: tuple.returnDate,
        adults,
        ...(jobData.directOnly !== undefined ? { directOnly: jobData.directOnly } : {}),
      });

      if (!results || results.length === 0) {
        continue;
      }

      const validMatches = results.filter(f => {
        if (f.foundPriceEur > jobData.maxPriceEur) return false;
        if (jobData.directOnly && f.isDirect === false) return false;
        return true;
      });

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
          const stopInfo = deal.isDirect === false
            ? `Con escala (${deal.stopsCount || 1})`
            : 'Directo';
          const depTimeInfo = deal.departureTime ? ` | 🕒 Salida: ${deal.departureTime}` : '';
          const durationInfo = deal.durationMinutes
            ? ` | ⏱️ Duración: ~${this.formatDuration(deal.durationMinutes)}`
            : '';
          const bookingLine = deal.bookingUrl ? `\n🔗 ${deal.bookingUrl}` : '';

          return [
            `📅 ${deal.departureDate} ➔ ${deal.returnDate}`,
            `💰 ${deal.foundPriceEur} EUR | 🏢 Aerolínea: ${airline}`,
            `✈️ ${stopInfo}${depTimeInfo}${durationInfo}${bookingLine}`,
          ].join('\n');
        });

        const paxLabel = adults === 1 ? '1 pasajero' : `${adults} pasajeros`;
        const message = [
          `✈️ ¡Vuelos encontrados para ${jobData.originIata} ➔ ${jobData.destinationIata}! (${paxLabel} | Máx: ${jobData.maxPriceEur} EUR)`,
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
