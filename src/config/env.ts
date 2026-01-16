import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const envSchema = z.object({
  // App Config (APP_ENV is just NODE_ENV; I just prefer APP_ENV)
  APP_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_DEBUG: z.boolean().default(false),
  TIMEZONE: z.string().default("Europe/London"),

  // Organization Branding
  COMPANY_NAME: z.string().default("Your Organization"),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_FILE_BASE_NAME: z.string().optional(),

  // Excel Output
  OUTPUT_EXCEL_FILE_BASE_NAME: z.string().default("solicitors"),
  OUTPUT_EXCEL_PREFIX_NAME: z.string().default("scraper_output_"),

  // OneDrive
  ONEDRIVE_FOLDER_PATH: z.string().default("/Solicitors"),

  // Azure (only required in production)
  AZURE_CLIENT_ID: z.string().default("placeholder"),
  AZURE_CLIENT_SECRET: z.string().default("placeholder"),
  AZURE_TENANT_ID: z.string().default("common"),
  AZURE_ONEDRIVE_DRIVE_ID: z.string().default("placeholder"),
  AZURE_ONEDRIVE_ITEM_ID: z.string().optional(),
  AZURE_ACCESS_TOKEN: z.string().default("placeholder"),
  AZURE_REFRESH_TOKEN: z.string().default("placeholder"),

  // Crawler
  MAX_REQUESTS_PER_CRAWL: z.coerce.number().default(3000), // Adjust as needed. This is per legal issue/location combination.
  REQUEST_DELAY_MS: z.coerce.number().default(30000), // 30 seconds minimum to avoid bot detection
  REQUEST_DELAY_JITTER_MS: z.coerce.number().default(15000), // Add random 0-15s jitter
  REQUEST_TIMEOUT_MS: z.coerce.number().default(10000),
  MAX_CRAWL_DEPTH: z.coerce.number().default(3),
  USER_AGENT_STRING: z
    .string()
    .default(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
    ),
  SEARCH_RADIUS: z.coerce.number().default(10), // Search radius in miles (1, 5, 10, or 25)

  // Checkpoint (resume from specific location index)
  LOCATION_START_INDEX: z.coerce.number().default(0),

  // Retry
  MAX_RETRY_ATTEMPTS: z.coerce.number().default(3),
  RETRY_DELAY_MS: z.coerce.number().default(1000),

  // Anti-Detection
  REQUESTS_PER_SESSION: z.coerce.number().default(5), // Rotate browser context after N requests
  SESSION_ROTATION_DELAY_MS: z.coerce.number().default(60000), // Wait 60s between sessions

  // Proxy
  USE_PROXY: z.coerce.boolean().default(false),
  PROXY_URL: z.string().optional(),
  PROXY_USERNAME: z.string().optional(),
  PROXY_PASSWORD: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("[ERROR] Invalid environment variables:", z.treeifyError(parsedEnv.error));
  process.exit(1);
}

export const env = parsedEnv.data;
