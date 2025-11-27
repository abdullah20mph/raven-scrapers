import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Scrape Dice.fm events page
 */
async function scrapeDiceEvents(city, category) {
  // Example URL: https://dice.fm/browse/new_york-5bbf4db0f06331478e9b2c59/music/party
  const url = `https://dice.fm/browse/${city}/music/${category}`;
  
  console.log('🎲 Dice.fm Events Scraper\n');
  console.log('='.repeat(50) + '\n');
  console.log(`🚀 Launching browser...`);
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
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
    
    console.log('🌐 Loading Dice.fm page...');
    
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    console.log('✅ Page loaded successfully!');
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🔍 Extracting HTML and event data...\n');
    
    // Save the full HTML
    const html = await page.content();
    const htmlFilename = 'dice_page.html';
    fs.writeFileSync(htmlFilename, html);
    console.log(`📄 HTML saved to ${htmlFilename} (${(html.length / 1024).toFixed(1)} KB)\n`);
    
    // Take a screenshot
    await page.screenshot({ path: 'dice_page_screenshot.png', fullPage: false });
    console.log(`📸 Screenshot saved to dice_page_screenshot.png\n`);
    
    // Extract event data from the page
    const events = await page.evaluate(() => {
      const eventsArray = [];
      
      // Method 1: Try to find Next.js data or similar
      const scripts = document.querySelectorAll('script');
      let foundData = false;
      
      scripts.forEach(script => {
        const content = script.textContent;
        if (content && (content.includes('__NEXT_DATA__') || content.includes('window.__INITIAL'))) {
          console.log('Found embedded data script');
          foundData = true;
        }
      });
      
      // Method 2: Parse visible event cards/elements
      // Try multiple possible selectors for Dice.fm events
      const possibleSelectors = [
        '[data-testid*="event"]',
        '[class*="event-card"]',
        '[class*="EventCard"]',
        'article',
        'a[href*="/event/"]',
        '[class*="card"]'
      ];
      
      let eventElements = [];
      for (const selector of possibleSelectors) {
        eventElements = document.querySelectorAll(selector);
        if (eventElements.length > 0) {
          console.log(`Found ${eventElements.length} elements with selector: ${selector}`);
          break;
        }
      }
      
      // Extract information from each event element
      eventElements.forEach((el, index) => {
        try {
          // Try to find event title
          const titleSelectors = [
            'h1', 'h2', 'h3', 'h4',
            '[class*="title"]',
            '[class*="Title"]',
            '[class*="name"]',
            '[class*="Name"]'
          ];
          
          let title = null;
          for (const sel of titleSelectors) {
            const titleEl = el.querySelector(sel);
            if (titleEl && titleEl.textContent.trim()) {
              title = titleEl.textContent.trim();
              break;
            }
          }
          
          // Try to find venue
          const venueSelectors = [
            '[class*="venue"]',
            '[class*="Venue"]',
            '[class*="location"]',
            '[class*="Location"]'
          ];
          
          let venue = null;
          for (const sel of venueSelectors) {
            const venueEl = el.querySelector(sel);
            if (venueEl && venueEl.textContent.trim()) {
              venue = venueEl.textContent.trim();
              break;
            }
          }
          
          // Try to find date
          const dateSelectors = [
            'time',
            '[datetime]',
            '[class*="date"]',
            '[class*="Date"]'
          ];
          
          let date = null;
          for (const sel of dateSelectors) {
            const dateEl = el.querySelector(sel);
            if (dateEl) {
              date = dateEl.getAttribute('datetime') || dateEl.textContent.trim();
              break;
            }
          }
          
          // Try to find price
          const priceSelectors = [
            '[class*="price"]',
            '[class*="Price"]',
            '[class*="cost"]'
          ];
          
          let price = null;
          for (const sel of priceSelectors) {
            const priceEl = el.querySelector(sel);
            if (priceEl && priceEl.textContent.trim()) {
              price = priceEl.textContent.trim();
              break;
            }
          }
          
          // Get the link/URL
          let url = null;
          if (el.tagName === 'A') {
            url = el.href;
          } else {
            const link = el.querySelector('a');
            if (link) url = link.href;
          }
          
          // Only add if we found at least a title
          if (title || url) {
            eventsArray.push({
              id: index,
              title: title || 'Unknown',
              venue: venue,
              date: date,
              price: price,
              url: url,
              rawHTML: el.outerHTML.substring(0, 500) // First 500 chars for debugging
            });
          }
        } catch (e) {
          console.error('Error parsing event:', e.message);
        }
      });
      
      return eventsArray;
    });
    
    console.log('='.repeat(50) + '\n');
    console.log(`📊 Found ${events.length} events!\n`);
    
    if (events.length > 0) {
      console.log('Sample Events:\n');
      events.slice(0, 5).forEach((event, i) => {
        console.log(`${i + 1}. ${event.title}`);
        if (event.venue) console.log(`   📍 ${event.venue}`);
        if (event.date) console.log(`   📅 ${event.date}`);
        if (event.price) console.log(`   💰 ${event.price}`);
        if (event.url) console.log(`   🔗 ${event.url}`);
        console.log('');
      });
      
      if (events.length > 5) {
        console.log(`... and ${events.length - 5} more events\n`);
      }
    }
    
    // Save events to JSON
    const jsonFilename = 'dice_events.json';
    fs.writeFileSync(jsonFilename, JSON.stringify(events, null, 2));
    console.log('='.repeat(50));
    console.log(`\n💾 Saved ${events.length} events to ${jsonFilename}`);
    
    return events;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await browser.close();
    console.log('\n🔒 Browser closed.');
  }
}

// ========== MAIN ==========

async function main() {
  try {
    // City ID for New York: new_york-5bbf4db0f06331478e9b2c59
    const cityId = 'new_york-5bbf4db0f06331478e9b2c59';
    const category = 'party'; // Options: party, gigs, dj, comedy, etc.
    
    const events = await scrapeDiceEvents(cityId, category);
    
    console.log('\n✅ Scraping complete!');
    console.log(`\nNext steps:`);
    console.log(`1. Check dice_page.html to see the full page structure`);
    console.log(`2. Check dice_page_screenshot.png to see what was loaded`);
    console.log(`3. Review dice_events.json to see extracted events`);
    console.log(`4. Adjust selectors if needed based on the HTML structure\n`);
    
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
  }
}

main();

