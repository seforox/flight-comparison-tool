import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { FlightSearchProvider, FlightSearchQuery, FlightSearchResult } from '../../domain/interfaces/flight-search.provider';
import { IGNAV_MOCKS } from './mocks/ignav.mocks';

@Injectable()
export class IgnavAdapter implements FlightSearchProvider {
  private readonly logger = new Logger(IgnavAdapter.name);
  private readonly apiUrl = 'https://ignav.com/api/fares/round-trip';

  async searchFlights(query: FlightSearchQuery): Promise<FlightSearchResult[]> {
    const useMock = process.env.USE_IGNAV_MOCK !== 'false';
    const adults = query.adults ?? 1;

    if (useMock) {
      const prefix = process.env.USE_IGNAV_MOCK === 'true' ? '[TEST MODE] ' : '';
      this.logger.log(`${prefix}Buscando vuelos simulados en el comparador de vuelos para ${query.originIata} -> ${query.destinationIata} (${query.departureDate} a ${query.returnDate}, ${adults} pax)`);
      return this.getMockedResponse(query);
    }

    this.logger.log(`Ejecutando llamada al comparador de vuelos para ${query.originIata} -> ${query.destinationIata} (${query.departureDate} a ${query.returnDate}, ${adults} pax)`);
    return this.getRealResponse(query);
  }

  private async getRealResponse(query: FlightSearchQuery): Promise<FlightSearchResult[]> {
    const apiKey = process.env.IGNAV_API_KEY;
    if (!apiKey || apiKey === 'tu_ignav_api_key') {
      throw new Error('Credencial IGNAV_API_KEY no configurada en .env');
    }

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          origin: query.originIata,
          destination: query.destinationIata,
          departure_date: query.departureDate,
          return_date: query.returnDate,
          adults: query.adults ?? 1,
          cabin_class: 'economy',
          market: 'ES',
          ...(query.directOnly ? { max_stops: 0 } : {}),
        },
        {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      return this.mapItinerariesToResults(response.data?.itineraries, query);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 429) {
        this.logger.error('Límite de cuota de Ignav alcanzado (HTTP 429 Too Many Requests)');
        throw new Error('HTTP 429 Too Many Requests');
      }
      this.logger.error(`Error en llamada al comparador de vuelos: ${error?.response?.data ? JSON.stringify(error.response.data) : error?.message}`);
      throw error;
    }
  }

  private getMockedResponse(query: FlightSearchQuery): FlightSearchResult[] {
    if (query.destinationIata === '429') {
      throw new Error('HTTP 429 Too Many Requests');
    }

    let rawResponse: any;

    switch (query.destinationIata) {
      case 'LON':
      case 'STN':
        rawResponse = IGNAV_MOCKS.CHEAP_FLIGHT;
        break;
      case 'PAR':
      case 'CDG':
        rawResponse = IGNAV_MOCKS.REALISTIC_RESPONSE;
        break;
      case 'JFK':
      case 'DXB':
        rawResponse = IGNAV_MOCKS.EXPENSIVE_FLIGHT;
        break;
      case 'INN':
        rawResponse = IGNAV_MOCKS.LAYOVER_FLIGHT;
        break;
      case 'XXX':
        rawResponse = IGNAV_MOCKS.EMPTY_RESPONSE;
        break;
      default:
        rawResponse = this.isMockLayoverRoute(query.originIata, query.destinationIata)
          ? IGNAV_MOCKS.LAYOVER_FLIGHT
          : IGNAV_MOCKS.CHEAP_FLIGHT;
        break;
    }

    return this.mapItinerariesToResults(rawResponse.itineraries, query);
  }

  private isMockLayoverRoute(originIata: string, destinationIata: string): boolean {
    const origin = (originIata || '').toUpperCase();
    const dest = (destinationIata || '').toUpperCase();
    if (dest === 'INN') return true;
    const majorHubs = new Set([
      'MAD',
      'BCN',
      'VLC',
      'SVQ',
      'AGP',
      'ALC',
      'PMI',
      'BIO',
      'LON',
      'LHR',
      'STN',
      'PAR',
      'CDG',
      'ROM',
      'FCO',
      'AMS',
      'LIS',
      'OPO',
    ]);
    if (!majorHubs.has(origin) && ['FAO', 'GVA', 'TRN', 'ZRH', 'VCE', 'NAP'].includes(dest)) {
      return true;
    }
    return false;
  }

  private mapItinerariesToResults(itineraries: any[] | undefined, query: FlightSearchQuery): FlightSearchResult[] {
    if (!itineraries || !Array.isArray(itineraries)) return [];

    return itineraries
      .map((item: any) => {
        const price = Number(item.price?.amount);
        if (isNaN(price) || price <= 0) return null;

        const outboundSegments: any[] = item.outbound?.segments || [];
        const inboundSegments: any[] = item.inbound?.segments || [];
        const outboundStops = outboundSegments.length > 0 ? outboundSegments.length - 1 : 0;
        const inboundStops = inboundSegments.length > 0 ? inboundSegments.length - 1 : 0;
        const stopsCount = Math.max(outboundStops, inboundStops);
        const isDirect = outboundStops === 0 && inboundStops === 0;

        const rawDepTime: string | undefined = outboundSegments[0]?.departure_time_local;
        const departureTime = rawDepTime && rawDepTime.includes('T')
          ? rawDepTime.split('T')[1].slice(0, 5)
          : null;

        const durationMinutes: number | null =
          typeof item.outbound?.duration_minutes === 'number'
            ? item.outbound.duration_minutes
            : null;

        const carrier =
          item.outbound?.carrier ||
          outboundSegments[0]?.operating_carrier_name ||
          outboundSegments[0]?.marketing_carrier_code ||
          null;

        const adults = query.adults ?? 1;
        const flightQueryPrefix = query.directOnly ? 'Nonstop%20flights' : 'Flights';

        return {
          departureDate: query.departureDate,
          returnDate: query.returnDate,
          foundPriceEur: price,
          airlineCode: carrier,
          isDirect,
          stopsCount,
          departureTime,
          durationMinutes,
          bookingUrl: `https://www.google.com/travel/flights?q=${flightQueryPrefix}%20to%20${query.destinationIata}%20from%20${query.originIata}%20on%20${query.departureDate}%20through%20${query.returnDate}%20for%20${adults}%20adults`,
        };
      })
      .filter((f: any) => f !== null && (!query.directOnly || f.isDirect)) as FlightSearchResult[];
  }
}
