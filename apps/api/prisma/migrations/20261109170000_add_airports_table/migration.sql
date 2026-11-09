-- CreateTable
CREATE TABLE IF NOT EXISTS "Airport" (
    "iata" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("iata")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Airport_city_idx" ON "Airport"("city");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Airport_country_idx" ON "Airport"("country");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Airport_popularity_idx" ON "Airport"("popularity" DESC);
