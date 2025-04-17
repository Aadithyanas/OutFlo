const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const config = require('../config/config');
const Connection = require('../models/connections');
require('dotenv').config();

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

class LinkedInScraperService {
  constructor() {
    this.email = null;
    this.password = null;
    this.headless = config.headless;
    this.browser = null;
    this.page = null;
    this.maxRetries = 3;
    this.requestDelay = 2000; // Delay between requests to avoid rate limiting
  }

  setCredentials(email, password) {
    this.email = email;
    this.password = password;
  }

  async initialize() {
    try {
      // Launch the browser with more stealth options
      this.browser = await puppeteer.launch({
        headless: this.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-notifications',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
      });

      // Create a new page with randomized viewport
      this.page = await this.browser.newPage();
      
      // Set randomized user agent to avoid detection
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
      ];
      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      await this.page.setUserAgent(randomUserAgent);
      
      // Disable images and stylesheets for faster loading
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Error initializing browser: ${error}`);
      return false;
    }
  }

  async delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }

  async login() {
    if (!this.email || !this.password) {
      throw new Error("LinkedIn credentials not provided");
    }

    if (!this.browser || !this.page) {
      await this.initialize();
    }

    let retries = 0;
    while (retries < this.maxRetries) {
      try {
        console.log("Logging in to LinkedIn...");
        await this.page.goto('https://www.linkedin.com/login', { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });

        // Clear cookies first
        await this.page.deleteCookie();

        // Enter email
        await this.page.waitForSelector('#username', { timeout: 10000 });
        await this.page.type('#username', this.email, { delay: 100 }); // Simulate human typing

        // Enter password
        await this.page.type('#password', this.password, { delay: 150 });

        // Click login button
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
          this.page.click("button[type='submit']")
        ]);

        // Check if login was successful
        try {
          await this.page.waitForSelector('#global-nav', { timeout: 10000 });
          console.log("Successfully logged in!");
          return true;
        } catch (e) {
          // Check for captcha
          const captchaExists = await this.page.$('#captcha-internal');
          if (captchaExists) {
            throw new Error("CAPTCHA detected. Please solve it manually or try again later.");
          }
          throw e;
        }
      } catch (error) {
        retries++;
        console.error(`Login attempt ${retries} failed: ${error}`);
        if (retries >= this.maxRetries) {
          throw error;
        }
        await this.delay(5000); // Wait before retrying
      }
    }
    return false;
  }

  async getConnections(email, password, maxConnections = null) {
    this.setCredentials(email, password);

    if (!this.browser || !this.page) {
      const initialized = await this.initialize();
      if (!initialized) return { success: false, message: "Failed to initialize browser" };
    }

    try {
      const loggedIn = await this.login();
      if (!loggedIn) return { success: false, message: "Failed to login with provided credentials" };

      console.log("Navigating to connections page...");
      await this.page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for the connections list to load
      await this.page.waitForSelector('.mn-connection-card', { timeout: 10000 });

      console.log("Scrolling to load all connections...");
      let connectionsScraped = 0;
      let lastHeight = 0;
      let currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
      const maxScrollAttempts = 20;
      let scrollAttempts = 0;

      while (scrollAttempts < maxScrollAttempts) {
        lastHeight = currentHeight;
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // Wait for content to load
        await this.delay(2000);
        
        currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
        
        // Count visible connections
        const connections = await this.page.$$('.mn-connection-card');
        connectionsScraped = connections.length;
        console.log(`Loaded ${connectionsScraped} connections so far...`);

        // Check if we've reached the end or hit maxConnections
        if (currentHeight === lastHeight || (maxConnections && connectionsScraped >= maxConnections)) {
          break;
        }
        
        scrollAttempts++;
      }

      console.log(`Loaded ${connectionsScraped} connections. Now extracting data...`);
      return await this.extractConnectionData(maxConnections);
    } catch (error) {
      console.error(`Error getting connections: ${error}`);
      return { success: false, message: error.toString() };
    } finally {
      await this.close();
    }
  }

  async extractConnectionData(maxConnections = null) {
    try {
      // Get all connection cards
      const connections = await this.page.$$('.mn-connection-card');
      
      const connectionsToProcess = maxConnections ? connections.slice(0, maxConnections) : connections;
      
      const total = connectionsToProcess.length;
      console.log(`Found ${total} connections. Extracting data...`);
      
      const results = [];
      
      for (let idx = 0; idx < connectionsToProcess.length; idx++) {
        try {
          const connection = connectionsToProcess[idx];
          
          // Scroll the connection into view
          await this.page.evaluate((el) => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, connection);
          
          await this.delay(500); // Small delay after scrolling
          
          // Extract profile URL
          const profileUrl = await this.page.evaluate(el => {
            const link = el.querySelector('.mn-connection-card__link');
            return link ? link.href.split('?')[0] : null;
          }, connection);
          
          if (!profileUrl) continue; // Skip if no profile URL
          
          // Extract name
          const name = await this.page.evaluate(el => {
            const nameEl = el.querySelector('.mn-connection-card__name');
            return nameEl ? nameEl.textContent.trim() : null;
          }, connection);
          
          // Extract headline (job title)
          let headline = await this.page.evaluate(el => {
            const headlineEl = el.querySelector('.mn-connection-card__occupation');
            return headlineEl ? headlineEl.textContent.trim() : "";
          }, connection);
          
          // Extract connection date if available
          let connectionDate = "";
          try {
            connectionDate = await this.page.evaluate(el => {
              const dateEl = el.querySelector('.time-badge');
              return dateEl ? dateEl.textContent.trim() : "";
            }, connection);
          } catch (e) {
            console.log("Could not extract connection date");
          }
          
          // Build connection data
          const connectionData = {
            profile_url: profileUrl,
            name: name,
            about: headline,
            location: "",
            company: "",
            position: "",
            connection_date: connectionDate,
            scraped_date: new Date(),
            user_email: this.email
          };
          
          // Save to MongoDB
          await this.saveConnection(connectionData);
          
          results.push(connectionData);
          
          if ((idx + 1) % 10 === 0) {
            console.log(`Processed ${idx + 1}/${total} connections...`);
            await this.delay(1000); // Add delay every 10 connections
          }
        } catch (e) {
          console.error(`Error extracting data for connection ${idx + 1}: ${e}`);
        }
      }
      
      return { success: true, data: results };
    } catch (error) {
      console.error(`Error extracting connection data: ${error}`);
      return { success: false, message: error.toString() };
    }
  }

  async getDetailedProfileData(email, password, urls) {
    this.setCredentials(email, password);

    if (!this.browser || !this.page) {
      const initialized = await this.initialize();
      if (!initialized) return { success: false, message: "Failed to initialize browser" };
    }

    try {
      const loggedIn = await this.login();
      if (!loggedIn) return { success: false, message: "Failed to login with provided credentials" };

      console.log(`Getting detailed information for ${urls.length} profiles...`);
      const results = [];
      
      for (let idx = 0; idx < urls.length; idx++) {
        const url = urls[idx];
        let retries = 0;
        let success = false;
        
        while (retries < this.maxRetries && !success) {
          try {
            console.log(`Visiting profile ${idx + 1}/${urls.length}: ${url}`);
            await this.page.goto(url, { 
              waitUntil: 'networkidle2',
              timeout: 30000 
            });
            
            // Random delay between 2-5 seconds
            await this.delay(2000 + Math.random() * 3000);
            
            // Extract location
            let location = "";
            try {
              location = await this.page.$eval(".text-body-small.inline.t-black--light", el => el.textContent.trim());
            } catch (e) {
              console.log("Location not available for this profile");
            }
            
            // Get current company and position
            let company = "";
            let position = "";
            try {
              await this.page.waitForSelector('#experience-section', { timeout: 5000 });
              
              const experienceSection = await this.page.$('#experience-section');
              if (experienceSection) {
                position = await experienceSection.$eval('.t-16', el => el.textContent.trim());
                company = await experienceSection.$eval('.pv-entity__secondary-title', el => el.textContent.trim());
              }
            } catch (e) {
              console.log("Experience details not available for this profile");
            }
            
            // Extract about section if available
            let about = "";
            try {
              await this.page.waitForSelector('#about-section', { timeout: 3000 });
              about = await this.page.$eval('#about-section .pv-about__summary-text', el => el.textContent.trim());
            } catch (e) {
              // About section not available
            }
            
            // Update MongoDB with detailed info
            await Connection.findOneAndUpdate(
              { profile_url: url, user_email: this.email },
              {
                location: location,
                company: company,
                position: position,
                about: about,
                last_updated: new Date()
              },
              { new: true, upsert: true }
            );
            
            results.push({
              profile_url: url,
              location: location,
              company: company,
              position: position,
              about: about
            });
            
            success = true;
          } catch (e) {
            retries++;
            console.error(`Error processing profile ${url} (attempt ${retries}): ${e}`);
            if (retries >= this.maxRetries) {
              console.error(`Failed to process profile ${url} after ${this.maxRetries} attempts`);
              results.push({
                profile_url: url,
                error: `Failed after ${this.maxRetries} attempts: ${e.message}`
              });
            } else {
              await this.delay(5000); // Wait before retrying
            }
          }
        }
        
        // Be nice to LinkedIn servers - random delay between requests
        await this.delay(this.requestDelay + Math.random() * 2000);
      }
      
      return { success: true, data: results };
    } catch (error) {
      console.error(`Error getting detailed profile data: ${error}`);
      return { success: false, message: error.toString() };
    } finally {
      await this.close();
    }
  }

  async saveConnection(connectionData) {
    try {
      const result = await Connection.findOneAndUpdate(
        { profile_url: connectionData.profile_url, user_email: connectionData.user_email },
        connectionData,
        { upsert: true, new: true }
      );
      return result;
    } catch (error) {
      console.error(`Error saving connection to MongoDB: ${error}`);
      throw error;
    }
  }

  async exportToJson(userEmail) {
    try {
      const connections = await Connection.find({ user_email: userEmail }, { _id: 0, __v: 0 }).lean();
      return { success: true, data: connections };
    } catch (error) {
      console.error(`Error exporting connections: ${error}`);
      return { success: false, message: error.toString() };
    }
  }

  async close() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      console.log("Browser closed successfully");
    } catch (error) {
      console.error(`Error closing browser: ${error}`);
    }
  }
}

module.exports = new LinkedInScraperService();