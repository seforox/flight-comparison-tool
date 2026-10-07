export const AMADEUS_MOCKS = {
  // Escenario 1: Vuelo barato (Ideal para disparar alertas positivas)
  CHEAP_FLIGHT: {
    meta: { count: 2 },
    data: [
      {
        type: 'flight-offer',
        id: 'mock-cheap-1',
        price: {
          currency: 'EUR',
          total: '45.50',
          base: '30.00',
        },
        validatingAirlineCodes: ['RY'], // Ryanair (mock)
        itineraries: [
          { duration: 'PT2H30M' },
          { duration: 'PT2H40M' }
        ]
      },
      {
        type: 'flight-offer',
        id: 'mock-cheap-2',
        price: {
          currency: 'EUR',
          total: '55.00',
        },
        validatingAirlineCodes: ['UX'], // Air Europa
      }
    ]
  },

  // Escenario 2: Vuelo muy caro (Para probar que NO dispara la alerta si supera el maxPriceEur)
  EXPENSIVE_FLIGHT: {
    meta: { count: 1 },
    data: [
      {
        type: 'flight-offer',
        id: 'mock-exp-1',
        price: {
          currency: 'EUR',
          total: '350.00',
        },
        validatingAirlineCodes: ['IB'], // Iberia
      }
    ]
  },

  // Escenario 3: No hay vuelos (array data vacío)
  EMPTY_RESPONSE: {
    meta: { count: 0 },
    data: []
  },

  // Escenario 4: Estructura real más compleja de Amadeus (simplificada)
  REALISTIC_RESPONSE: {
    meta: { count: 1 },
    data: [
      {
        type: 'flight-offer',
        id: '1',
        source: 'GDS',
        instantTicketingRequired: false,
        nonHomogeneous: false,
        oneWay: false,
        lastTicketingDate: '2026-10-30',
        numberOfBookableSeats: 9,
        itineraries: [
          {
            duration: 'PT2H15M',
            segments: [
              {
                departure: { iataCode: 'MAD', at: '2026-11-01T10:00:00' },
                arrival: { iataCode: 'CDG', at: '2026-11-01T12:15:00' },
                carrierCode: 'AF',
                number: '1234',
              }
            ]
          }
        ],
        price: {
          currency: 'EUR',
          total: '110.25',
          base: '85.00',
          fees: [
            { amount: '0.00', type: 'SUPPLIER' },
            { amount: '0.00', type: 'TICKETING' }
          ],
          grandTotal: '110.25'
        },
        pricingOptions: {
          fareType: ['PUBLISHED'],
          includedCheckedBagsOnly: true
        },
        validatingAirlineCodes: ['AF']
      }
    ]
  }
};
