import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Fetch RA events by scraping the HTML page
 */
async function scrapeRAEvents(areaSlug, startDate, endDate) {
  const url = `https://ra.co/events/${areaSlug}?startDate=${startDate}&endDate=${endDate}`;
  
  console.log(`🚀 Launching stealth browser...`);
  console.log(`📍 URL: ${url}\n`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Additional headers to look more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });
    
    console.log('🌐 Loading page...');
    
    // Navigate with a more patient wait strategy
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    console.log('✅ Page loaded successfully!');
    
    // Wait a bit more for JavaScript to fully execute
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🔍 Extracting events from HTML...\n');
    
    // Extract events from the page
    const events = await page.evaluate(() => {
      const eventsArray = [];
      
      // Method 1: Try to get data from Next.js __NEXT_DATA__ script
      const nextDataScript = document.getElementById('__NEXT_DATA__');
      
      if (nextDataScript) {
        try {
          const data = JSON.parse(nextDataScript.textContent);
          const apolloState = data.props?.apolloState;  // Fixed path!
          
          if (apolloState) {
            // Extract all Event objects from Apollo state
            Object.keys(apolloState).forEach(key => {
              if (key.startsWith('Event:')) {
                const event = apolloState[key];
                
                // Resolve venue reference
                let venueName = 'Unknown';
                if (event.venue && event.venue.__ref) {
                  const venueData = apolloState[event.venue.__ref];
                  venueName = venueData?.name || 'Unknown';
                }
                
                // Resolve artist references
                const artists = [];
                if (event.artists && Array.isArray(event.artists)) {
                  event.artists.forEach(artistRef => {
                    if (artistRef.__ref) {
                      const artistData = apolloState[artistRef.__ref];
                      if (artistData?.name) artists.push(artistData.name);
                    }
                  });
                }
                
                eventsArray.push({
                  id: event.id,
                  title: event.title,
                  date: event.date,
                  startTime: event.startTime || null,
                  endTime: event.endTime || null,
                  venue: venueName,
                  artists: artists,
                  url: event.contentUrl ? `https://ra.co${event.contentUrl}` : null,
                  interestedCount: event.interestedCount || 0,
                  isTicketed: event.isTicketed || false
                });
              }
            });
            
            return eventsArray;
          }
        } catch (e) {
          console.error('Error parsing Next.js data:', e.message);
        }
      }
      
      // Method 2: Fallback - parse visible HTML elements
      const eventElements = document.querySelectorAll('li[class*="event"]');
      
      eventElements.forEach((el, index) => {
        try {
          const titleEl = el.querySelector('h3, [class*="title"]');
          const venueEl = el.querySelector('[class*="venue"]');
          const dateEl = el.querySelector('time, [class*="date"]');
          const linkEl = el.querySelector('a');
          
          if (titleEl && titleEl.textContent.trim()) {
            eventsArray.push({
              id: `html-${index}`,
              title: titleEl.textContent.trim(),
              date: dateEl?.getAttribute('datetime') || dateEl?.textContent.trim() || 'Unknown',
              venue: venueEl?.textContent.trim() || 'Unknown',
              artists: [],
              url: linkEl?.href || null,
              interestedCount: 0,
              isTicketed: false
            });
          }
        } catch (e) {
          // Skip this element
        }
      });
      
      return eventsArray;
    });

    // Save HTML for debugging
    const html = await page.content();
    fs.writeFileSync('ra_scraped_page.html', html);
    console.log(`📄 HTML saved (${(html.length / 1024).toFixed(1)} KB)\n`);

    return events;

  } finally {
    await browser.close();
    console.log('🔒 Browser closed.\n');
  }
}

// ========== MAIN ==========

async function main() {
  console.log('🎵 Resident Advisor Events Scraper (Stealth Mode)\n');
  console.log('='.repeat(50) + '\n');

  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const events = await scrapeRAEvents('us/newyorkcity', today, nextWeek);
    
    console.log(`📊 Found ${events.length} events!\n`);

    if (events.length > 0) {
      console.log('='.repeat(50) + '\n');
      
      // Show first 10 events
      events.slice(0, 10).forEach((event, i) => {
        console.log(`${i + 1}. 🎪 ${event.title}`);
        console.log(`   📅 ${event.date}`);
        console.log(`   📍 ${event.venue}`);
        if (event.artists && event.artists.length > 0) {
          console.log(`   🎤 ${event.artists.join(', ')}`);
        }
        if (event.interestedCount > 0) {
          console.log(`   ❤️  ${event.interestedCount} interested`);
        }
        if (event.url) {
          console.log(`   🔗 ${event.url}`);
        }
        console.log('');
      });
      
      if (events.length > 10) {
        console.log(`... and ${events.length - 10} more events\n`);
      }

      // Save to JSON file
      const filename = `ra_events_${today}_to_${nextWeek}.json`;
      fs.writeFileSync(filename, JSON.stringify(events, null, 2));
      
      console.log('='.repeat(50));
      console.log(`\n💾 Saved ${events.length} events to ${filename}`);
      console.log(`\n✅ Success! The scraper is working!`);
    } else {
      console.log('⚠️  No events found. The page might still be blocking us.');
      console.log('Check ra_scraped_page.html to see what was loaded.');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nStack trace:', error.stack);
  }
}

main();

