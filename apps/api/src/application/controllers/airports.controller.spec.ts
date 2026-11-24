import {
  AirportsController,
  normalizeSearchText,
  SQL_ACCENT_FROM,
  SQL_ACCENT_TO,
} from './airports.controller';

describe('AirportsController (Búsqueda sin tildes / diacríticos)', () => {
  let controller: AirportsController;
  let mockPrisma: any;

  const sampleAirports = [
    { iata: 'MUC', name: 'Franz Josef Strauss', city: 'Múnich', country: 'Alemania', popularity: 828 },
    { iata: 'AGP', name: 'Málaga-Costa del Sol', city: 'Málaga', country: 'España', popularity: 910 },
    { iata: 'MAD', name: 'Adolfo Suárez Madrid-Barajas', city: 'Madrid', country: 'España', popularity: 999 },
    { iata: 'ZRH', name: 'Zürich Airport', city: 'Zúrich', country: 'Suiza', popularity: 800 },
  ];

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn().mockImplementation(async (sql: string, ...params: any[]) => {
        if (sql.includes('COUNT(*)')) {
          return [{ count: BigInt(sampleAirports.length) }];
        }
        // Simula el comportamiento de PostgreSQL: solo hace match si el SQL normaliza tildes con translate(...)
        const likePattern = String(params[0] || '');
        const cleanQuery = likePattern.replace(/^%|%$/g, '').toLowerCase();
        const usesTranslate = /translate\s*\(\s*LOWER\s*\(/i.test(sql);

        const norm = (s: string) =>
          usesTranslate
            ? s
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
            : s.toLowerCase();

        return sampleAirports.filter(
          (a) =>
            norm(a.iata).includes(cleanQuery) ||
            norm(a.city).includes(cleanQuery) ||
            norm(a.name).includes(cleanQuery) ||
            norm(a.country).includes(cleanQuery),
        );
      }),
    };

    controller = new AirportsController(mockPrisma);
  });

  it('should normalize accents and diacritics in search queries', () => {
    expect(SQL_ACCENT_FROM.length).toBe(SQL_ACCENT_TO.length);
    expect(normalizeSearchText('Múnich')).toBe('munich');
    expect(normalizeSearchText('Munich')).toBe('munich');
    expect(normalizeSearchText('  Málaga  ')).toBe('malaga');
    expect(normalizeSearchText('Zürich')).toBe('zurich');
    expect(normalizeSearchText('España')).toBe('espana');
  });

  it('should find Múnich (MUC) when searching "Munich" without tilde', async () => {
    const res = await controller.searchAirports('Munich', '60');

    expect(res.items.some((a) => a.iata === 'MUC')).toBe(true);
    const searchCall = mockPrisma.$queryRawUnsafe.mock.calls.find(
      ([sql]: [string]) => sql.includes('FROM "Airport"') && !sql.includes('COUNT(*)'),
    );
    expect(searchCall).toBeDefined();
    expect(searchCall[1]).toBe('%munich%');
  });

  it('should find Múnich (MUC) when searching "Múnich" with tilde', async () => {
    const res = await controller.searchAirports('Múnich', '60');

    expect(res.items.some((a) => a.iata === 'MUC')).toBe(true);
    const searchCall = mockPrisma.$queryRawUnsafe.mock.calls.find(
      ([sql]: [string]) => sql.includes('FROM "Airport"') && !sql.includes('COUNT(*)'),
    );
    expect(searchCall[1]).toBe('%munich%');
  });

  it('should find Málaga (AGP) when searching "Malaga" without tilde and Zúrich (ZRH) when searching "Zurich"', async () => {
    const malagaRes = await controller.searchAirports('Malaga', '60');
    expect(malagaRes.items.some((a) => a.iata === 'AGP')).toBe(true);

    const zurichRes = await controller.searchAirports('Zurich', '60');
    expect(zurichRes.items.some((a) => a.iata === 'ZRH')).toBe(true);
  });
});
