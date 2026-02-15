-- Migrate legacy MarketingMetric(DAY) data into MarketingReport before removing legacy table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'MarketingMetric') THEN
    INSERT INTO "MarketingReport" (
      "id",
      "date",
      "dateKey",
      "branchId",
      "source",
      "spendVnd",
      "messages",
      "cplVnd",
      "metaJson",
      "createdAt",
      "updatedAt"
    )
    SELECT
      'legacy_metric_' || md5(random()::text || clock_timestamp()::text || m."dateKey" || m."source"),
      to_timestamp(m."dateKey" || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS'),
      m."dateKey",
      NULL,
      CASE WHEN m."source" = 'meta_ads' THEN 'meta' ELSE m."source" END,
      m."spendVnd",
      m."messages",
      ROUND(m."spendVnd"::numeric / GREATEST(m."messages", 1))::int,
      m."meta",
      m."createdAt",
      m."updatedAt"
    FROM "MarketingMetric" m
    WHERE m."grain" = 'DAY'
      AND NOT EXISTS (
        SELECT 1
        FROM "MarketingReport" r
        WHERE r."dateKey" = m."dateKey"
          AND r."branchId" IS NULL
          AND r."source" = CASE WHEN m."source" = 'meta_ads' THEN 'meta' ELSE m."source" END
      );
  END IF;
END $$;

DROP TABLE IF EXISTS "MarketingMetric";
DROP TYPE IF EXISTS "MarketingGrain";
