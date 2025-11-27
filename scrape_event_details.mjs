import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Scrape detailed information from an event page
 */
async function scrapeEventDetails(page, eventUrl, eventId) {
  try {
    console.log(`   🌐 Loading ${eventUrl}...`);
    
    await page.goto(eventUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`   🔍 Extracting data...`);
    
    // Extract all relevant information
    const details = await page.evaluate(() => {
      const result = {
        lineup: null,
        description: null,
        genres: [],
        cost: null,
        promoters: [],
        ticketInfo: null,
        imageUrl: null,
        venueInfo: null
      };
      
      // Try to get data from __NEXT_DATA__
      const nextDataScript = document.getElementById('__NEXT_DATA__');
      if (nextDataScript) {
        try {
          const data = JSON.parse(nextDataScript.textContent);
          const apolloState = data.props?.apolloState;
          
          if (apolloState) {
            // Find the main event object
            const eventKeys = Object.keys(apolloState).filter(k => k.startsWith('Event:'));
            
            eventKeys.forEach(eventKey => {
              const event = apolloState[eventKey];
              
              // Get lineup/content
              if (event.content) {
                result.lineup = event.content;
              }
              
              // Get cost
              if (event.cost) {
                result.cost = event.cost;
              }
              
              // Get image
              if (event.flyerFront) {
                result.imageUrl = event.flyerFront;
              } else if (event.images && event.images.length > 0) {
                const firstImage = event.images[0];
                if (firstImage.__ref) {
                  const imageData = apolloState[firstImage.__ref];
                  result.imageUrl = imageData?.filename;
                } else if (firstImage.filename) {
                  result.imageUrl = firstImage.filename;
                }
              }
              
              // Get promoters
              if (event.promoters && Array.isArray(event.promoters)) {
                event.promoters.forEach(promoterRef => {
                  if (promoterRef.__ref) {
                    const promoterData = apolloState[promoterRef.__ref];
                    if (promoterData?.name) {
                      result.promoters.push(promoterData.name);
                    }
                  }
                });
              }
              
              // Get venue details
              if (event.venue && event.venue.__ref) {
                const venueData = apolloState[event.venue.__ref];
                if (venueData) {
                  result.venueInfo = {
                    name: venueData.name,
                    contentUrl: venueData.contentUrl,
                    live: venueData.live
                  };
                }
              }
            });
          }
        } catch (e) {
          console.error('Error parsing Next.js data:', e.message);
        }
      }
      
      // Extract genres from visible page elements
      // Look for genre links
      document.querySelectorAll('a[href*="/music/genre/"]').forEach(link => {
        const genreText = link.textContent.trim();
        if (genreText && !result.genres.includes(genreText)) {
          result.genres.push(genreText);
        }
      });
      
      // Also try to find genres in specific genre sections
      const genreSection = document.querySelector('[class*="genre"]');
      if (genreSection) {
        const genreLinks = genreSection.querySelectorAll('a');
        genreLinks.forEach(link => {
          const text = link.textContent.trim();
          if (text && !result.genres.includes(text)) {
            result.genres.push(text);
          }
        });
      }
      
      // Extract description from page
      const descriptionSelectors = [
        '[class*="description"]',
        '[class*="event-description"]',
        '[class*="content"] p',
        'article p'
      ];
      
      for (const selector of descriptionSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          result.description = el.textContent.trim();
          break;
        }
      }
      
      // Extract ticket information
      const ticketSection = document.querySelector('[class*="ticket"]');
      if (ticketSection) {
        result.ticketInfo = ticketSection.textContent.trim();
      }
      
      return result;
    });
    
    // Save the full HTML
    const html = await page.content();
    const htmlFilename = `event_htmls/event_${eventId}.html`;
    fs.writeFileSync(htmlFilename, html);
    
    console.log(`   ✅ Extracted! Genres: ${details.genres.join(', ') || 'None'}`);
    
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
  console.log('🎵 RA Event Details Scraper\n');
  console.log('='.repeat(50) + '\n');
  
  // Create directory for HTML files
  if (!fs.existsSync('event_htmls')) {
    fs.mkdirSync('event_htmls');
  }
  
  // Read the existing events JSON
  const eventsFile = 'ra_events_2025-11-27_to_2025-12-04.json';
  console.log(`📂 Reading ${eventsFile}...`);
  
  const events = JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
  console.log(`✅ Loaded ${events.length} events\n`);
  
  // Test with first 5 events
  const testEvents = events.slice(0, 5);
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
        const details = await scrapeEventDetails(page, event.url, event.id);
        
        if (details) {
          enhancedEvents.push({
            ...event,
            detailedInfo: {
              lineup: details.lineup,
              description: details.description,
              genres: details.genres,
              cost: details.cost,
              promoters: details.promoters,
              ticketInfo: details.ticketInfo,
              imageUrl: details.imageUrl,
              venueInfo: details.venueInfo,
              htmlSaved: details.htmlSaved
            }
          });
        } else {
          enhancedEvents.push(event);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        console.log(`   ⚠️  No URL available`);
        enhancedEvents.push(event);
      }
      
      console.log('');
    }
    
    // Save enhanced data
    console.log('='.repeat(50) + '\n');
    const outputFilename = 'ra_events_detailed_sample.json';
    fs.writeFileSync(outputFilename, JSON.stringify(enhancedEvents, null, 2));
    
    console.log(`💾 Saved ${enhancedEvents.length} detailed events to ${outputFilename}`);
    console.log(`📁 HTML files saved in event_htmls/ directory\n`);
    
    // Show sample of first event
    console.log('='.repeat(50));
    console.log('\n📋 Sample Event Details (first one):\n');
    const sample = enhancedEvents[0];
    console.log(`Title: ${sample.title}`);
    console.log(`Venue: ${sample.venue}`);
    console.log(`Date: ${sample.date}`);
    console.log(`Artists: ${sample.artists.join(', ')}`);
    
    if (sample.detailedInfo) {
      console.log(`\nDetailed Info:`);
      console.log(`  Genres: ${sample.detailedInfo.genres?.join(', ') || 'N/A'}`);
      console.log(`  Cost: ${sample.detailedInfo.cost || 'N/A'}`);
      console.log(`  Promoters: ${sample.detailedInfo.promoters?.join(', ') || 'N/A'}`);
      console.log(`  Description: ${sample.detailedInfo.description?.substring(0, 150) || 'N/A'}...`);
      console.log(`  Lineup: ${sample.detailedInfo.lineup?.substring(0, 150) || 'N/A'}...`);
      console.log(`  Image: ${sample.detailedInfo.imageUrl || 'N/A'}`);
      console.log(`  HTML saved: ${sample.detailedInfo.htmlSaved}`);
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n🔒 Browser closed.');
  }
}

main();

