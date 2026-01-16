#!/bin/bash

# Quick verification script for the merged masterlist

echo "═══════════════════════════════════════════════════════════════"
echo "         MASTERLIST VERIFICATION SCRIPT"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if masterlist exists
MASTERLIST_DIR="./Masterlist Excel"

if [ ! -d "$MASTERLIST_DIR" ]; then
  echo " Masterlist Excel folder not found!"
  exit 1
fi

echo " Masterlist folder exists"

# Find latest masterlist file
LATEST_FILE=$(ls -t "$MASTERLIST_DIR"/Solicitors_Masterlist_*.xlsx 2>/dev/null | head -1)

if [ -z "$LATEST_FILE" ]; then
  echo " No masterlist Excel file found!"
  exit 1
fi

echo " Latest masterlist: $(basename "$LATEST_FILE")"

# Find report file
REPORT_FILE=$(ls -t "$MASTERLIST_DIR"/Merge_Report_*.txt 2>/dev/null | head -1)

if [ -n "$REPORT_FILE" ]; then
  echo " Report file: $(basename "$REPORT_FILE")"
  echo ""
  echo " Quick Stats from Report:"
  echo "─────────────────────────────────────────────────────────────"
  grep -E "Files Processed:|Total Rows Read:|Final Row Count:|Reduction:" "$REPORT_FILE" | sed 's/^/   /'
  echo ""
fi

# File size check
FILE_SIZE=$(du -h "$LATEST_FILE" | awk '{print $1}')
echo " File size: $FILE_SIZE"

# Get file timestamp
FILE_DATE=$(date -r "$LATEST_FILE" "+%Y-%m-%d %H:%M:%S")
echo "Generated: $FILE_DATE"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " Verification complete!"
echo ""
echo " To view the full report:"
echo "   cat \"$REPORT_FILE\""
echo ""
echo " To open the masterlist:"
echo "   open \"$LATEST_FILE\""
echo "═══════════════════════════════════════════════════════════════"
