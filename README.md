# The Law Society Web Scraper

A highly configurable, production-ready web scraper for extracting business listings from directory websites. Built with TypeScript, Puppeteer, and Crawlee with advanced bot detection avoidance.

## So, why this setup?

The following was already tested and deployed in the following platforms:

- Apify (via Docker setup)
- Azure
- GCP

The website has an advanced bot detection logic where it successfully determine the common IP addresses of these platforms. Thus, in order to replicate human behavior, a locally ran setup bypasses these restrictions, along with human-like behaviors, random mouse clicks, and more. (see Feature)

## Features

- **Advanced Bot Detection Avoidance**
  - Browser fingerprinting with realistic profiles
  - Human-like mouse movements and scrolling
  - Variable request delays with jitter
  - Session rotation after configurable requests
  - reCAPTCHA Enterprise solving with 2Captcha integration (optional)

- **Resilient Scraping**
  - Automatic checkpointing and resume capability
  - Incremental data saving (no data loss)
  - Configurable retry logic
  - Graceful shutdown handling

- **Production Ready**
  - OneDrive integration for automatic uploads
  - Real-time Excel file updates
  - Batch uploading to avoid API rate limits
  - Comprehensive error logging

- **Data Management**
  - Excel export with two sheets (all results + filtered)
  - Email extraction and validation
  - Duplicate detection and merging
  - Data analytics and reporting tools

## Quick Start

### Installation

```bash
npm install
```

### Configuration

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Configure your settings in `.env`:

```env
# Organization Branding
COMPANY_NAME=Your Organization Name

# Search Configuration
SEARCH_RADIUS=10

# Scraper Settings
MAX_REQUESTS_PER_CRAWL=3000
REQUEST_DELAY_MS=30000
REQUEST_DELAY_JITTER_MS=15000

# Anti-bot Settings
REQUESTS_PER_SESSION=5
SESSION_ROTATION_DELAY_MS=60000

# Optional: OneDrive Upload (for production)
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=common
AZURE_REFRESH_TOKEN=your-refresh-token
```

### Running the Scraper

```bash
# Development mode (saves locally)
npm start

# Production mode (uploads to OneDrive)
APP_ENV=production npm start

# Build for deployment
npm run build
npm run start:prod
```

## Checkpoint System

The scraper automatically saves progress. To resume from a specific location:

```bash
export LOCATION_START_INDEX=500
npm start
```

This will skip the first 500 locations and continue from index 500.

## Data Output

### Excel Files

The scraper generates Excel files with two sheets:

1. **Full Results**: All scraped businesses
2. **With Emails**: Only businesses with valid email addresses

Files are saved to:

- **Development**: `./temp/scraper_output_*.xlsx`
- **Production**: Automatically uploaded to OneDrive

### Analytics Tools

```bash
# Merge multiple Excel files and remove duplicates
npm run merge-excel

# Analyze the masterlist for insights
npm run analyze-masterlist
```

## Customization

### Adding New Search Locations

Edit `src/all-valid-locations.json`:

```json
[
  {
    "locationId": "city-name",
    "locationText": "City Name"
  }
]
```

### Configuring Search Categories

Edit `src/config/search/search-filters.ts`:

```typescript
export const LEGAL_ISSUES: Record<string, LegalIssueCode> = {
  CATEGORY_GROUP: {
    "Category Name": "CATEGORY_CODE",
  },
};
```

### Customizing Excel Columns

Edit `src/services/excel/excel-service.ts`:

```typescript
const COLUMNS = [
  { header: "Column Name", key: "propertyKey", width: 30 },
  // Add more columns...
];
```

## Project Structure

```
src/
├── config/           # Configuration files
│   ├── email/        # Email validation rules
│   └── search/       # Search filters and categories
├── scrapers/         # Core scraping logic
├── services/         # External services (Excel, OneDrive)
│   ├── excel/        # Excel generation and management
│   └── onedrive/     # OneDrive upload integration
├── types/            # TypeScript type definitions
├── util/             # Utility functions
│   └── email/        # Email extraction and validation
└── main.ts           # Application entry point

scripts/
├── merge-excel-files.ts     # Merge and deduplicate tool
├── analyze-masterlist.ts    # Data analysis tool
├── oauth-server.ts          # Access / Refresh Token / Drive ID
├── run-all-scrapers.sh      # Executes all scrapers (with legal issue)
├── stop-all-scrapers.sh     # Terminates all running scrapers
└── verify-masterlist.sh     # Quick verification script
```

## Advanced Configuration

### Proxy Support

```env
USE_PROXY=true
PROXY_URL=http://your-proxy:port

# Or use Apify residential proxies (when on Apify platform)
USE_PROXY=true
# PROXY_URL left empty = use Apify proxies
```

Apify was already tested. However, feel free to contribute any ways to make this feature work!

### CAPTCHA Solving

For sites with reCAPTCHA protection:

```env
CAPTCHA_API_KEY=your-2captcha-api-key
```

Get an API key from [2Captcha](https://2captcha.com/)

> [!TIP]
> This is optional. The bot works normally without this.

### OneDrive Setup

1. Create an Azure AD application
2. Add Microsoft Graph API permissions
3. Generate client credentials
4. Obtain refresh token using OAuth flow

See Azure documentation for detailed setup instructions.

## Performance Tips

1. **Adjust delays** based on target website tolerance
2. **Use checkpoints** to resume long scraping sessions
3. **Enable proxies** if IP blocking occurs
4. **Increase session rotation delay** if bot detection occurs
5. **Monitor logs** for patterns in blocks or errors

## Troubleshooting

### Bot Detection Issues

- Increase `REQUEST_DELAY_MS` and `SESSION_ROTATION_DELAY_MS`
- Enable proxy with `USE_PROXY=true`
- Add `CAPTCHA_API_KEY` for automatic solving
- Reduce `REQUESTS_PER_SESSION` to 3-5

### Data Quality Issues

- Review email blacklist/whitelist in `src/config/email/`
- Adjust validation rules in `src/util/email/email-validator.ts`
- Check scraping logic in `src/scrapers/solicitor-scraper.ts`

### OneDrive Upload Failures

- Verify Azure credentials are correct
- Check refresh token hasn't expired
- Ensure sufficient OneDrive storage
- Review network/firewall settings

## Development

### Building

```bash
npm run build
```

Output in `dist/` directory

### Code Formatting

This project uses Prettier for code formatting with automatic import sorting:

```bash
# Format all files
npm run format

# Check if files are formatted
npm run format:check
```

**Editor Setup**: Install the Prettier extension for your editor. The project includes VSCode settings for automatic formatting on save.

### Type Checking

TypeScript strict mode is enabled. All code must pass type checking.

### Debugging

Enable debug logging:

```env
LOG_LEVEL=debug
```

## Use Cases

This scraper can be adapted for various directory websites:

- Legal service directories
- Healthcare provider listings
- Real estate agent directories
- Business directories
- Professional service listings
- Local business directories

## Requirements

- Node.js 18+
- TypeScript 5.9+
- 2GB+ RAM recommended
- Chromium (installed automatically by Puppeteer)

## License

MIT License - see [LICENSE](LICENSE) file for details

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

- Open an issue for bug reports or feature requests
- Check existing issues before creating new ones
- Provide detailed information and reproduction steps

## Acknowledgments

Built with:

- [Crawlee](https://crawlee.dev/) - Web scraping framework
- [Puppeteer](https://pptr.dev/) - Browser automation
- [ExcelJS](https://github.com/exceljs/exceljs) - Excel file generation
- [Microsoft Graph](https://learn.microsoft.com/en-us/graph/) - OneDrive integration

---

**Note**: Always respect website terms of service and robots.txt. Use responsibly and ethically.
