export interface FlightSearchQuery {
  originIata: string;
  destinationIata: string;
  departureDate: string;
  returnDate: string;
  adults?: number;
  directOnly?: boolean;
}

export interface FlightSearchResult {
  departureDate: string;
  returnDate: string;
  foundPriceEur: number;
  airlineCode: string | null;
  bookingUrl: string | null;
  isDirect?: boolean;
  stopsCount?: number;
  departureTime?: string | null;
  durationMinutes?: number | null;
}

export const FLIGHT_SEARCH_PROVIDER = 'FLIGHT_SEARCH_PROVIDER';

export interface FlightSearchProvider {
  searchFlights(query: FlightSearchQuery): Promise<FlightSearchResult[]>;
}
