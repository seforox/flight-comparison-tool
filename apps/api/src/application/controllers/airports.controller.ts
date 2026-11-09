import { Controller, Get, Param, Query, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

export interface AirportRecord {
  iata: string;
  name: string;
  city: string;
  country: string;
  popularity: number;
}

@Controller('airports')
export class AirportsController implements OnModuleInit {
  private readonly logger = new Logger(AirportsController.name);
  private totalCount = 0;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureTableAndSeed();
    } catch (error: any) {
      this.logger.warn(`No se pudo verificar/sembrar la tabla Airport al iniciar: ${error.message}`);
    }
  }

  private async ensureTableAndSeed() {
    await this.prisma.$executeRawUnsafe(`
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

    const countRes = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "Airport"`,
    );
    const currentCount = Number(countRes?.[0]?.count || 0);
    this.totalCount = currentCount;

    if (currentCount > 0) {
      this.logger.log(`Tabla Airport lista con ${currentCount} aeropuertos IATA.`);
      return;
    }

    const seedCandidates = [
      path.join(process.cwd(), 'prisma', 'airports-seed.json'),
      path.join(__dirname, '..', '..', '..', 'prisma', 'airports-seed.json'),
    ];
    const seedPath = seedCandidates.find((p) => fs.existsSync(p));
    if (!seedPath) {
      this.logger.warn('No se encontró prisma/airports-seed.json para autosembrar Airport.');
      return;
    }

    this.logger.log(`Sembrando aeropuertos IATA desde ${seedPath}...`);
    const airports: AirportRecord[] = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const batchSize = 500;
    for (let i = 0; i < airports.length; i += batchSize) {
      const batch = airports.slice(i, i + batchSize);
      const valuesSql = batch
        .map((a) => {
          const esc = (s: string) => String(s || '').replace(/'/g, "''");
          return `('${esc(a.iata)}', '${esc(a.name)}', '${esc(a.city)}', '${esc(a.country)}', ${Number(a.popularity) || 0})`;
        })
        .join(',\n');

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "Airport" ("iata", "name", "city", "country", "popularity")
        VALUES ${valuesSql}
        ON CONFLICT ("iata") DO NOTHING;
      `);
    }
    this.totalCount = airports.length;
    this.logger.log(`Sembrados ${airports.length} aeropuertos IATA en PostgreSQL.`);
  }

  @Get()
  async searchAirports(
    @Query('q') q?: string,
    @Query('limit') limitStr?: string,
  ): Promise<{ total: number; items: AirportRecord[] }> {
    const limit = Math.min(Math.max(parseInt(limitStr || '60', 10) || 60, 1), 200);
    const query = (q || '').trim();

    if (!this.totalCount) {
      const countRes = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM "Airport"`,
      );
      this.totalCount = Number(countRes?.[0]?.count || 0);
    }

    if (!query) {
      const items = await this.prisma.$queryRawUnsafe<AirportRecord[]>(
        `SELECT "iata", "name", "city", "country", "popularity"
         FROM "Airport"
         ORDER BY "popularity" DESC, "city" ASC
         LIMIT $1`,
        limit,
      );
      return { total: this.totalCount, items };
    }

    const likePattern = `%${query}%`;
    const prefixPattern = `${query}%`;
    const exactUpper = query.toUpperCase();

    const items = await this.prisma.$queryRawUnsafe<AirportRecord[]>(
      `SELECT "iata", "name", "city", "country", "popularity"
       FROM "Airport"
       WHERE "iata" ILIKE $1
          OR "city" ILIKE $1
          OR "name" ILIKE $1
          OR "country" ILIKE $1
       ORDER BY
         CASE
           WHEN UPPER("iata") = $2 THEN 0
           WHEN UPPER("iata") LIKE UPPER($3) THEN 1
           WHEN LOWER("city") LIKE LOWER($3) THEN 2
           WHEN LOWER("country") LIKE LOWER($3) THEN 3
           ELSE 4
         END ASC,
         "popularity" DESC,
         "city" ASC
       LIMIT $4`,
      likePattern,
      exactUpper,
      prefixPattern,
      limit,
    );

    return { total: this.totalCount, items };
  }

  @Get(':iata')
  async getByIata(@Param('iata') iata: string): Promise<AirportRecord | null> {
    const code = (iata || '').trim().toUpperCase();
    if (!code) return null;

    const rows = await this.prisma.$queryRawUnsafe<AirportRecord[]>(
      `SELECT "iata", "name", "city", "country", "popularity"
       FROM "Airport"
       WHERE UPPER("iata") = $1
       LIMIT 1`,
      code,
    );

    return rows?.[0] || null;
  }
}
