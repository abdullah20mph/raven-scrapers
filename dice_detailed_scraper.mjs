import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Scrape detailed information from a Dice.fm event page
 */
async function scrapeDiceEventDetails(page, eventUrl, eventId) {
  try {
    console.log(`   🌐 Loading ${eventUrl}...`);
    
    await page.goto(eventUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    // Wait for content to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log(`   🔍 Extracting detailed data...`);
    
    // Extract all detailed information
    const details = await page.evaluate(() => {
      const result = {
        description: null,
        lineup: null,
        genres: [],
        artists: [],
        eventType: null,
        imageUrl: null,
        ageRestriction: null,
        ticketTypes: [],
        promoter: null,
        addressDetails: null,
        doorTime: null,
        startTime: null,
        endTime: null,
        latitude: null,
        longitude: null,
        socialLinks: {},
        structuredData: null
      };
      
      // FIRST: Try to extract JSON-LD structured data (cleanest source!)
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      jsonLdScripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          if (data['@type'] === 'MusicEvent') {
            result.structuredData = data;
            
            // Extract clean data from JSON-LD
            result.description = data.description;
            result.imageUrl = Array.isArray(data.image) ? data.image[0] : data.image;
            result.startTime = data.startDate;
            result.endTime = data.endDate;
            
            if (data.location) {
              result.addressDetails = data.location.address;
              if (data.location.geo) {
                result.latitude = data.location.geo.latitude;
                result.longitude = data.location.geo.longitude;
              }
            }
            
            if (data.organizer) {
              result.promoter = data.organizer.name;
            }
            
            if (data.offers && Array.isArray(data.offers)) {
              result.ticketTypes = data.offers.map(offer => ({
                price: offer.price,
                currency: offer.priceCurrency,
                availability: offer.availability,
                validFrom: offer.validFrom
              }));
            }
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });
      
      // Try to get data from __NEXT_DATA__ or similar
      const nextDataScript = document.getElementById('__NEXT_DATA__');
      if (nextDataScript) {
        try {
          const data = JSON.parse(nextDataScript.textContent);
          
          // Dice.fm structure might be in data.props.pageProps or similar
          if (data.props) {
            const props = data.props;
            
            // Look for event data in various possible locations
            const searchForEventData = (obj, depth = 0) => {
              if (depth > 5) return;
              
              if (obj && typeof obj === 'object') {
                // Check if this looks like event data
                if (obj.name && obj.venue) {
                  result.description = obj.description || obj.about;
                  result.lineup = obj.lineup || obj.artists;
                  result.eventType = obj.eventType || obj.category;
                  result.ageRestriction = obj.ageRestriction;
                  result.doorTime = obj.doorTime;
                  
                  if (obj.images && obj.images.length > 0) {
                    result.imageUrl = obj.images[0];
                  }
                  
                  if (obj.genres && Array.isArray(obj.genres)) {
                    result.genres = obj.genres;
                  }
                }
                
                // Recursively search
                Object.values(obj).forEach(val => searchForEventData(val, depth + 1));
              }
            };
            
            searchForEventData(props);
          }
        } catch (e) {
          console.error('Error parsing Next.js data:', e.message);
        }
      }
      
      // Extract from visible page elements
      
      // Get event description/about
      const descriptionSelectors = [
        '[class*="Description"]',
        '[class*="description"]',
        '[class*="About"]',
        '[class*="about"]',
        '[data-testid*="description"]',
        '[data-testid*="about"]'
      ];
      
      for (const selector of descriptionSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim().length > 50) {
          result.description = el.textContent.trim();
          break;
        }
      }
      
      // Get lineup information
      const lineupSelectors = [
        '[class*="Lineup"]',
        '[class*="lineup"]',
        '[class*="Artists"]',
        '[data-testid*="lineup"]'
      ];
      
      for (const selector of lineupSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          result.lineup = el.textContent.trim();
          break;
        }
      }
      
      // Extract artists
      const artistElements = document.querySelectorAll('[class*="artist"] a, [data-testid*="artist"]');
      artistElements.forEach(el => {
        const artistName = el.textContent.trim();
        if (artistName && !result.artists.includes(artistName)) {
          result.artists.push(artistName);
        }
      });
      
      // Extract genres/tags
      const genreSelectors = [
        '[class*="genre"]',
        '[class*="Genre"]',
        '[class*="tag"]',
        '[class*="Tag"]',
        '[class*="category"]'
      ];
      
      genreSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent.trim();
          if (text && text.length < 30 && !result.genres.includes(text)) {
            result.genres.push(text);
          }
        });
      });
      
      // Get main event image
      const imgSelectors = [
        'img[class*="event"]',
        'img[class*="Event"]',
        'img[class*="poster"]',
        'img[class*="flyer"]'
      ];
      
      for (const selector of imgSelectors) {
        const img = document.querySelector(selector);
        if (img && img.src && img.src.includes('dice-media')) {
          result.imageUrl = img.src;
          break;
        }
      }
      
      // Get venue address
      const addressEl = document.querySelector('[class*="address"], [class*="Address"]');
      if (addressEl) {
        result.addressDetails = addressEl.textContent.trim();
      }
      
      // Get age restriction (look for specific text patterns)
      const bodyText = document.body.textContent;
      const agePatterns = [
        /This is (?:a|an) (\d+\+) event/i,
        /(\d+\+) only/i,
        /Age (?:restriction|limit)[:\s]+(\d+\+)/i,
        /(\d+) and over/i
      ];
      
      for (const pattern of agePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          result.ageRestriction = match[1];
          break;
        }
      }
      
      // Get door time
      const doorTimeEl = document.querySelector('[class*="door"], [class*="time"]');
      if (doorTimeEl && doorTimeEl.textContent.match(/\d{1,2}:\d{2}/)) {
        result.doorTime = doorTimeEl.textContent.trim();
      }
      
      // Get ticket types/tiers
      const ticketElements = document.querySelectorAll('[class*="ticket"], [class*="Ticket"]');
      ticketElements.forEach(el => {
        const ticketText = el.textContent.trim();
        if (ticketText && ticketText.length > 3 && ticketText.length < 100) {
          result.ticketTypes.push(ticketText);
        }
      });
      
      // Get promoter
      const promoterEl = document.querySelector('[class*="promoter"], [class*="Promoter"]');
      if (promoterEl) {
        result.promoter = promoterEl.textContent.trim();
      }
      
      // Get social links
      const socialLinks = document.querySelectorAll('a[href*="facebook"], a[href*="instagram"], a[href*="twitter"], a[href*="spotify"]');
      socialLinks.forEach(link => {
        const href = link.href;
        if (href.includes('facebook')) result.socialLinks.facebook = href;
        if (href.includes('instagram')) result.socialLinks.instagram = href;
        if (href.includes('twitter')) result.socialLinks.twitter = href;
        if (href.includes('spotify')) result.socialLinks.spotify = href;
      });
      
      return result;
    });
    
    // Save the full HTML for this event
    const html = await page.content();
    if (!fs.existsSync('dice_event_htmls')) {
      fs.mkdirSync('dice_event_htmls');
    }
    const htmlFilename = `dice_event_htmls/event_${eventId}.html`;
    fs.writeFileSync(htmlFilename, html);
    
    console.log(`   ✅ Extracted!`);
    if (details.genres.length > 0) console.log(`      Genres: ${details.genres.join(', ')}`);
    if (details.artists.length > 0) console.log(`      Artists: ${details.artists.join(', ')}`);
    if (details.ageRestriction) console.log(`      Age: ${details.ageRestriction}`);
    if (details.promoter) console.log(`      Promoter: ${details.promoter}`);
    if (details.description) console.log(`      Description: ${details.description.substring(0, 80)}...`);
    
    return {
      ...details,
      htmlSaved: htmlFilename
    };
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

// ========== MAIN ==========

async function main() {
  console.log('🎲 Dice.fm Event Details Scraper\n');
  console.log('='.repeat(50) + '\n');
  
  // Read the existing events JSON
  const eventsFile = 'dice_events.json';
  console.log(`📂 Reading ${eventsFile}...`);
  
  const allEvents = JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
  console.log(`✅ Loaded ${allEvents.length} event entries\n`);
  
  // Deduplicate events by URL (there are duplicates in the JSON)
  const uniqueEvents = [];
  const seenUrls = new Set();
  
  for (const event of allEvents) {
    if (event.url && !seenUrls.has(event.url)) {
      uniqueEvents.push(event);
      seenUrls.add(event.url);
    }
  }
  
  console.log(`📊 Found ${uniqueEvents.length} unique events after deduplication\n`);
  
  // Test with first 5 events
  const testEvents = uniqueEvents.slice(0, 5);
  console.log(`🧪 Testing with first ${testEvents.length} events\n`);
  console.log('='.repeat(50) + '\n');
  
  // Launch browser
  console.log('🚀 Launching browser...\n');
  
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
    
    const enhancedEvents = [];
    
    for (let i = 0; i < testEvents.length; i++) {
      const event = testEvents[i];
      console.log(`[${i + 1}/${testEvents.length}] ${event.title}`);
      
      if (event.url) {
        const details = await scrapeDiceEventDetails(page, event.url, event.id);
        
        if (details) {
          enhancedEvents.push({
            ...event,
            detailedInfo: details
          });
        } else {
          enhancedEvents.push(event);
        }
        
        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`   ⚠️  No URL available`);
        enhancedEvents.push(event);
      }
      
      console.log('');
    }
    
    // Save enhanced data
    console.log('='.repeat(50) + '\n');
    const outputFilename = 'dice_events_detailed.json';
    fs.writeFileSync(outputFilename, JSON.stringify(enhancedEvents, null, 2));
    
    console.log(`💾 Saved ${enhancedEvents.length} detailed events to ${outputFilename}`);
    console.log(`📁 HTML files saved in dice_event_htmls/ directory\n`);
    
    // Show detailed sample of first event
    console.log('='.repeat(50));
    console.log('\n📋 Sample Event Details (first one):\n');
    const sample = enhancedEvents[0];
    
    console.log(`Title: ${sample.title}`);
    console.log(`Venue: ${sample.venue}`);
    console.log(`Date: ${sample.date}`);
    console.log(`Price: ${sample.price}`);
    console.log(`URL: ${sample.url}`);
    
    if (sample.detailedInfo) {
      console.log(`\n📝 Detailed Info:`);
      console.log(`  Description: ${sample.detailedInfo.description?.substring(0, 200) || 'N/A'}...`);
      console.log(`  Genres: ${sample.detailedInfo.genres?.join(', ') || 'N/A'}`);
      console.log(`  Artists: ${sample.detailedInfo.artists?.join(', ') || 'N/A'}`);
      console.log(`  Age Restriction: ${sample.detailedInfo.ageRestriction || 'N/A'}`);
      console.log(`  Promoter: ${sample.detailedInfo.promoter || 'N/A'}`);
      console.log(`  Start Time: ${sample.detailedInfo.startTime || 'N/A'}`);
      console.log(`  End Time: ${sample.detailedInfo.endTime || 'N/A'}`);
      console.log(`  Address: ${sample.detailedInfo.addressDetails || 'N/A'}`);
      console.log(`  Image URL: ${sample.detailedInfo.imageUrl ? 'Found' : 'N/A'}`);
      console.log(`  Ticket Types: ${sample.detailedInfo.ticketTypes?.length || 0} types`);
      console.log(`  HTML saved: ${sample.detailedInfo.htmlSaved}`);
      console.log(`  Structured Data: ${sample.detailedInfo.structuredData ? 'Found (JSON-LD)' : 'N/A'}`);
      
      if (Object.keys(sample.detailedInfo.socialLinks).length > 0) {
        console.log(`  Social Links:`, Object.keys(sample.detailedInfo.socialLinks).join(', '));
      }
    }
    
    console.log('\n✅ Done! Detailed scraping complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n🔒 Browser closed.');
  }
}

main();

