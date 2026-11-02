export const IGNAV_MOCKS = {
  // Escenario 1: Vuelo barato (Ideal para disparar alertas positivas)
  CHEAP_FLIGHT: {
    origin: 'MAD',
    destination: 'LON',
    departure_date: '2026-11-02',
    return_date: '2026-11-04',
    observed_at: '2026-11-02T12:00:00Z',
    itineraries: [
      {
        price: {
          amount: 45.5,
          currency: 'EUR',
          status: 'verified',
        },
        outbound: {
          carrier: 'Ryanair',
          duration_minutes: 150,
          segments: [
            {
              marketing_carrier_code: 'FR',
              flight_number: '1234',
              operating_carrier_name: 'Ryanair',
              departure_airport: 'MAD',
              departure_time_local: '2026-11-02T08:30:00',
              arrival_airport: 'STN',
            },
          ],
        },
        cabin_class: 'economy',
        has_mixed_carriers: false,
        ignav_id: 'mock_ignav_cheap_1',
      },
      {
        price: {
          amount: 55.0,
          currency: 'EUR',
          status: 'verified',
        },
        outbound: {
          carrier: 'Air Europa',
          duration_minutes: 160,
          segments: [
            {
              marketing_carrier_code: 'UX',
              flight_number: '1015',
              operating_carrier_name: 'Air Europa',
            },
          ],
        },
        cabin_class: 'economy',
        has_mixed_carriers: false,
        ignav_id: 'mock_ignav_cheap_2',
      },
    ],
  },

  // Escenario 2: Vuelo muy caro (Para probar que NO dispara la alerta si supera el maxPriceEur)
  EXPENSIVE_FLIGHT: {
    origin: 'MAD',
    destination: 'JFK',
    departure_date: '2026-11-06',
    return_date: '2026-11-08',
    observed_at: '2026-11-02T12:00:00Z',
    itineraries: [
      {
        price: {
          amount: 350.0,
          currency: 'EUR',
          status: 'verified',
        },
        outbound: {
          carrier: 'Iberia',
          duration_minutes: 510,
          segments: [
            {
              marketing_carrier_code: 'IB',
              flight_number: '6251',
              operating_carrier_name: 'Iberia',
            },
          ],
        },
        cabin_class: 'economy',
        has_mixed_carriers: false,
        ignav_id: 'mock_ignav_exp_1',
      },
    ],
  },

  // Escenario 3: No hay vuelos (itineraries vacío)
  EMPTY_RESPONSE: {
    origin: 'MAD',
    destination: 'XXX',
    itineraries: [],
  },

  // Escenario 4: Estructura realista completa de Ignav API
  REALISTIC_RESPONSE: {
    origin: 'MAD',
    destination: 'PAR',
    departure_date: '2026-11-06',
    return_date: '2026-11-08',
    observed_at: '2026-11-02T12:00:00Z',
    itineraries: [
      {
        price: {
          amount: 110.25,
          currency: 'EUR',
          status: 'verified',
        },
        outbound: {
          carrier: 'Air France',
          duration_minutes: 135,
          segments: [
            {
              marketing_carrier_code: 'AF',
              flight_number: '1301',
              operating_carrier_name: 'Air France',
              departure_airport: 'MAD',
              departure_time_local: '2026-11-06T10:00:00',
              arrival_airport: 'CDG',
              arrival_time_local: '2026-11-06T12:15:00',
              duration_minutes: 135,
              aircraft: 'Airbus A320',
            },
          ],
        },
        inbound: {
          carrier: 'Air France',
          duration_minutes: 130,
          segments: [
            {
              marketing_carrier_code: 'AF',
              flight_number: '1300',
              operating_carrier_name: 'Air France',
              departure_airport: 'CDG',
              departure_time_local: '2026-11-08T18:00:00',
              arrival_airport: 'MAD',
              arrival_time_local: '2026-11-08T20:10:00',
              duration_minutes: 130,
              aircraft: 'Airbus A320',
            },
          ],
        },
        cabin_class: 'economy',
        has_mixed_carriers: false,
        ignav_id: '5e4fcd2f1dc340649eb19f6ee2afb57a',
      },
    ],
  },
};
