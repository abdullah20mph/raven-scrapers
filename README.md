# 🎵 Raven Scrapers - Resident Advisor Events Scraper

A powerful Node.js scraper for fetching event listings from [Resident Advisor (ra.co)](https://ra.co) using Puppeteer with stealth mode to bypass bot detection.

## ✨ Features

- 🎭 **Stealth Mode**: Uses `puppeteer-extra-plugin-stealth` to avoid detection
- 🎵 **Complete Data**: Extracts event titles, dates, venues, artists, lineups, genres, and more
- 💾 **JSON Export**: Saves all events to structured JSON files
- 🌍 **Flexible**: Can scrape any city/area on RA
- 📄 **HTML Archival**: Saves full HTML for each event page
- 🔄 **Two-Step Process**: 
  1. Get list of events from area
  2. Scrape detailed info from each event page

## 📋 Table of Contents

- [Installation](#installation)
- [Usage](#usage)
  - [Basic Event Scraping](#basic-event-scraping)
  - [Detailed Event Scraping](#detailed-event-scraping)
- [Output Format](#output-format)
- [Customization](#customization)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Dependencies](#dependencies)
- [Notes](#notes)
- [License](#license)

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/abdullah20mph/raven-scrapers.git
cd raven-scrapers
```

2. Install dependencies:
```bash
npm install
```

## 📖 Usage

### Basic Event Scraping

Get a list of events with basic information:

```bash
node ra_stealth_scraper.mjs
```

This will:
- Scrape the NYC events page for the next 7 days
- Extract basic event info (title, date, venue, artists, interested count)
- Save results to `ra_events_[dates].json`

### Detailed Event Scraping

Get detailed information by visiting each event page:

```bash
node scrape_event_details.mjs
```

This will:
- Read the existing events JSON file
- Visit each event URL
- Extract detailed information (lineup, description, genres, cost, promoters, images)
- Save full HTML for each event
- Create enhanced JSON with all details

**Example Output:**
```
🎵 RA Event Details Scraper
==================================================
📂 Reading ra_events_2025-11-27_to_2025-12-04.json...
✅ Loaded 28 events
🧪 Testing with first 5 events

[1/5] Theo Parrish All Night
   🌐 Loading https://ra.co/events/2266788...
   🔍 Extracting data...
   ✅ Extracted! Genres: House, Techno

💾 Saved 5 detailed events to ra_events_detailed_sample.json
📁 HTML files saved in event_htmls/ directory
```

## 📊 Output Format

### Basic Event Data

```json
{
  "id": "2266788",
  "title": "Theo Parrish All Night",
  "date": "2025-11-28T00:00:00.000",
  "startTime": "2025-11-28T22:00:00.000",
  "endTime": "2025-11-29T06:00:00.000",
  "venue": "Nowadays",
  "artists": ["Theo Parrish"],
  "url": "https://ra.co/events/2266788",
  "interestedCount": 1097,
  "isTicketed": true
}
```

### Detailed Event Data

```json
{
  "id": "2266788",
  "title": "Theo Parrish All Night",
  "...": "... basic info ...",
  "detailedInfo": {
    "lineup": "Full event description and lineup details...",
    "description": "Additional event description...",
    "genres": ["House", "Techno", "Disco"],
    "cost": "$20+",
    "promoters": ["Nowadays"],
    "ticketInfo": "Ticket availability and pricing...",
    "imageUrl": "https://images.ra.co/...",
    "venueInfo": {
      "name": "Nowadays",
      "contentUrl": "/clubs/105873",
      "live": true
    },
    "htmlSaved": "event_htmls/event_2266788.html"
  }
}
```

## 🔧 Customization

### Change City/Area

Edit the area slug in the scraper files:

```javascript
// Examples:
scrapeRAEvents('us/newyorkcity', startDate, endDate)  // NYC
scrapeRAEvents('uk/london', startDate, endDate)       // London
scrapeRAEvents('de/berlin', startDate, endDate)       // Berlin
scrapeRAEvents('es/barcelona', startDate, endDate)    // Barcelona
scrapeRAEvents('jp/tokyo', startDate, endDate)        // Tokyo
```

### Change Date Range

```javascript
const today = new Date().toISOString().split('T')[0];
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Or set specific dates:
const startDate = '2025-12-01';
const endDate = '2025-12-31';
```

### Process All Events (Not Just First 5)

In `scrape_event_details.mjs`, change:

```javascript
// From:
const testEvents = events.slice(0, 5);

// To:
const testEvents = events;  // Process all events
```

## 📁 Project Structure

```
raven-scrapers/
├── ra_stealth_scraper.mjs      # Main scraper for event lists
├── scrape_event_details.mjs    # Detailed scraper for individual events
├── package.json                # Project dependencies
├── .gitignore                  # Git ignore rules
├── README.md                   # This file
├── event_htmls/                # Generated HTML files (gitignored)
└── ra_events_*.json           # Generated JSON files (gitignored)
```

## 🔍 How It Works

### 1. Stealth Mode
Uses `puppeteer-extra-plugin-stealth` to mask Puppeteer as a real browser, bypassing RA.co's anti-bot detection.

### 2. Full Page Load
Waits for JavaScript to execute completely, ensuring all dynamic content is loaded.

### 3. Data Extraction
Parses the `__NEXT_DATA__` script tag containing event data in Apollo GraphQL state format.

### 4. Detailed Scraping
For each event:
- Opens the event page
- Extracts lineup, genres, cost, promoters
- Saves full HTML for archival/debugging
- Builds comprehensive event records

## 📦 Dependencies

- **puppeteer** - Headless Chrome browser automation
- **puppeteer-extra** - Plugin framework for Puppeteer
- **puppeteer-extra-plugin-stealth** - Stealth plugin to avoid detection

## 📝 Notes

- ✅ No authentication or cookies required
- ✅ Respects RA.co's structure (uses official page data)
- ✅ Includes delays between requests to be respectful
- ⚠️ Large-scale scraping should be done responsibly
- ⚠️ HTML files and JSON outputs are gitignored by default

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC

## 🙏 Acknowledgments

- [Resident Advisor](https://ra.co) for being the best electronic music events platform
- [Puppeteer](https://pptr.dev/) for browser automation
- [puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth) for stealth capabilities

---

**Made with ❤️ for the electronic music community**

