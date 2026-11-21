export const API_BASE_URL =
  process.env.NEXT_PUBLIC_USE_API_PROXY === 'true'
    ? '/api/proxy'
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export type AlertStatus = 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'COMPLETED';

export interface UserProfile {
  id: string;
  email: string;
  telegramChatId: string | null;
  createdAt: string;
}

export interface FlightMatch {
  id: string;
  alertId: string;
  departureDate: string;
  returnDate: string;
  foundPriceEur: string | number;
  airlineCode: string | null;
  bookingUrl: string | null;
  notifiedAt: string;
}

export interface FlightAlert {
  id: string;
  userId: string;
  originIata: string;
  destinationIata: string;
  departureDay: number;
  returnDay: number;
  adults: number;
  directOnly?: boolean;
  pendingCompletionPrompt?: boolean;
  maxPriceEur: string | number;
  startDate: string;
  endDate: string;
  status: AlertStatus;
  createdAt: string;
  matches: FlightMatch[];
}

export interface DestinationRecommendation {
  city: string;
  iataCode: string;
  country: string;
  estimatedPriceEur: number;
  reason: string;
  hasDirectFlights?: boolean;
}

export interface AgentChatResponse {
  sessionId: string;
  activeSkill: 'DEFINED_SEARCH' | 'DESTINATION_RECOMMENDER';
  reply: string;
  isComplete: boolean;
  awaitingConfirmation: boolean;
  alertCreated?: boolean;
  createdAlertId?: string;
  recommendations?: DestinationRecommendation[];
  parsedData?: {
    originIata: string;
    destinationIata: string;
    departureDay: number;
    returnDay: number;
    adults: number;
    directOnly: boolean;
    maxPriceEur: number;
    startDate: string;
    endDate: string;
  };
  draftData?: {
    originIata?: string;
    destinationIata?: string;
    departureDay?: number;
    returnDay?: number;
    adults?: number;
    directOnly?: boolean;
    maxPriceEur?: number;
    rawMaxPriceEur?: number;
    budgetType?: 'PER_PERSON' | 'TOTAL';
    startDate?: string;
    endDate?: string;
    [key: string]: unknown;
  };
}

export interface AirportItem {
  iata: string;
  city: string;
  name: string;
  country: string;
  popularity?: number;
}

export const AIRPORTS_CATALOG: AirportItem[] = [
  { iata: 'MAD', city: 'Madrid', name: 'Adolfo Suárez Madrid-Barajas', country: 'España' },
  { iata: 'BCN', city: 'Barcelona', name: 'Josep Tarradellas Barcelona-El Prat', country: 'España' },
  { iata: 'HND', city: 'Tokio', name: 'Tokyo Haneda International', country: 'Japón' },
  { iata: 'NRT', city: 'Tokio', name: 'Narita International Airport', country: 'Japón' },
  { iata: 'TYO', city: 'Tokio', name: 'Haneda / Narita (Todos)', country: 'Japón' },
  { iata: 'AMS', city: 'Ámsterdam', name: 'Amsterdam Airport Schiphol', country: 'Países Bajos' },
  { iata: 'LHR', city: 'Londres', name: 'London Heathrow Airport', country: 'Reino Unido' },
  { iata: 'LON', city: 'Londres', name: 'Heathrow / Gatwick / Stansted (Todos)', country: 'Reino Unido' },
  { iata: 'STN', city: 'Londres Stansted', name: 'London Stansted Airport', country: 'Reino Unido' },
  { iata: 'LGW', city: 'Londres Gatwick', name: 'London Gatwick Airport', country: 'Reino Unido' },
  { iata: 'LTN', city: 'Londres Luton', name: 'London Luton Airport', country: 'Reino Unido' },
  { iata: 'FCO', city: 'Roma', name: 'Leonardo da Vinci-Fiumicino', country: 'Italia' },
  { iata: 'CIA', city: 'Roma Ciampino', name: 'Roma Ciampino Airport', country: 'Italia' },
  { iata: 'ROM', city: 'Roma', name: 'Fiumicino / Ciampino (Todos)', country: 'Italia' },
  { iata: 'JFK', city: 'Nueva York', name: 'John F. Kennedy International', country: 'EE. UU.' },
  { iata: 'NYC', city: 'Nueva York', name: 'JFK / Newark / LaGuardia (Todos)', country: 'EE. UU.' },
  { iata: 'EWR', city: 'Nueva York Newark', name: 'Newark Liberty International', country: 'EE. UU.' },
  { iata: 'PAR', city: 'París', name: 'Charles de Gaulle / Orly / Beauvais (Todos)', country: 'Francia' },
  { iata: 'CDG', city: 'París', name: 'Charles de Gaulle', country: 'Francia' },
  { iata: 'ORY', city: 'París Orly', name: 'Paris Orly Airport', country: 'Francia' },
  { iata: 'BVA', city: 'París Beauvais', name: 'Paris Beauvais-Tillé', country: 'Francia' },
  { iata: 'PMI', city: 'Palma de Mallorca', name: 'Son Sant Joan', country: 'España' },
  { iata: 'AGP', city: 'Málaga', name: 'Málaga-Costa del Sol', country: 'España' },
  { iata: 'ALC', city: 'Alicante', name: 'Alicante-Elche Miguel Hernández', country: 'España' },
  { iata: 'TCI', city: 'Tenerife', name: 'Tenerife Sur / Norte (Todos)', country: 'España' },
  { iata: 'TFS', city: 'Tenerife Sur', name: 'Reina Sofía', country: 'España' },
  { iata: 'TFN', city: 'Tenerife Norte', name: 'Ciudad de La Laguna', country: 'España' },
  { iata: 'LPA', city: 'Gran Canaria', name: 'Aeropuerto de Gran Canaria', country: 'España' },
  { iata: 'ACE', city: 'Lanzarote', name: 'César Manrique-Lanzarote', country: 'España' },
  { iata: 'FUE', city: 'Fuerteventura', name: 'Aeropuerto de Fuerteventura', country: 'España' },
  { iata: 'IBZ', city: 'Ibiza', name: 'Aeropuerto de Ibiza', country: 'España' },
  { iata: 'MAH', city: 'Menorca', name: 'Aeropuerto de Menorca', country: 'España' },
  { iata: 'SVQ', city: 'Sevilla', name: 'Aeropuerto de Sevilla-San Pablo', country: 'España' },
  { iata: 'VLC', city: 'Valencia', name: 'Aeropuerto de Valencia-Manises', country: 'España' },
  { iata: 'BIO', city: 'Bilbao', name: 'Aeropuerto de Bilbao', country: 'España' },
  { iata: 'SCQ', city: 'Santiago de Compostela', name: 'Santiago-Rosalía de Castro', country: 'España' },
  { iata: 'ZAZ', city: 'Zaragoza', name: 'Aeropuerto de Zaragoza', country: 'España' },
  { iata: 'OVD', city: 'Asturias', name: 'Aeropuerto de Asturias', country: 'España' },
  { iata: 'SDR', city: 'Santander', name: 'Seve Ballesteros-Santander', country: 'España' },
  { iata: 'VGO', city: 'Vigo', name: 'Aeropuerto de Vigo-Peinador', country: 'España' },
  { iata: 'LCG', city: 'A Coruña', name: 'Aeropuerto de A Coruña', country: 'España' },
  { iata: 'GRX', city: 'Granada', name: 'Federico García Lorca Granada-Jaén', country: 'España' },
  { iata: 'XRY', city: 'Jerez', name: 'Aeropuerto de Jerez', country: 'España' },
  { iata: 'RMU', city: 'Murcia', name: 'Región de Murcia International', country: 'España' },
  { iata: 'FAO', city: 'Faro (Algarve)', name: 'Faro Airport', country: 'Portugal' },
  { iata: 'LIS', city: 'Lisboa', name: 'Humberto Delgado', country: 'Portugal' },
  { iata: 'OPO', city: 'Oporto', name: 'Francisco Sá Carneiro', country: 'Portugal' },
  { iata: 'MIL', city: 'Milán', name: 'Malpensa / Bérgamo / Linate (Todos)', country: 'Italia' },
  { iata: 'BGY', city: 'Milán Bérgamo', name: 'Orio al Serio (Dolomitas)', country: 'Italia' },
  { iata: 'MXP', city: 'Milán Malpensa', name: 'Milano Malpensa Airport', country: 'Italia' },
  { iata: 'LIN', city: 'Milán Linate', name: 'Milano Linate Airport', country: 'Italia' },
  { iata: 'VCE', city: 'Venecia', name: 'Marco Polo Airport', country: 'Italia' },
  { iata: 'NAP', city: 'Nápoles', name: 'Napoli Capodichino', country: 'Italia' },
  { iata: 'FLR', city: 'Florencia', name: 'Amerigo Vespucci', country: 'Italia' },
  { iata: 'BLQ', city: 'Bolonia', name: 'Guglielmo Marconi', country: 'Italia' },
  { iata: 'PSA', city: 'Pisa', name: 'Galileo Galilei', country: 'Italia' },
  { iata: 'TRN', city: 'Turín', name: 'Torino Caselle (Piamonte)', country: 'Italia' },
  { iata: 'GVA', city: 'Ginebra', name: 'Genève Aéroport (Alpes)', country: 'Suiza' },
  { iata: 'ZRH', city: 'Zúrich', name: 'Zürich Airport', country: 'Suiza' },
  { iata: 'BSL', city: 'Basilea', name: 'EuroAirport Basel-Mulhouse-Freiburg', country: 'Suiza' },
  { iata: 'INN', city: 'Innsbruck', name: 'Innsbruck Tirol Airport', country: 'Austria' },
  { iata: 'VIE', city: 'Viena', name: 'Vienna International Airport', country: 'Austria' },
  { iata: 'BER', city: 'Berlín', name: 'Berlin Brandenburg Airport', country: 'Alemania' },
  { iata: 'FRA', city: 'Fráncfort', name: 'Frankfurt Airport', country: 'Alemania' },
  { iata: 'MUC', city: 'Múnich', name: 'Munich Airport', country: 'Alemania' },
  { iata: 'BRU', city: 'Bruselas', name: 'Brussels Airport Zaventem', country: 'Bélgica' },
  { iata: 'CRL', city: 'Bruselas Charleroi', name: 'Brussels South Charleroi', country: 'Bélgica' },
  { iata: 'PRG', city: 'Praga', name: 'Václav Havel Airport Prague', country: 'Chequia' },
  { iata: 'BUD', city: 'Budapest', name: 'Budapest Ferenc Liszt', country: 'Hungría' },
  { iata: 'ATH', city: 'Atenas', name: 'Athens International Airport', country: 'Grecia' },
  { iata: 'DUB', city: 'Dublín', name: 'Dublin Airport', country: 'Irlanda' },
  { iata: 'EDI', city: 'Edimburgo', name: 'Edinburgh Airport', country: 'Reino Unido' },
  { iata: 'CPH', city: 'Copenhague', name: 'Copenhagen Airport', country: 'Dinamarca' },
  { iata: 'STO', city: 'Estocolmo', name: 'Arlanda / Skavsta (Todos)', country: 'Suecia' },
  { iata: 'ARN', city: 'Estocolmo Arlanda', name: 'Stockholm Arlanda Airport', country: 'Suecia' },
  { iata: 'OSL', city: 'Oslo', name: 'Oslo Airport Gardermoen', country: 'Noruega' },
  { iata: 'WAW', city: 'Varsovia', name: 'Warsaw Chopin Airport', country: 'Polonia' },
  { iata: 'KRK', city: 'Cracovia', name: 'John Paul II Kraków-Balice', country: 'Polonia' },
  { iata: 'DXB', city: 'Dubái', name: 'Dubai International', country: 'EAU' },
];

const AIRPORTS_MEMORY_CACHE = new Map<string, AirportItem>(
  AIRPORTS_CATALOG.map((a) => [a.iata.toUpperCase(), a]),
);

export function cacheAirports(items: AirportItem[]): void {
  for (const item of items) {
    if (item?.iata) {
      AIRPORTS_MEMORY_CACHE.set(item.iata.toUpperCase(), item);
    }
  }
}

export function getCachedAirport(iata: string): AirportItem | undefined {
  if (!iata) return undefined;
  return AIRPORTS_MEMORY_CACHE.get(iata.toUpperCase());
}

export const WEEKDAYS = [
  { value: 1, label: 'Lunes', short: 'Lun' },
  { value: 2, label: 'Martes', short: 'Mar' },
  { value: 3, label: 'Miércoles', short: 'Mié' },
  { value: 4, label: 'Jueves', short: 'Jue' },
  { value: 5, label: 'Viernes', short: 'Vie' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 7, label: 'Domingo', short: 'Dom' },
];

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('flight_jwt_token');
}

export function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('flight_jwt_token', token);
  }
}

export function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('flight_jwt_token');
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `Error HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (Array.isArray(body.message)) {
        errMsg = body.message.join(', ');
      } else if (body.message) {
        errMsg = body.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errMsg);
  }

  return res.json();
}

export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<{ accessToken: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: async () => {
      try {
        await request('/auth/logout', { method: 'POST' });
      } finally {
        clearToken();
      }
    },
    getProfile: () => request<UserProfile>('/auth/me'),
    updateTelegram: (telegramChatId: string) =>
      request<UserProfile>('/auth/telegram', {
        method: 'PATCH',
        body: JSON.stringify({ telegramChatId }),
      }),
  },
  alerts: {
    list: () => request<FlightAlert[]>('/alerts'),
    create: (payload: {
      originIata: string;
      destinationIata: string;
      departureDay: number;
      returnDay: number;
      adults: number;
      directOnly?: boolean;
      maxPriceEur: number;
      startDate: string;
      endDate: string;
    }) =>
      request<FlightAlert>('/alerts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (
      id: string,
      payload: {
        originIata: string;
        destinationIata: string;
        departureDay: number;
        returnDay: number;
        adults: number;
        directOnly?: boolean;
        maxPriceEur: number;
        startDate: string;
        endDate: string;
      },
    ) =>
      request<FlightAlert>(`/alerts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    updateStatus: (id: string, status: AlertStatus) =>
      request<FlightAlert>(`/alerts/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    remove: (id: string) =>
      request(`/alerts/${id}`, {
        method: 'DELETE',
      }),
    triggerCheck: (id: string) =>
      request<{ alertId: string; jobsEnqueued: number }>(`/alerts/${id}/check`, {
        method: 'POST',
      }),
  },
  agent: {
    chat: (prompt: string, sessionId: string) =>
      request<AgentChatResponse>('/agent/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt, sessionId }),
      }),
  },
  airports: {
    search: async (q = '', limit = 60): Promise<{ total: number; items: AirportItem[] }> => {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      params.set('limit', String(limit));
      const res = await request<{ total: number; items: AirportItem[] }>(
        `/airports?${params.toString()}`,
      );
      if (res?.items) {
        cacheAirports(res.items);
      }
      return res;
    },
    getByIata: async (iata: string): Promise<AirportItem | null> => {
      const clean = (iata || '').trim().toUpperCase();
      if (!clean) return null;
      const cached = getCachedAirport(clean);
      if (cached) return cached;
      try {
        const item = await request<AirportItem | null>(`/airports/${encodeURIComponent(clean)}`);
        if (item?.iata) {
          cacheAirports([item]);
        }
        return item;
      } catch {
        return null;
      }
    },
  },
};
