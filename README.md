# 🎵 Raven Scrapers - Event Scrapers for Electronic Music

Powerful Node.js scrapers for fetching event listings from multiple platforms:
- 🎵 [Resident Advisor (ra.co)](https://ra.co)
- 🎲 [Dice.fm](https://dice.fm)

All scrapers use Puppeteer with stealth mode to bypass bot detection.

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
  - [Resident Advisor Scraper](#resident-advisor-scraper)
  - [Dice.fm Scraper](#dicefm-scraper)
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

### Resident Advisor Scraper

#### 1. Basic Event List Scraping

Get a list of events with basic information from Resident Advisor:

```bash
node ra_stealth_scraper.mjs
```

This will:
- Scrape the NYC events page for the next 7 days
- Extract basic event info (title, date, venue, artists, interested count)
- Save results to `ra_events_[dates].json`

#### 2. Detailed Event Scraping

Get detailed information by visiting each RA event page:

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

---

### Dice.fm Scraper

#### 1. Basic Event List Scraping

Get a list of events from Dice.fm:

```bash
node dice_scraper.mjs
```

This will:
- Scrape the NYC events page on Dice.fm
- Extract event names, venues, dates, prices, and URLs
- Handle infinite scroll to load all events
- Save results to `dice_events.json`

**Example Output:**
```
🎲 Dice.fm Events Scraper
==================================================
🚀 Launching browser...
🌐 Navigating to Dice.fm NYC events...
📜 Scrolling to load all events...
✅ Extracted 24 unique events

💾 Saved events to dice_events.json
```

#### 2. Detailed Event Scraping

Get detailed information from each Dice.fm event page:

```bash
node dice_detailed_scraper.mjs
```

This will:
- Read the existing `dice_events.json` file
- Visit each event URL (first 5 by default)
- Extract comprehensive details including:
  - Full description
  - Genres and event type
  - Age restrictions (21+, 18+, etc.)
  - Promoter/organizer
  - Start and end times
  - Full venue address with coordinates
  - High-quality flyer images
  - Ticket types with pricing and availability
  - Social media links
  - Structured JSON-LD data
- Save full HTML for each event
- Create enhanced JSON with all details

**Example Output:**
```
🎲 Dice.fm Event Details Scraper
==================================================
📂 Reading dice_events.json...
✅ Loaded 48 event entries
📊 Found 24 unique events after deduplication
🧪 Testing with first 5 events

[1/5] AFROBEATS HAPPY HOUR
   🌐 Loading https://dice.fm/event/xe7m83...
   🔍 Extracting detailed data...
   ✅ Extracted!
      Genres: Party, Brooklyn
      Age: 21+
      Promoter: ACOUSTIK GARDEN LOUNGE

💾 Saved 5 detailed events to dice_events_detailed.json
📁 HTML files saved in dice_event_htmls/ directory
```

## 📊 Output Format

### Resident Advisor - Basic Event Data

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

### Resident Advisor - Detailed Event Data

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

### Dice.fm - Basic Event Data

```json
{
  "id": 0,
  "title": "AFROBEATS HAPPY HOUR",
  "venue": "Acoustik Garden Lounge",
  "date": "Wed, Nov 26",
  "price": "$11.33",
  "url": "https://dice.fm/event/xe7m83-afrobeats-happy-hour-...",
  "rawHTML": "<div class=\"EventCard__Event-sc-5ea8797e-1...>"
}
```

### Dice.fm - Detailed Event Data

```json
{
  "id": 0,
  "title": "AFROBEATS HAPPY HOUR",
  "...": "... basic info ...",
  "detailedInfo": {
    "description": "Experience a refined mid-week escape...",
    "genres": ["Party", "Brooklyn"],
    "artists": [],
    "ageRestriction": "21+",
    "promoter": "ACOUSTIK GARDEN LOUNGE",
    "startTime": "2025-11-26T21:00:00-05:00",
    "endTime": "2025-11-27T02:00:00-05:00",
    "addressDetails": "1515 Atlantic Avenue, Brooklyn, NY...",
    "latitude": 40.678037,
    "longitude": -73.938831,
    "imageUrl": "https://dice-media.imgix.net/...",
    "ticketTypes": [
      {
        "price": "11.33",
        "currency": "USD",
        "availability": "https://schema.org/InStock",
        "validFrom": "2025-11-23T17:30:00-05:00"
      }
    ],
    "socialLinks": {
      "instagram": "https://instagram.com/dicefm"
    },
    "structuredData": {...},
    "htmlSaved": "dice_event_htmls/event_0.html"
  }
}
```

## 🔧 Customization

### Resident Advisor - Change City/Area

Edit the area slug in `ra_stealth_scraper.mjs`:

```javascript
// Examples:
scrapeRAEvents('us/newyorkcity', startDate, endDate)  // NYC
scrapeRAEvents('uk/london', startDate, endDate)       // London
scrapeRAEvents('de/berlin', startDate, endDate)       // Berlin
scrapeRAEvents('es/barcelona', startDate, endDate)    // Barcelona
scrapeRAEvents('jp/tokyo', startDate, endDate)        // Tokyo
```

### Resident Advisor - Change Date Range

```javascript
const today = new Date().toISOString().split('T')[0];
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Or set specific dates:
const startDate = '2025-12-01';
const endDate = '2025-12-31';
```

### Dice.fm - Change City

Edit the URL in `dice_scraper.mjs`:

```javascript
// Examples:
const url = 'https://dice.fm/events/new-york-city';  // NYC
const url = 'https://dice.fm/events/london';         // London
const url = 'https://dice.fm/events/berlin';         // Berlin
const url = 'https://dice.fm/events/los-angeles';    // LA
const url = 'https://dice.fm/events/chicago';        // Chicago
```

### Process All Events (Not Just First 5)

In `scrape_event_details.mjs` or `dice_detailed_scraper.mjs`, change:

```javascript
// From:
const testEvents = events.slice(0, 5);

// To:
const testEvents = events;  // Process all events
```

## 📁 Project Structure

```
raven-scrapers/
├── ra_stealth_scraper.mjs      # RA: Main scraper for event lists
├── scrape_event_details.mjs    # RA: Detailed scraper for individual events
├── dice_scraper.mjs            # Dice.fm: Main scraper for event lists
├── dice_detailed_scraper.mjs   # Dice.fm: Detailed scraper for individual events
├── package.json                # Project dependencies
├── .gitignore                  # Git ignore rules
├── README.md                   # This file
├── event_htmls/                # RA generated HTML files (gitignored)
├── dice_event_htmls/           # Dice.fm generated HTML files (gitignored)
├── ra_events_*.json           # RA generated JSON files (gitignored)
└── dice_events*.json          # Dice.fm generated JSON files (gitignored)
```

## 🔍 How It Works

### Resident Advisor Scraper

1. **Stealth Mode**: Uses `puppeteer-extra-plugin-stealth` to mask Puppeteer as a real browser, bypassing RA.co's anti-bot detection.

2. **Full Page Load**: Waits for JavaScript to execute completely, ensuring all dynamic content is loaded.

3. **Data Extraction**: Parses the `__NEXT_DATA__` script tag containing event data in Apollo GraphQL state format.

4. **Detailed Scraping**: For each event, opens the page, extracts lineup/genres/cost/promoters, saves full HTML, and builds comprehensive records.

### Dice.fm Scraper

1. **Stealth Mode**: Uses `puppeteer-extra-plugin-stealth` to avoid Dice.fm's bot detection.

2. **Infinite Scroll**: Automatically scrolls to load all events on the page using a virtual scroller.

3. **Event Card Extraction**: Extracts event data directly from the visible DOM elements.

4. **Detailed Scraping**: For each event:
   - Parses JSON-LD structured data (schema.org format) for clean, structured information
   - Extracts additional details from the page (genres, age restrictions, social links)
   - Saves full HTML for each event
   - Builds comprehensive event records with timestamps, coordinates, and ticket info

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
- [Dice.fm](https://dice.fm) for making event discovery easy
- [Puppeteer](https://pptr.dev/) for browser automation
- [puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth) for stealth capabilities

---

**Made with ❤️ for the electronic music community**

