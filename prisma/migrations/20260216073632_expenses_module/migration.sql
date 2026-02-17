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

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchExpenseDaily" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dateKey" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchExpenseDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchBaseSalary" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "baseSalaryVnd" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchBaseSalary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseInsight" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "dateKey" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payloadJson" JSONB,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseCategory_branchId_isActive_idx" ON "ExpenseCategory"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_branchId_name_key" ON "ExpenseCategory"("branchId", "name");

-- CreateIndex
CREATE INDEX "BranchExpenseDaily_branchId_dateKey_idx" ON "BranchExpenseDaily"("branchId", "dateKey");

-- CreateIndex
CREATE INDEX "BranchExpenseDaily_categoryId_idx" ON "BranchExpenseDaily"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchExpenseDaily_branchId_dateKey_categoryId_key" ON "BranchExpenseDaily"("branchId", "dateKey", "categoryId");

-- CreateIndex
CREATE INDEX "BranchBaseSalary_branchId_monthKey_idx" ON "BranchBaseSalary"("branchId", "monthKey");

-- CreateIndex
CREATE INDEX "BranchBaseSalary_monthKey_idx" ON "BranchBaseSalary"("monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "BranchBaseSalary_userId_monthKey_branchId_key" ON "BranchBaseSalary"("userId", "monthKey", "branchId");

-- CreateIndex
CREATE INDEX "ExpenseInsight_branchId_dateKey_idx" ON "ExpenseInsight"("branchId", "dateKey");

-- CreateIndex
CREATE INDEX "ExpenseInsight_monthKey_idx" ON "ExpenseInsight"("monthKey");

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchExpenseDaily" ADD CONSTRAINT "BranchExpenseDaily_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchExpenseDaily" ADD CONSTRAINT "BranchExpenseDaily_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchExpenseDaily" ADD CONSTRAINT "BranchExpenseDaily_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchBaseSalary" ADD CONSTRAINT "BranchBaseSalary_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchBaseSalary" ADD CONSTRAINT "BranchBaseSalary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseInsight" ADD CONSTRAINT "ExpenseInsight_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
