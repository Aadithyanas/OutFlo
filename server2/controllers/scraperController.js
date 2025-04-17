const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

puppeteer.use(StealthPlugin());

class LinkedInScraperService {
  constructor() {
    this.email = null
    this.password = null
    this.headless = false; // Set to `true` for headless mode (slower, but no visible browser)
    this.browser = null;
    this.page = null;
    this.maxRetries = 3;
    this.cookiePath = path.join(__dirname, 'cookies.json');
  }

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: this.headless,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows Chrome path
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-notifications',
          '--window-size=1920,1080',
          '--disable-blink-features=AutomationControlled',
        ],
        defaultViewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
      });

      this.page = await this.browser.newPage();

      // Randomize user agent (Windows-specific)
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      // Remove webdriver property
      await this.page.evaluateOnNewDocument(() => {
        delete navigator.__proto__.webdriver;
      });

      return true;
    } catch (error) {
      console.error('❌ Error initializing browser:', error.message);
      return false;
    }
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async humanType(element, text) {
    for (let char of text) {
      await element.type(char, { delay: Math.random() * 100 + 50 });
      await this.delay(Math.random() * 300);
    }
  }

  async saveCookies() {
    const cookies = await this.page.cookies();
    fs.writeFileSync(this.cookiePath, JSON.stringify(cookies, null, 2));
    console.log('🍪 Cookies saved!');
  }

  async loadCookies() {
    if (fs.existsSync(this.cookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(this.cookiePath));
      await this.page.setCookie(...cookies);
      console.log('🍪 Cookies loaded!');
      return true;
    }
    return false;
  }

  async handleCaptcha() {
    console.log('🛑 CAPTCHA detected! Pausing for manual solving...');
    console.log('⏳ You have 2 minutes to solve it in the browser...');
    
    try {
      await this.page.waitForNavigation({ timeout: 120000 }); // Wait 2 mins
      await this.saveCookies();
      return true;
    } catch (error) {
      console.error('❌ CAPTCHA not solved in time:', error.message);
      return false;
    }
  }

  async login() {
    if (!this.email || !this.password) {
      throw new Error('Credentials not set in .env!');
    }

    if (!this.browser || !this.page) {
      await this.initialize();
    }

    let retries = 0;
    while (retries < this.maxRetries) {
      try {
        console.log('🔑 Logging in to LinkedIn...');
        await this.page.goto('https://www.linkedin.com/login', {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });

        // Try cookies first
        if (await this.loadCookies()) {
          await this.page.reload({ waitUntil: 'networkidle2' });
          try {
            await this.page.waitForSelector('#global-nav', { timeout: 10000 });
            console.log('✅ Logged in via cookies!');
            return true;
          } catch (e) {
            console.log('⚠️ Cookies expired, using normal login...');
          }
        }

        // Human-like typing
        await this.delay(2000);
        await this.humanType(await this.page.$('#username'), this.email);
        await this.delay(1000);
        await this.humanType(await this.page.$('#password'), this.password);

        // Click login
        await this.delay(1500);
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
          this.page.click("button[type='submit']"),
        ]);

        // Check for CAPTCHA
        if (await this.page.$('#captcha-internal')) {
          return await this.handleCaptcha();
        }

        // Verify login success
        await this.page.waitForSelector('#global-nav', { timeout: 10000 });
        await this.saveCookies();
        console.log('✅ Successfully logged in!');
        return true;
      } catch (error) {
        retries++;
        console.error(`❌ Login attempt ${retries} failed: ${error.message}`);
        if (retries >= this.maxRetries) throw error;
        await this.delay(5000 * retries); // Wait longer between retries
      }
    }
    return false;
  }

  async getConnections(maxConnections = 50) {
    if (!this.browser || !this.page) {
      const initialized = await this.initialize();
      if (!initialized) throw new Error('Failed to initialize browser');
    }

    try {
      const loggedIn = await this.login();
      if (!loggedIn) throw new Error('Login failed');

      console.log('🔍 Navigating to connections page...');
      await this.page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await this.page.waitForSelector('.mn-connection-card', { timeout: 10000 });

      console.log('🔄 Scrolling to load connections...');
      let lastHeight = await this.page.evaluate('document.body.scrollHeight');
      let scrollAttempts = 0;

      while (scrollAttempts < 10) {
        await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await this.delay(2000);
        
        const newHeight = await this.page.evaluate('document.body.scrollHeight');
        if (newHeight === lastHeight) break;
        
        lastHeight = newHeight;
        scrollAttempts++;
        
        const currentCount = await this.page.$$eval('.mn-connection-card', (els) => els.length);
        console.log(`📊 Loaded ${currentCount} connections...`);
        
        if (maxConnections && currentCount >= maxConnections) break;
      }

      return await this.extractConnectionData(maxConnections);
    } catch (error) {
      console.error('❌ Error getting connections:', error.message);
      return { success: false, error: error.message };
    } finally {
      await this.close();
    }
  }

  async extractConnectionData(maxConnections) {
    const connections = await this.page.$$('.mn-connection-card');
    const connectionsToProcess = maxConnections ? connections.slice(0, maxConnections) : connections;
    const results = [];

    for (let idx = 0; idx < connectionsToProcess.length; idx++) {
      try {
        const connection = connectionsToProcess[idx];
        await this.page.evaluate((el) => el.scrollIntoView(), connection);
        await this.delay(500);

        const data = await this.page.evaluate((el) => {
          const getText = (selector) => el.querySelector(selector)?.textContent.trim() || '';
          return {
            profile_url: el.querySelector('.mn-connection-card__link')?.href.split('?')[0],
            name: getText('.mn-connection-card__name'),
            about: getText('.mn-connection-card__occupation'),
            connection_date: getText('.time-badge'),
          };
        }, connection);

        if (data.profile_url) {
          results.push(data);
          console.log(`✔️ Extracted: ${data.name}`);
        }

        if ((idx + 1) % 5 === 0) await this.delay(1000); // Rate limiting
      } catch (e) {
        console.error(`⚠️ Error on connection ${idx + 1}:`, e.message);
      }
    }

    return { success: true, data: results };
  }

  async close() {
    try {
      if (this.page) await this.page.close();
      if (this.browser) await this.browser.close();
      console.log('🛑 Browser closed.');
    } catch (error) {
      console.error('❌ Error closing browser:', error.message);
    }
  }
}

// Example usage
(async () => {
  const scraper = new LinkedInScraperService();
  const result = await scraper.getConnections(20); // Get first 20 connections
  console.log(result);
})();