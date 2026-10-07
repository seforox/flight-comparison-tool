export interface FlightSearchQuery {
  originIata: string;
  destinationIata: string;
  departureDate: string;
  returnDate: string;
}

export interface FlightSearchResult {
  departureDate: string;
  returnDate: string;
  foundPriceEur: number;
  airlineCode: string | null;
  bookingUrl: string | null;
}

export const FLIGHT_SEARCH_PROVIDER = 'FLIGHT_SEARCH_PROVIDER';

export interface FlightSearchProvider {
  searchFlights(query: FlightSearchQuery): Promise<FlightSearchResult[]>;
}
