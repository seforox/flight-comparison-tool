export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    maxPriceEur: number;
    startDate: string;
    endDate: string;
  };
  draftData?: Record<string, unknown>;
}

export const AIRPORTS_CATALOG = [
  { iata: 'MAD', city: 'Madrid', name: 'Adolfo Suárez Madrid-Barajas', country: 'España' },
  { iata: 'BCN', city: 'Barcelona', name: 'Josep Tarradellas Barcelona-El Prat', country: 'España' },
  { iata: 'HND', city: 'Tokio', name: 'Tokyo Haneda International', country: 'Japón' },
  { iata: 'AMS', city: 'Ámsterdam', name: 'Amsterdam Airport Schiphol', country: 'Países Bajos' },
  { iata: 'LHR', city: 'Londres', name: 'London Heathrow Airport', country: 'Reino Unido' },
  { iata: 'LON', city: 'Londres (Todos)', name: 'Heathrow / Gatwick / Stansted', country: 'Reino Unido' },
  { iata: 'STN', city: 'Londres Stansted', name: 'London Stansted Airport', country: 'Reino Unido' },
  { iata: 'FCO', city: 'Roma', name: 'Leonardo da Vinci-Fiumicino', country: 'Italia' },
  { iata: 'ROM', city: 'Roma (Todos)', name: 'Fiumicino / Ciampino', country: 'Italia' },
  { iata: 'JFK', city: 'Nueva York', name: 'John F. Kennedy International', country: 'EE. UU.' },
  { iata: 'PAR', city: 'París (Todos)', name: 'Charles de Gaulle / Orly / Beauvais', country: 'Francia' },
  { iata: 'CDG', city: 'París', name: 'Charles de Gaulle', country: 'Francia' },
  { iata: 'PMI', city: 'Palma de Mallorca', name: 'Son Sant Joan', country: 'España' },
  { iata: 'AGP', city: 'Málaga', name: 'Málaga-Costa del Sol', country: 'España' },
  { iata: 'ALC', city: 'Alicante', name: 'Alicante-Elche Miguel Hernández', country: 'España' },
  { iata: 'TFS', city: 'Tenerife Sur', name: 'Reina Sofía', country: 'España' },
  { iata: 'FAO', city: 'Faro (Algarve)', name: 'Faro Airport', country: 'Portugal' },
  { iata: 'LIS', city: 'Lisboa', name: 'Humberto Delgado', country: 'Portugal' },
  { iata: 'OPO', city: 'Oporto', name: 'Francisco Sá Carneiro', country: 'Portugal' },
  { iata: 'BGY', city: 'Milán Bérgamo', name: 'Orio al Serio (Dolomitas)', country: 'Italia' },
  { iata: 'TRN', city: 'Turín', name: 'Torino Caselle (Piamonte)', country: 'Italia' },
  { iata: 'GVA', city: 'Ginebra', name: 'Genève Aéroport (Alpes)', country: 'Suiza' },
  { iata: 'ZRH', city: 'Zúrich', name: 'Zürich Airport', country: 'Suiza' },
  { iata: 'INN', city: 'Innsbruck', name: 'Innsbruck Tirol Airport', country: 'Austria' },
  { iata: 'DXB', city: 'Dubái', name: 'Dubai International', country: 'EAU' },
];

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
      maxPriceEur: number;
      startDate: string;
      endDate: string;
    }) =>
      request<FlightAlert>('/alerts', {
        method: 'POST',
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
};
