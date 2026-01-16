#!/bin/bash

# Each scraper handles a different legal issue and uploads to /Solicitors folder in OneDrive
# Feel free to change the OneDrive folder paths as needed

echo "Starting Solicitor Scraper..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Mental Capacity
echo "Starting Mental Capacity scraper..."
LEGAL_ISSUE_FILTER=LIUMCP \
ONEDRIVE_FOLDER_PATH="/Solicitors/Mental Capacity" \
CRAWLEE_STORAGE_DIR="./storage/mental-capacity" \
APP_ENV=production \
npm run start:dev > logs/mental-capacity.log 2>&1 &
MC_PID=$!
echo "  Mental Capacity scraper started (PID: $MC_PID)"

# Uncomment below to run an instance with LOCATION_START_INDEX for resuming from a specific point
# echo "Starting Social Welfare scraper..."
# LEGAL_ISSUE_FILTER=LIUSWB \
# ONEDRIVE_FOLDER_PATH="/Solicitors/Social Welfare" \
# CRAWLEE_STORAGE_DIR="./storage/social-welfare" \
# LOCATION_START_INDEX=776 \
# APP_ENV=production \
# npm run start:dev > logs/social-welfare.log 2>&1 &
# SW_PID=$!
# echo "  Social Welfare scraper started (PID: $SW_PID) - Resuming from Ollerton"

echo ""
echo "All scrapers are now running!"
echo ""
echo "Stop all scrapers:"
echo "  kill $MC_PID $SW_PID $WP_PID"
echo ""
echo "Process IDs saved to: .scraper-pids"
echo "$MC_PID $SW_PID $WP_PID" > .scraper-pids
