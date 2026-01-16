#!/bin/bash

# Stop all running scrapers
if [ -f .scraper-pids ]; then
    echo "Stopping all scrapers..."
    PIDS=$(cat .scraper-pids)
    kill $PIDS 2>/dev/null
    echo "Scrapers stopped"
    rm .scraper-pids
else
    echo "No running scrapers found (.scraper-pids file missing)"
fi
