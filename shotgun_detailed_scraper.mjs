import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Scrape detailed information from a Shotgun.live event page
 */
async function scrapeShotgunEventDetails(page, eventUrl, eventId) {
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
        fullDescription: null,
        lineup: null,
        artists: [],
        genres: [],
        eventType: null,
        imageUrl: null,
        ageRestriction: null,
        ticketTypes: [],
        promoter: null,
        organizer: null,
        addressDetails: null,
        venueName: null,
        doorTime: null,
        startTime: null,
        endTime: null,
        latitude: null,
        longitude: null,
        socialLinks: {},
        structuredData: null
      };
      
      // FIRST: Try to extract JSON-LD structured data
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      jsonLdScripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          if (data['@type'] === 'MusicEvent' || data['@type'] === 'Event') {
            result.structuredData = data;
            
            // Extract clean data from JSON-LD
            result.description = data.description;
            result.imageUrl = Array.isArray(data.image) ? data.image[0] : data.image;
            result.startTime = data.startDate;
            result.endTime = data.endDate;
            
            if (data.location) {
              result.venueName = data.location.name;
              result.addressDetails = data.location.address;
              if (data.location.geo) {
                result.latitude = data.location.geo.latitude;
                result.longitude = data.location.geo.longitude;
              }
            }
            
            if (data.organizer) {
              result.organizer = data.organizer.name || data.organizer;
            }
            
            if (data.performer && Array.isArray(data.performer)) {
              result.artists = data.performer.map(p => p.name || p);
            }
            
            if (data.offers && Array.isArray(data.offers)) {
              result.ticketTypes = data.offers.map(offer => ({
                name: offer.name,
                price: offer.price,
                currency: offer.priceCurrency,
                availability: offer.availability,
                url: offer.url
              }));
            }
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });
      
      // Extract from visible page elements
      
      // Get event description/about
      const descriptionSelectors = [
        '[class*="description"]',
        '[class*="Description"]',
        '[class*="about"]',
        '[class*="About"]',
        '[data-testid*="description"]',
        'article p',
        'section p'
      ];
      
      for (const selector of descriptionSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim().length > 50) {
          result.fullDescription = el.textContent.trim();
          break;
        }
      }
      
      // Get lineup/artists information
      const lineupSelectors = [
        '[class*="lineup"]',
        '[class*="Lineup"]',
        '[class*="artist"]',
        '[class*="Artist"]',
        '[class*="performer"]',
        '[data-testid*="lineup"]'
      ];
      
      for (const selector of lineupSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          result.lineup = el.textContent.trim();
          break;
        }
      }
      
      // Extract artist names from links
      const artistLinks = document.querySelectorAll('a[href*="/artists/"], a[href*="/artist/"]');
      artistLinks.forEach(link => {
        const artistName = link.textContent.trim();
        if (artistName && artistName.length > 1 && !result.artists.includes(artistName)) {
          result.artists.push(artistName);
        }
      });
      
      // Extract genres/tags
      const genreSelectors = [
        '[class*="genre"]',
        '[class*="Genre"]',
        '[class*="tag"]',
        '[class*="Tag"]',
        '[class*="category"]',
        'a[href*="/genre/"]'
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
      
      // Get main event image (if not already found)
      if (!result.imageUrl) {
        const imgSelectors = [
          'img[class*="event"]',
          'img[class*="Event"]',
          'img[class*="poster"]',
          'img[class*="flyer"]',
          'img[alt*="event"]',
          'main img',
          'article img'
        ];
        
        for (const selector of imgSelectors) {
          const img = document.querySelector(selector);
          if (img && img.src) {
            result.imageUrl = img.src;
            break;
          }
        }
      }
      
      // Get venue information
      const venueSelectors = [
        '[class*="venue"]',
        '[class*="Venue"]',
        '[class*="location"]',
        'a[href*="/venues/"]',
        'a[href*="/venue/"]'
      ];
      
      for (const selector of venueSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim() && !result.venueName) {
          result.venueName = el.textContent.trim();
          break;
        }
      }
      
      // Get address details
      const addressSelectors = [
        '[class*="address"]',
        '[class*="Address"]',
        '[itemtype*="PostalAddress"]',
        'address'
      ];
      
      for (const selector of addressSelectors) {
        const el = document.querySelector(selector);
        if (el && !result.addressDetails) {
          result.addressDetails = el.textContent.trim();
          break;
        }
      }
      
      // Get age restriction
      const bodyText = document.body.textContent;
      const agePatterns = [
        /(\d+\+)/,
        /Ages?\s+(\d+)\s+(?:and\s+)?(?:up|over|older)/i,
        /(\d+)\s+(?:and\s+)?(?:up|over|older)/i,
        /All ages/i,
        /18 and over/i,
        /21 and over/i
      ];
      
      for (const pattern of agePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          result.ageRestriction = match[0];
          break;
        }
      }
      
      // Get door/start time
      const timePatterns = [
        /Doors?(?:\s+open)?:?\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
        /Start(?:\s+time)?:?\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
        /(\d{1,2}:\d{2}\s*(?:AM|PM))/
      ];
      
      for (const pattern of timePatterns) {
        const match = bodyText.match(pattern);
        if (match && !result.doorTime) {
          result.doorTime = match[1] || match[0];
          break;
        }
      }
      
      // Get ticket information
      const ticketElements = document.querySelectorAll('[class*="ticket"], [class*="Ticket"], button[class*="buy"]');
      ticketElements.forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length > 3 && text.length < 100) {
          // Extract price patterns
          const priceMatch = text.match(/\$[\d.]+|\d+\.\d{2}/);
          if (priceMatch) {
            result.ticketTypes.push({
              text: text,
              price: priceMatch[0]
            });
          }
        }
      });
      
      // Get promoter/organizer
      const promoterSelectors = [
        '[class*="promoter"]',
        '[class*="Promoter"]',
        '[class*="organizer"]',
        '[class*="Organizer"]',
        'a[href*="/organizers/"]',
        'a[href*="/promoters/"]'
      ];
      
      for (const selector of promoterSelectors) {
        const el = document.querySelector(selector);
        if (el && !result.promoter) {
          result.promoter = el.textContent.trim();
          break;
        }
      }
      
      // Get social links
      const socialLinks = document.querySelectorAll('a[href*="facebook.com"], a[href*="instagram.com"], a[href*="twitter.com"], a[href*="spotify.com"], a[href*="soundcloud.com"]');
      socialLinks.forEach(link => {
        const href = link.href;
        if (href.includes('facebook')) result.socialLinks.facebook = href;
        if (href.includes('instagram')) result.socialLinks.instagram = href;
        if (href.includes('twitter') || href.includes('x.com')) result.socialLinks.twitter = href;
        if (href.includes('spotify')) result.socialLinks.spotify = href;
        if (href.includes('soundcloud')) result.socialLinks.soundcloud = href;
      });
      
      // Look for event type
      const eventTypePatterns = ['Concert', 'Festival', 'Club Night', 'Party', 'Live Music', 'DJ Set'];
      for (const type of eventTypePatterns) {
        if (bodyText.includes(type)) {
          result.eventType = type;
          break;
        }
      }
      
      return result;
    });
    
    // Save the full HTML for this event
    const html = await page.content();
    if (!fs.existsSync('shotgun_event_htmls')) {
      fs.mkdirSync('shotgun_event_htmls');
    }
    const htmlFilename = `shotgun_event_htmls/event_${eventId}.html`;
    fs.writeFileSync(htmlFilename, html);
    
    console.log(`   ✅ Extracted!`);
    if (details.genres.length > 0) console.log(`      Genres: ${details.genres.join(', ')}`);
    if (details.artists.length > 0) console.log(`      Artists: ${details.artists.slice(0, 3).join(', ')}${details.artists.length > 3 ? '...' : ''}`);
    if (details.ageRestriction) console.log(`      Age: ${details.ageRestriction}`);
    if (details.venueName) console.log(`      Venue: ${details.venueName}`);
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
  console.log('🎯 Shotgun.live Event Details Scraper\n');
  console.log('='.repeat(50) + '\n');
  
  // Read the existing events JSON
  const eventsFile = 'shotgun_events.json';
  console.log(`📂 Reading ${eventsFile}...`);
  
  if (!fs.existsSync(eventsFile)) {
    console.error(`❌ Error: ${eventsFile} not found. Please run shotgun_scraper.mjs first.`);
    process.exit(1);
  }
  
  const allEvents = JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
  console.log(`✅ Loaded ${allEvents.length} events\n`);
  
  // Test with first 5 events
  const testEvents = allEvents.slice(0, 5);
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
        const details = await scrapeShotgunEventDetails(page, event.url, event.id);
        
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
    const outputFilename = 'shotgun_events_detailed.json';
    fs.writeFileSync(outputFilename, JSON.stringify(enhancedEvents, null, 2));
    
    console.log(`💾 Saved ${enhancedEvents.length} detailed events to ${outputFilename}`);
    console.log(`📁 HTML files saved in shotgun_event_htmls/ directory\n`);
    
    // Show detailed sample of first event
    console.log('='.repeat(50));
    console.log('\n📋 Sample Event Details (first one):\n');
    const sample = enhancedEvents[0];
    
    console.log(`Title: ${sample.title}`);
    console.log(`Venue: ${sample.venue}`);
    console.log(`Date: ${sample.date}`);
    console.log(`Time: ${sample.time || 'N/A'}`);
    console.log(`Price: ${sample.price || 'N/A'}`);
    console.log(`URL: ${sample.url}`);
    
    if (sample.detailedInfo) {
      console.log(`\n📝 Detailed Info:`);
      console.log(`  Description: ${sample.detailedInfo.description?.substring(0, 200) || 'N/A'}...`);
      console.log(`  Full Description: ${sample.detailedInfo.fullDescription ? 'Found' : 'N/A'}`);
      console.log(`  Lineup: ${sample.detailedInfo.lineup?.substring(0, 100) || 'N/A'}...`);
      console.log(`  Genres: ${sample.detailedInfo.genres?.join(', ') || 'N/A'}`);
      console.log(`  Artists: ${sample.detailedInfo.artists?.slice(0, 5).join(', ') || 'N/A'}`);
      console.log(`  Age Restriction: ${sample.detailedInfo.ageRestriction || 'N/A'}`);
      console.log(`  Venue Name: ${sample.detailedInfo.venueName || 'N/A'}`);
      console.log(`  Address: ${sample.detailedInfo.addressDetails || 'N/A'}`);
      console.log(`  Organizer: ${sample.detailedInfo.organizer || sample.detailedInfo.promoter || 'N/A'}`);
      console.log(`  Start Time: ${sample.detailedInfo.startTime || 'N/A'}`);
      console.log(`  End Time: ${sample.detailedInfo.endTime || 'N/A'}`);
      console.log(`  Door Time: ${sample.detailedInfo.doorTime || 'N/A'}`);
      console.log(`  Image URL: ${sample.detailedInfo.imageUrl ? 'Found' : 'N/A'}`);
      console.log(`  Ticket Types: ${sample.detailedInfo.ticketTypes?.length || 0} types`);
      console.log(`  HTML saved: ${sample.detailedInfo.htmlSaved}`);
      console.log(`  Structured Data: ${sample.detailedInfo.structuredData ? 'Found (JSON-LD)' : 'N/A'}`);
      
      if (Object.keys(sample.detailedInfo.socialLinks).length > 0) {
        console.log(`  Social Links: ${Object.keys(sample.detailedInfo.socialLinks).join(', ')}`);
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

