require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const COUNTRY_ES = {
  Spain: 'España',
  ES: 'España',
  France: 'Francia',
  FR: 'Francia',
  Italy: 'Italia',
  IT: 'Italia',
  'United Kingdom': 'Reino Unido',
  GB: 'Reino Unido',
  Germany: 'Alemania',
  DE: 'Alemania',
  Portugal: 'Portugal',
  PT: 'Portugal',
  Switzerland: 'Suiza',
  CH: 'Suiza',
  Austria: 'Austria',
  AT: 'Austria',
  Netherlands: 'Países Bajos',
  NL: 'Países Bajos',
  Belgium: 'Bélgica',
  BE: 'Bélgica',
  Ireland: 'Irlanda',
  IE: 'Irlanda',
  Greece: 'Grecia',
  GR: 'Grecia',
  Sweden: 'Suecia',
  SE: 'Suecia',
  Norway: 'Noruega',
  NO: 'Noruega',
  Denmark: 'Dinamarca',
  DK: 'Dinamarca',
  Finland: 'Finlandia',
  FI: 'Finlandia',
  Poland: 'Polonia',
  PL: 'Polonia',
  'Czech Republic': 'República Checa',
  CZ: 'República Checa',
  Hungary: 'Hungría',
  HU: 'Hungría',
  Croatia: 'Croacia',
  HR: 'Croacia',
  Turkey: 'Turquía',
  TR: 'Turquía',
  Morocco: 'Marruecos',
  MA: 'Marruecos',
  'United States': 'Estados Unidos',
  US: 'Estados Unidos',
  Canada: 'Canadá',
  CA: 'Canadá',
  Mexico: 'México',
  MX: 'México',
  Argentina: 'Argentina',
  AR: 'Argentina',
  Colombia: 'Colombia',
  CO: 'Colombia',
  Brazil: 'Brasil',
  BR: 'Brasil',
  Chile: 'Chile',
  CL: 'Chile',
  Peru: 'Perú',
  PE: 'Perú',
  Japan: 'Japón',
  JP: 'Japón',
  China: 'China',
  CN: 'China',
  Thailand: 'Tailandia',
  TH: 'Tailandia',
  'United Arab Emirates': 'Emiratos Árabes Unidos',
  AE: 'Emiratos Árabes Unidos',
  Australia: 'Australia',
  AU: 'Australia',
  Egypt: 'Egipto',
  EG: 'Egipto',
  Iceland: 'Islandia',
  IS: 'Islandia',
  Romania: 'Rumanía',
  RO: 'Rumanía',
  Bulgaria: 'Bulgaria',
  BG: 'Bulgaria',
};

const CITY_ES = {
  London: 'Londres',
  Paris: 'París',
  Rome: 'Roma',
  Milan: 'Milán',
  Turin: 'Turín',
  Venice: 'Venecia',
  Naples: 'Nápoles',
  Florence: 'Florencia',
  Bologna: 'Bolonia',
  Genoa: 'Génova',
  Geneva: 'Ginebra',
  Zurich: 'Zúrich',
  Basel: 'Basilea',
  Vienna: 'Viena',
  Prague: 'Praga',
  Warsaw: 'Varsovia',
  Krakow: 'Cracovia',
  Athens: 'Atenas',
  Brussels: 'Bruselas',
  Amsterdam: 'Ámsterdam',
  Lisbon: 'Lisboa',
  Porto: 'Oporto',
  Munich: 'Múnich',
  Berlin: 'Berlín',
  Frankfurt: 'Fráncfort',
  Cologne: 'Colonia',
  Hamburg: 'Hamburgo',
  Stockholm: 'Estocolmo',
  Gothenburg: 'Gotemburgo',
  Copenhagen: 'Copenhague',
  Dublin: 'Dublín',
  Edinburgh: 'Edimburgo',
  Bordeaux: 'Burdeos',
  Marseille: 'Marsella',
  Nice: 'Niza',
  Toulouse: 'Toulouse',
  Lyon: 'Lyon',
  Strasbourg: 'Estrasburgo',
  Nantes: 'Nantes',
  Tokyo: 'Tokio',
  'New York': 'Nueva York',
  Dubai: 'Dubái',
  Beijing: 'Pekín',
  Moscow: 'Moscú',
  Cairo: 'El Cairo',
  Marrakech: 'Marrakech',
  Tangier: 'Tánger',
  Seville: 'Sevilla',
  Malaga: 'Málaga',
  'Palma de Mallorca': 'Palma de Mallorca',
  Palma: 'Palma de Mallorca',
};

// Códigos metropolitanos y principales aeropuertos con prioridad alta
const FEATURED_OVERRIDES = [
  { iata: 'MAD', city: 'Madrid', name: 'Adolfo Suárez Madrid-Barajas', country: 'España', popularity: 10000 },
  { iata: 'BCN', city: 'Barcelona', name: 'Josep Tarradellas Barcelona-El Prat', country: 'España', popularity: 9900 },
  { iata: 'PMI', city: 'Palma de Mallorca', name: 'Son Sant Joan', country: 'España', popularity: 9500 },
  { iata: 'AGP', city: 'Málaga', name: 'Málaga-Costa del Sol', country: 'España', popularity: 9400 },
  { iata: 'ALC', city: 'Alicante', name: 'Alicante-Elche Miguel Hernández', country: 'España', popularity: 9300 },
  { iata: 'VLC', city: 'Valencia', name: 'Valencia Manises', country: 'España', popularity: 9250 },
  { iata: 'SVQ', city: 'Sevilla', name: 'Sevilla-San Pablo', country: 'España', popularity: 9200 },
  { iata: 'BIO', city: 'Bilbao', name: 'Bilbao Airport', country: 'España', popularity: 9150 },
  { iata: 'TFS', city: 'Tenerife Sur', name: 'Reina Sofía', country: 'España', popularity: 9100 },
  { iata: 'TFN', city: 'Tenerife Norte', name: 'Ciudad de La Laguna', country: 'España', popularity: 9050 },
  { iata: 'LPA', city: 'Gran Canaria', name: 'Gran Canaria Airport', country: 'España', popularity: 9000 },
  { iata: 'IBZ', city: 'Ibiza', name: 'Ibiza Airport', country: 'España', popularity: 8950 },
  { iata: 'ACE', city: 'Lanzarote', name: 'César Manrique-Lanzarote', country: 'España', popularity: 8900 },
  { iata: 'SCQ', city: 'Santiago de Compostela', name: 'Santiago-Rosalía de Castro', country: 'España', popularity: 8850 },
  { iata: 'OVD', city: 'Asturias', name: 'Aeropuerto de Asturias', country: 'España', popularity: 8800 },
  { iata: 'GRX', city: 'Granada', name: 'Federico García Lorca Granada-Jaén', country: 'España', popularity: 8750 },
  { iata: 'LON', city: 'Londres (Todos)', name: 'Heathrow / Gatwick / Stansted / Luton', country: 'Reino Unido', popularity: 9800 },
  { iata: 'PAR', city: 'París (Todos)', name: 'Charles de Gaulle / Orly / Beauvais', country: 'Francia', popularity: 9750 },
  { iata: 'ROM', city: 'Roma (Todos)', name: 'Fiumicino / Ciampino', country: 'Italia', popularity: 9700 },
  { iata: 'MIL', city: 'Milán (Todos)', name: 'Malpensa / Linate / Bérgamo', country: 'Italia', popularity: 9650 },
  { iata: 'TYO', city: 'Tokio (Todos)', name: 'Haneda / Narita', country: 'Japón', popularity: 9600 },
  { iata: 'NYC', city: 'Nueva York (Todos)', name: 'JFK / Newark / LaGuardia', country: 'Estados Unidos', popularity: 9550 },
];

async function main() {
  console.log('Descargando catálogos globales de aeropuertos IATA...');
  const [algoliaRes, mwggRes] = await Promise.all([
    fetch('https://raw.githubusercontent.com/algolia/datasets/master/airports/airports.json').then(r => r.json()),
    fetch('https://raw.githubusercontent.com/mwgg/Airports/master/airports.json').then(r => r.json()),
  ]);

  const map = new Map();

  // 1. Insertar base completa de mwgg (7.917 aeropuertos con código IATA de 3 letras)
  for (const item of Object.values(mwggRes)) {
    const iata = (item.iata || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iata)) continue;

    const rawCity = (item.city || item.name || iata).trim();
    const rawCountry = (item.country || '').trim();
    const cityEs = CITY_ES[rawCity] ? `${CITY_ES[rawCity]}` : rawCity;
    const countryEs = COUNTRY_ES[rawCountry] || rawCountry || 'Internacional';

    map.set(iata, {
      iata,
      name: (item.name || `${cityEs} Airport`).trim(),
      city: cityEs || iata,
      country: countryEs,
      popularity: countryEs === 'España' ? 4000 : 10,
    });
  }

  // 2. Enriquecer con los 3.282 aeropuertos comerciales principales de Algolia (con tráfico real links_count)
  for (const item of algoliaRes) {
    const iata = (item.iata_code || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iata)) continue;

    const rawCity = (item.city || item.name || iata).trim();
    const rawCountry = (item.country || '').trim();
    const cityEs = CITY_ES[rawCity] ? `${CITY_ES[rawCity]}` : rawCity;
    const countryEs = COUNTRY_ES[rawCountry] || rawCountry || 'Internacional';
    const linksCount = Number(item.links_count) || 50;

    map.set(iata, {
      iata,
      name: (item.name || `${cityEs} Airport`).trim(),
      city: cityEs || iata,
      country: countryEs,
      popularity: (countryEs === 'España' ? 5000 : 100) + linksCount,
    });
  }

  // 3. Aplicar overrides destacados (códigos metropolitanos y aeropuertos españoles clave)
  for (const feat of FEATURED_OVERRIDES) {
    map.set(feat.iata, feat);
  }

  const allAirports = Array.from(map.values()).sort((a, b) => b.popularity - a.popularity);
  const seedFilePath = path.join(__dirname, 'airports-seed.json');
  fs.writeFileSync(seedFilePath, JSON.stringify(allAirports, null, 2), 'utf8');
  console.log(`Guardado ${allAirports.length} aeropuertos IATA en ${seedFilePath}`);

  const prisma = new PrismaClient();
  try {
    console.log('Creando tabla Airport en PostgreSQL si no existe...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Airport" (
        "iata" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "city" TEXT NOT NULL,
        "country" TEXT NOT NULL,
        "popularity" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Airport_pkey" PRIMARY KEY ("iata")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Airport_city_idx" ON "Airport"("city");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Airport_country_idx" ON "Airport"("country");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Airport_popularity_idx" ON "Airport"("popularity" DESC);`);

    console.log('Insertando aeropuertos en PostgreSQL por lotes...');
    const batchSize = 500;
    for (let i = 0; i < allAirports.length; i += batchSize) {
      const batch = allAirports.slice(i, i + batchSize);
      const valuesSql = batch
        .map(a => {
          const esc = s => String(s).replace(/'/g, "''");
          return `('${esc(a.iata)}', '${esc(a.name)}', '${esc(a.city)}', '${esc(a.country)}', ${Number(a.popularity) || 0})`;
        })
        .join(', ');

      await prisma.$executeRawUnsafe(`
        INSERT INTO "Airport" ("iata", "name", "city", "country", "popularity")
        VALUES ${valuesSql}
        ON CONFLICT ("iata") DO UPDATE SET
          "name" = EXCLUDED."name",
          "city" = EXCLUDED."city",
          "country" = EXCLUDED."country",
          "popularity" = EXCLUDED."popularity";
      `);
    }

    const countResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS total FROM "Airport";`);
    console.log('Total de aeropuertos IATA en PostgreSQL:', countResult[0]?.total);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
