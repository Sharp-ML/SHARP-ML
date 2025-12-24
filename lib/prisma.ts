import { PrismaClient } from "@prisma/client";

// Production database URL patterns - these should NEVER be used in development
const PRODUCTION_DB_PATTERNS = [
  /\.neon\.tech/i,           // Neon production
  /\.supabase\.co/i,         // Supabase
  /\.railway\.app/i,         // Railway
  /\.render\.com/i,          // Render
  /\.aws\.com/i,             // AWS RDS
  /\.azure\.com/i,           // Azure
  /\.gcp\.com/i,             // Google Cloud
  /pooler\.supabase/i,       // Supabase pooler
];

// Development database URL patterns - safe for local development
const DEV_DB_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/i,
  /0\.0\.0\.0/i,
  /host\.docker\.internal/i,
  /-dev\./i,                 // Neon dev branches
  /_dev/i,                   // Dev database names
];

function isProductionDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  return PRODUCTION_DB_PATTERNS.some((pattern) => pattern.test(url));
}

function isDevelopmentDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  return DEV_DB_PATTERNS.some((pattern) => pattern.test(url));
}

function validateDatabaseUrl(): void {
  const databaseUrl = process.env.DATABASE_URL;
  const nodeEnv = process.env.NODE_ENV;
  const allowProdInDev = process.env.ALLOW_PROD_DB_IN_DEV === "true";

  // In development mode, BLOCK production database access
  if (nodeEnv !== "production") {
    if (isProductionDatabaseUrl(databaseUrl)) {
      if (allowProdInDev) {
        console.warn(
          "\n⚠️  WARNING: ALLOW_PROD_DB_IN_DEV is enabled - connecting to production database in development mode!\n" +
            "   This is DANGEROUS. Make sure you know what you're doing.\n"
        );
      } else {
        throw new Error(
          "\n🚫 DATABASE SAFETY ERROR: Attempting to connect to production database in development mode!\n\n" +
            "   Your DATABASE_URL appears to point to a production database.\n" +
            "   This is blocked for your safety.\n\n" +
            "   To fix this:\n" +
            "   1. Create a .env.development.local file with a LOCAL database URL\n" +
            "   2. Use: DATABASE_URL=\"postgresql://postgres:postgres@localhost:5432/apple_sharp_dev\"\n" +
            "   3. See docs/DATABASE-SAFETY.md for setup instructions\n\n" +
            "   If you MUST access production (dangerous!), set ALLOW_PROD_DB_IN_DEV=true\n"
        );
      }
    }

    // Warn if no DATABASE_URL is set
    if (!databaseUrl) {
      console.warn(
        "\n⚠️  WARNING: DATABASE_URL is not set. Database operations will fail.\n" +
          "   Create a .env.development.local file with your local database URL.\n"
      );
    }

    // Info log for dev database connection
    if (isDevelopmentDatabaseUrl(databaseUrl)) {
      console.log("✅ Connected to development database");
    }
  }

  // In production mode, warn if using a dev database (misconfiguration)
  if (nodeEnv === "production" && isDevelopmentDatabaseUrl(databaseUrl)) {
    console.warn(
      "\n⚠️  WARNING: Production environment appears to be using a development database URL!\n" +
        "   Check your DATABASE_URL environment variable.\n"
    );
  }
}

// Validate before creating the client
validateDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
