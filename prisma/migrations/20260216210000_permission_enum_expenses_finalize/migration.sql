DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PermissionAction') THEN
    BEGIN
      ALTER TYPE "PermissionAction" ADD VALUE 'EDIT';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE "PermissionAction" ADD VALUE 'INGEST';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PermissionModule') THEN
    BEGIN
      ALTER TYPE "PermissionModule" ADD VALUE 'expenses';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE "PermissionModule" ADD VALUE 'salary';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE "PermissionModule" ADD VALUE 'insights';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
