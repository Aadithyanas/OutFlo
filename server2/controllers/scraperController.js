const puppeteer = require('puppeteer');
const config = require('../config/config');
const Connection = require('../models/connections');
require('dotenv').config()

class LinkedInScraperService {
  constructor() {
    this.email = null;
    this.password = null;
    this.headless = config.headless;
    this.browser = null;
    this.page = null;
  }

  setCredentials(email, password) {
    this.email = email;
    this.password = password;
  }

  async initialize() {
    try {
      // Launch the browser
      this.browser = await puppeteer.launch({
        
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-notifications',
          '--window-size=1920,1080'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        
      });

      // Create a new page
      this.page = await this.browser.newPage();
      
      // Set user agent to avoid detection
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36');
      
      return true;
    } catch (error) {
      console.error(`Error initializing browser: ${error}`);
      return false;
    }
  }

  // Helper function for waiting/timeout since waitForTimeout might not be available
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

    try {
      console.log("Logging in to LinkedIn...");
      await this.page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });

      // Enter email
      await this.page.waitForSelector('#username', { timeout: 10000 });
      await this.page.type('#username', this.email);

      // Enter password
      await this.page.type('#password', this.password);

      // Click login button
      await this.page.click("button[type='submit']");

      // Wait for login to complete (for the global navigation to appear)
      await this.page.waitForSelector('#global-nav', { timeout: 10000 });
      console.log("Successfully logged in!");
      return true;
    } catch (error) {
      console.error(`Login error: ${error}`);
      return false;
    }
  }

  async getConnections(email, password, maxConnections = null) {
    // Set credentials
    this.setCredentials(email, password);

    if (!this.browser || !this.page) {
      const initialized = await this.initialize();
      if (!initialized) return { success: false, message: "Failed to initialize browser" };
    }

    try {
      const loggedIn = await this.login();
      if (!loggedIn) return { success: false, message: "Failed to login with provided credentials" };

      console.log("Navigating to connections page...");
      await this.page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', { waitUntil: 'networkidle2' });

      // Wait for the connections list to load
      await this.page.waitForSelector('.mn-connection-card', { timeout: 10000 });

      console.log("Scrolling to load all connections...");
      // Scroll down to load more connections
      let connectionsScraped = 0;
      let lastHeight = await this.page.evaluate(() => document.body.scrollHeight);

      while (true) {
        // Scroll down
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });

        // Wait for page to load
        await this.delay(2000);

        // Calculate new scroll height and compare with last scroll height
        let newHeight = await this.page.evaluate(() => document.body.scrollHeight);

        // Count visible connections
        let connections = await this.page.$$('.mn-connection-card');
        connectionsScraped = connections.length;
        console.log(`Loaded ${connectionsScraped} connections so far...`);

        // Check if we've reached the end or hit maxConnections
        if (newHeight === lastHeight || (maxConnections && connectionsScraped >= maxConnections)) {
          break;
        }
        lastHeight = newHeight;
      }

      console.log(`Loaded ${connectionsScraped} connections. Now extracting data...`);
      return await this.extractConnectionData(maxConnections);
    } catch (error) {
      console.error(`Error getting connections: ${error}`);
      return { success: false, message: error.toString() };
    } finally {
      await this.close(); // This will run whether the scraping succeeds or fails
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
          
          // Extract profile URL
          const profileUrl = await this.page.evaluate(el => {
            const link = el.querySelector('.mn-connection-card__link');
            return link ? link.href.split('?')[0] : null;
          }, connection);
          
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
          
          // Build connection data
          const connectionData = {
            profile_url: profileUrl,
            name: name,
            about: headline,
            location: "",
            company: "",
            position: "",
            connection_date: "",
            scraped_date: new Date(),
            user_email: this.email // Associate connections with the user who scraped them
          };
          
          // Save to MongoDB
          await this.saveConnection(connectionData);
          
          results.push(connectionData);
          
          if ((idx + 1) % 10 === 0) {
            console.log(`Processed ${idx + 1}/${total} connections...`);
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
    // Set credentials
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
        try {
          console.log(`Visiting profile ${idx + 1}/${urls.length}: ${url}`);
          await this.page.goto(url, { waitUntil: 'networkidle2' });
          await this.delay(2000); // Allow page to fully load
          
          // Extract location
          let location = "";
          try {
            location = await this.page.$eval("span.text-body-small.inline", el => el.textContent.trim());
          } catch (e) {
            // Location not available
          }
          
          // Get current company and position
          let company = "";
          let position = "";
          try {
            await this.page.waitForSelector('#experience-section', { timeout: 5000 });
            
            position = await this.page.$eval('#experience-section li .t-16', el => el.textContent.trim());
            company = await this.page.$eval('#experience-section li .pv-entity__secondary-title', el => el.textContent.trim());
          } catch (e) {
            // Experience details not available
          }
          
          // Update MongoDB with detailed info
          await Connection.findOneAndUpdate(
            { profile_url: url, user_email: this.email },
            {
              location: location,
              company: company,
              position: position,
              last_updated: new Date()
            },
            { new: true }
          );
          
          results.push({
            profile_url: url,
            location: location,
            company: company,
            position: position
          });
          
          // Be nice to LinkedIn servers
          await this.delay(3000);
        } catch (e) {
          console.error(`Error processing profile ${url}: ${e}`);
        }
      }
      
      return { success: true, data: results };
    } catch (error) {
      console.error(`Error getting detailed profile data: ${error}`);
      return { success: false, message: error.toString() };
    } finally {
      await this.close(); // This will run whether the scraping succeeds or fails
    }
  }

  async saveConnection(connectionData) {
    try {
      await Connection.findOneAndUpdate(
        { profile_url: connectionData.profile_url, user_email: connectionData.user_email },
        connectionData,
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error(`Error saving connection to MongoDB: ${error}`);
    }
  }

  async exportToJson(userEmail) {
    try {
      const connections = await Connection.find({ user_email: userEmail }, { _id: 0 }).lean();
      return { success: true, data: connections };
    } catch (error) {
      console.error(`Error exporting connections: ${error}`);
      return { success: false, message: error.toString() };
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        console.log("Browser closed");
      }
    } catch (error) {
      console.error(`Error closing browser: ${error}`);
    }
  }
}

module.exports = new LinkedInScraperService();