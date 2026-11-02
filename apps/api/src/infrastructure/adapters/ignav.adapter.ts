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

    if (useMock) {
      this.logger.log(`[MOCK MODE] Buscando vuelos simulados en Ignav para ${query.originIata} -> ${query.destinationIata} (${query.departureDate} a ${query.returnDate})`);
      return this.getMockedResponse(query);
    }

    this.logger.log(`[REAL MODE] Ejecutando llamada real a Ignav API para ${query.originIata} -> ${query.destinationIata} (${query.departureDate} a ${query.returnDate})`);
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
          adults: 1,
          cabin_class: 'economy',
          market: 'ES',
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
      this.logger.error(`Error en llamada real a Ignav API: ${error?.response?.data ? JSON.stringify(error.response.data) : error?.message}`);
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
      case 'XXX':
      default:
        rawResponse = query.destinationIata === 'XXX' ? IGNAV_MOCKS.EMPTY_RESPONSE : IGNAV_MOCKS.CHEAP_FLIGHT;
        break;
    }

    return this.mapItinerariesToResults(rawResponse.itineraries, query);
  }

  private mapItinerariesToResults(itineraries: any[] | undefined, query: FlightSearchQuery): FlightSearchResult[] {
    if (!itineraries || !Array.isArray(itineraries)) return [];

    return itineraries
      .map((item: any) => {
        const price = Number(item.price?.amount);
        if (isNaN(price) || price <= 0) return null;

        const carrier =
          item.outbound?.segments?.[0]?.marketing_carrier_code ||
          item.outbound?.carrier ||
          null;

        return {
          departureDate: query.departureDate,
          returnDate: query.returnDate,
          foundPriceEur: price,
          airlineCode: carrier,
          bookingUrl: `https://www.google.com/travel/flights?q=Flights%20to%20${query.destinationIata}%20from%20${query.originIata}%20on%20${query.departureDate}%20through%20${query.returnDate}`,
        };
      })
      .filter((f: any) => f !== null) as FlightSearchResult[];
  }
}
