/**
 * Vitest test setup file
 * Sets up global mocks and utilities
 */

// Mock Prisma client for unit tests
vi.mock("@/lib/prisma", () => ({
    prisma: {
        lead: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: "test-id" }),
            update: vi.fn().mockResolvedValue({ id: "test-id" }),
            count: vi.fn().mockResolvedValue(0),
        },
        user: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            findUnique: vi.fn().mockResolvedValue(null),
        },
        receipt: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue({ id: "test-receipt" }),
        },
        leadEvent: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue({ id: "test-event" }),
        },
        branch: {
            findFirst: vi.fn().mockResolvedValue({ id: "test-branch", name: "Test" }),
        },
        pushSubscription: {
            upsert: vi.fn().mockResolvedValue({ id: "test-sub" }),
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        $disconnect: vi.fn(),
    },
}));

// Mock environment variables
process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests";
process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.WEBHOOK_SECRET = "test-webhook-secret";
