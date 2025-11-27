import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Scrape events from Shotgun.live for NYC
 * @param {string} targetDate - Date to scrape until (YYYY-MM-DD)
 */
async function scrapeShotgunEvents(targetDate = '2025-12-01') {
  console.log('🎯 Shotgun.live Events Scraper\n');
  console.log('='.repeat(50) + '\n');
  
  const url = 'https://shotgun.live/en/cities/new-york';
  console.log(`🌐 Target: ${url}`);
  console.log(`📅 Scraping events until: ${targetDate}\n`);
  console.log('='.repeat(50) + '\n');
  
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
    
    console.log(`🌐 Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for content to load
    console.log('⏳ Waiting for page content to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Save initial HTML for debugging
    const initialHtml = await page.content();
    fs.writeFileSync('shotgun_page_initial.html', initialHtml);
    console.log('📄 Saved initial HTML to shotgun_page_initial.html\n');
    
    // Take initial screenshot
    await page.screenshot({ path: 'shotgun_page_initial.png', fullPage: true });
    console.log('📸 Saved initial screenshot to shotgun_page_initial.png\n');
    
    // Click "View More" button repeatedly to load all events until target date
    console.log('🔄 Clicking "View More" to load all events...\n');
    
    const targetDateObj = new Date(targetDate);
    let clickCount = 0;
    let shouldContinue = true;
    
    while (shouldContinue && clickCount < 20) { // Safety limit of 20 clicks
      try {
        // Find button by text content using page.evaluate
        const viewMoreButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          return buttons.find(btn => {
            const text = btn.textContent.toLowerCase();
            return text.includes('view more') || 
                   text.includes('load more') || 
                   text.includes('show more') ||
                   text.includes('see more');
          });
        });
        
        const buttonExists = await viewMoreButton.asElement();
        
        if (!buttonExists) {
          console.log('   ℹ️  No more "View More" button found. All events loaded.\n');
          shouldContinue = false;
          break;
        }
        
        // Get button text for logging
        const buttonText = await page.evaluate(btn => btn.textContent.trim(), buttonExists);
        console.log(`   ✅ Found button: "${buttonText}"`);
        
        // Click the button
        await buttonExists.click();
        clickCount++;
        console.log(`   🖱️  Click ${clickCount}: Clicked button`);
        
        // Wait for new content to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if we've loaded events past our target date
        const lastEventDate = await page.evaluate(() => {
          // Find all section headers with dates (h2 elements that say "Mon 1 Dec", etc.)
          const headers = document.querySelectorAll('h2');
          let lastDateText = null;
          
          for (const header of headers) {
            const text = header.textContent.trim();
            // Look for month pattern
            if (text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
              lastDateText = text;
            }
          }
          
          // If no headers, try to find dates in the page content
          if (!lastDateText) {
            const bodyText = document.body.textContent;
            const dateMatch = bodyText.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/gi);
            if (dateMatch && dateMatch.length > 0) {
              lastDateText = dateMatch[dateMatch.length - 1];
            }
          }
          
          return lastDateText;
        });
        
        if (lastEventDate) {
          console.log(`   📅 Last event date visible: ${lastEventDate}`);
          
          // Check if we've reached December
          if (lastEventDate.match(/Dec(?:ember)?/i)) {
            const dayMatch = lastEventDate.match(/Dec(?:ember)?\s+(\d+)/i) || lastEventDate.match(/(\d+)\s+Dec(?:ember)?/i);
            if (dayMatch) {
              const day = parseInt(dayMatch[1]);
              if (day >= 1) {
                console.log(`   ✅ Reached December ${day}. Target date reached!\n`);
                shouldContinue = false;
              }
            }
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Error clicking button: ${error.message}`);
        shouldContinue = false;
      }
    }
    
    if (clickCount >= 20) {
      console.log('⚠️  Reached maximum click limit (20). Stopping.\n');
    }
    
    console.log('='.repeat(50) + '\n');
    console.log('📊 Extracting event data...\n');
    
    // Extract all events from the page
    const {events, debug} = await page.evaluate(() => {
      const eventsArray = [];
      const debugInfo = {
        totalLinks: 0,
        eventCards: 0,
        withUrl: 0,
        withTitle: 0,
        withVenue: 0,
        withDate: 0,
        withPrice: 0,
        sampleEvent: null,
        sampleHTML: null
      };
      
      // Look for all event links (Shotgun uses data-slot="tracked-link" for event cards)
      const allLinks = Array.from(document.querySelectorAll('a[href*="/events/"]'));
      debugInfo.totalLinks = allLinks.length;
      
      // Extract unique event URLs
      const uniqueEvents = new Map();
      
      allLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href.includes('/search') || href.includes('/login')) return;
        if (uniqueEvents.has(href)) return;
        
        // The event card is the <a> element itself with all content inside
        uniqueEvents.set(href, link);
      });
      
      debugInfo.eventCards = uniqueEvents.size;
      
      Array.from(uniqueEvents.entries()).forEach(([href, eventCard], index) => {
        try {
          const event = {
            id: index,
            title: null,
            venue: null,
            date: null,
            time: null,
            price: null,
            genres: [],
            imageUrl: null,
            url: null,
            rawHTML: eventCard.outerHTML.substring(0, 800)
          };
          
          // Set URL
          event.url = href.startsWith('http') ? href : `https://shotgun.live${href}`;
          
          // Extract title - look for the main heading/title element
          // Shotgun typically has the title in a prominent text element
          const titleCandidates = eventCard.querySelectorAll('h1, h2, h3, h4, div, span, p');
          let foundTitle = false;
          
          for (const el of titleCandidates) {
            // Get only the direct text of this element, not its children
            const text = Array.from(el.childNodes)
              .filter(node => node.nodeType === Node.TEXT_NODE)
              .map(node => node.textContent.trim())
              .join(' ')
              .trim();
            
            // Title characteristics:
            // - Longer than 5 characters
            // - Not a date pattern
            // - Not a time pattern
            // - Not a price
            // - Not just a genre tag
            if (text && text.length > 5 && 
                !text.match(/^\d{1,2}:\d{2}/) && // Not time
                !text.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/) && // Not date
                !text.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i) && // Not month
                !text.match(/^\$\d+/) && // Not price with $
                !text.match(/^(Sold out|Free|From)$/i) && // Not status
                !text.match(/^(House|Techno|Jazz|Disco|Electronic|Hip Hop|R&B)$/i) && // Not single genre
                !foundTitle) {
              event.title = text;
              foundTitle = true;
              break;
            }
          }
          
          // If still no title, try getting the largest text block
          if (!event.title) {
            const allText = eventCard.textContent.split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 5 && 
                      !line.match(/^\d{1,2}:\d{2}/) &&
                      !line.match(/^\$\d+/));
            if (allText.length > 0) {
              event.title = allText[0];
            }
          }
          
          // Get all text content for pattern matching
          const allTextContent = eventCard.textContent;
          
          // Extract venue - look for location/venue name in specific patterns
          // Try to find venue between title and date
          // Common venue name patterns on Shotgun
          const venuePatterns = [
            // Specific venue names (common NYC venues)
            /(Nowadays|Brooklyn Mirage|Elsewhere|H0L0|House of Yes|Schimanski|Good Room|Output|Avant Gardner|Knockdown Center|Superior Ingredients|Public Records|Bossa Nova Civic Club|Paragon|The Meadows|Basement|Market Hotel|Trans-Pecos)/i,
            // Generic pattern: capitalized words without numbers, followed by location or date
            /([A-Z][a-zA-Z\s&'-]{2,40}?)(?=\s*(?:Brooklyn|Manhattan|Queens|New York|\d{1,2}:\d{2}|Mon|Tue|Wed|Thu|Fri|Sat|Sun))/
          ];
          
          for (const pattern of venuePatterns) {
            const match = allTextContent.match(pattern);
            if (match && match[1]) {
              const venue = match[1].trim();
              // Make sure it's not the title and not too long
              if (venue !== event.title && venue.length < 50 && venue.length > 2) {
                event.venue = venue;
                break;
              }
            }
          }
          
          // Fallback: look for location indicators
          if (!event.venue) {
            const locationMatch = allTextContent.match(/(Brooklyn|Manhattan|Queens|Bronx|Staten Island),?\s*(?:New York|NY)?/i);
            if (locationMatch) {
              event.venue = locationMatch[0].trim();
            }
          }
          
          // Extract date - look for date patterns
          const datePatterns = [
            /((Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})/i,
            /((Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/i,
            /(Nov|Dec)\s*\d{1,2}[–-]\d{1,2}/i,
            /\d{1,2}\s+(Nov|Dec)/i
          ];
          
          for (const pattern of datePatterns) {
            const match = allTextContent.match(pattern);
            if (match && !event.date) {
              event.date = match[0].trim();
              break;
            }
          }
          
          // Extract time - look for time pattern
          const timeMatch = allTextContent.match(/\d{1,2}:\d{2}\s*(AM|PM)?/i);
          if (timeMatch) {
            event.time = timeMatch[0].trim();
          }
          
          // Extract price - look for $ followed by numbers
          const pricePatterns = [
            /\$\d+\.?\d*/,
            /From\s+\$\d+/i,
            /Sold out/i,
            /Free/i
          ];
          
          for (const pattern of pricePatterns) {
            const match = allTextContent.match(pattern);
            if (match && !event.price) {
              event.price = match[0].trim();
              break;
            }
          }
          
          // Extract genres - common music genres
          const genreKeywords = ['House', 'Techno', 'Jazz', 'Disco', 'Electronic', 'Hip Hop', 'R&B', 'Afro House', 'Deep House', 'Dance', 'Reggaeton'];
          for (const genre of genreKeywords) {
            if (allTextContent.includes(genre) && !event.genres.includes(genre)) {
              event.genres.push(genre);
            }
          }
          
          // Extract image
          const imgEl = eventCard.querySelector('img');
          if (imgEl) {
            event.imageUrl = imgEl.src || imgEl.getAttribute('srcset')?.split(',')[0]?.split(' ')[0] || imgEl.getAttribute('data-src');
          }
          
          // Debug tracking
          if (event.url) debugInfo.withUrl++;
          if (event.title) debugInfo.withTitle++;
          if (event.venue) debugInfo.withVenue++;
          if (event.date) debugInfo.withDate++;
          if (event.price) debugInfo.withPrice++;
          
          // Save first event as sample
          if (index === 0) {
            debugInfo.sampleEvent = event;
            debugInfo.sampleHTML = eventCard.outerHTML.substring(0, 1000);
          }
          
          // Only add if we have at least a title AND url
          if (event.title && event.url) {
            eventsArray.push(event);
          }
        } catch (error) {
          // Silent error handling in page.evaluate
        }
      });
      
      return {events: eventsArray, debug: debugInfo};
    });
    
    console.log(`\n🔍 Debug Info:`);
    console.log(`   Total event links found: ${debug.totalLinks}`);
    console.log(`   Event cards identified: ${debug.eventCards}`);
    console.log(`   Events with URL: ${debug.withUrl}`);
    console.log(`   Events with title: ${debug.withTitle}`);
    console.log(`   Events with venue: ${debug.withVenue}`);
    console.log(`   Events with date: ${debug.withDate}`);
    console.log(`   Events with price: ${debug.withPrice}`);
    if (debug.sampleEvent) {
      console.log(`\n📝 Sample Event (first one):`);
      console.log(`   Title: ${debug.sampleEvent.title || 'NULL'}`);
      console.log(`   Venue: ${debug.sampleEvent.venue || 'NULL'}`);
      console.log(`   Date: ${debug.sampleEvent.date || 'NULL'}`);
      console.log(`   Time: ${debug.sampleEvent.time || 'NULL'}`);
      console.log(`   Price: ${debug.sampleEvent.price || 'NULL'}`);
      console.log(`   Genres: ${debug.sampleEvent.genres?.join(', ') || 'NULL'}`);
      console.log(`   URL: ${debug.sampleEvent.url || 'NULL'}`);
    }
    
    console.log(`✅ Extracted ${events.length} events\n`);
    
    // Save final HTML
    const finalHtml = await page.content();
    fs.writeFileSync('shotgun_page_final.html', finalHtml);
    console.log('📄 Saved final HTML to shotgun_page_final.html');
    
    // Take final screenshot
    await page.screenshot({ path: 'shotgun_page_final.png', fullPage: true });
    console.log('📸 Saved final screenshot to shotgun_page_final.png\n');
    
    // Save events to JSON
    const outputFilename = 'shotgun_events.json';
    fs.writeFileSync(outputFilename, JSON.stringify(events, null, 2));
    
    console.log('='.repeat(50) + '\n');
    console.log(`💾 Saved ${events.length} events to ${outputFilename}\n`);
    
    // Show sample events
    if (events.length > 0) {
      console.log('📋 Sample Events:\n');
      events.slice(0, 3).forEach((event, i) => {
        console.log(`[${i + 1}] ${event.title || 'No title'}`);
        console.log(`    Venue: ${event.venue || 'N/A'}`);
        console.log(`    Date: ${event.date || 'N/A'}`);
        console.log(`    Time: ${event.time || 'N/A'}`);
        console.log(`    Price: ${event.price || 'N/A'}`);
        console.log(`    Genres: ${event.genres?.length > 0 ? event.genres.join(', ') : 'N/A'}`);
        console.log(`    URL: ${event.url || 'N/A'}`);
        console.log('');
      });
    }
    
    console.log('✅ Done! Shotgun events scraped successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n🔒 Browser closed.');
  }
}

// Run the scraper
const targetDate = '2025-12-01'; // December 1st
scrapeShotgunEvents(targetDate);

