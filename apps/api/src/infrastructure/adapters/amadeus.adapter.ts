import { Logger } from '@nestjs/common';
import { FlightSearchProvider, FlightSearchQuery, FlightSearchResult } from '../../domain/interfaces/flight-search.provider';
import { AMADEUS_MOCKS } from './mocks/amadeus.mocks';

export class AmadeusAdapter implements FlightSearchProvider {
  private readonly logger = new Logger(AmadeusAdapter.name);

  async searchFlights(query: FlightSearchQuery): Promise<FlightSearchResult[]> {
    const useMock = process.env.USE_AMADEUS_MOCK === 'true' || process.env.NODE_ENV === 'test';

    if (useMock) {
      this.logger.log(`[MOCK MODE] Buscando vuelos simulados para ${query.originIata} -> ${query.destinationIata}`);
      return this.getMockedResponse(query);
    }

    this.logger.log(`[REAL MODE] Ejecutando llamada real a Amadeus API para ${query.originIata} -> ${query.destinationIata}`);
    return this.getRealResponse(query);
  }

  private async getRealResponse(query: FlightSearchQuery): Promise<FlightSearchResult[]> {
    // TODO: Implementar llamada HTTP real con @nestjs/axios y parseo de DTO
    this.logger.warn('Llamada real a Amadeus aún no implementada, se requieren las credenciales reales de la API.');
    return [];
  }

  private getMockedResponse(query: FlightSearchQuery): FlightSearchResult[] {
    if (query.destinationIata === '429') {
      throw new Error('HTTP 429 Too Many Requests');
    }

    let rawResponse: any;

    switch (query.destinationIata) {
      case 'LON':
      case 'STN':
        rawResponse = AMADEUS_MOCKS.CHEAP_FLIGHT;
        break;
      case 'PAR':
      case 'CDG':
        rawResponse = AMADEUS_MOCKS.REALISTIC_RESPONSE;
        break;
      case 'JFK':
      case 'DXB':
        rawResponse = AMADEUS_MOCKS.EXPENSIVE_FLIGHT;
        break;
      case 'XXX':
      default:
        rawResponse = query.destinationIata === 'XXX' ? AMADEUS_MOCKS.EMPTY_RESPONSE : AMADEUS_MOCKS.CHEAP_FLIGHT;
        break;
    }

    if (!rawResponse.data) return [];

    return rawResponse.data
      .map((flight: any) => {
        const price = parseFloat(flight.price.total);
        if (isNaN(price) || price <= 0) return null;

        return {
          departureDate: query.departureDate,
          returnDate: query.returnDate,
          foundPriceEur: price,
          airlineCode: flight.validatingAirlineCodes[0] || null,
          bookingUrl: `https://mock.book.url/${query.originIata}-${query.destinationIata}`
        };
      })
      .filter((f: any) => f !== null) as FlightSearchResult[];
  }
}
