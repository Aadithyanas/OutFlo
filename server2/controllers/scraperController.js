const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const config = require('../config/config');
const Connection = require('../models/connections');

class LinkedInScraperService {
  constructor() {
    this.email = null;
    this.password = null;
    this.headless = config.headless;
    this.driver = null;
  }

  setCredentials(email, password) {
    this.email = email;
    this.password = password;
  }

  async initialize() {
    try {
      // Setup Chrome options
      let options = new chrome.Options();
      if (this.headless) {
        options.addArguments('--headless');
      }
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');
      options.addArguments('--disable-gpu');
      options.addArguments('--window-size=1920,1080');
      options.addArguments('--disable-notifications');

      // Initialize the Chrome driver
      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

      return true;
    } catch (error) {
      console.error(`Error initializing driver: ${error}`);
      return false;
    }
  }

  async login() {
    if (!this.email || !this.password) {
      throw new Error("LinkedIn credentials not provided");
    }

    if (!this.driver) {
      await this.initialize();
    }

    try {
      console.log("Logging in to LinkedIn...");
      await this.driver.get('https://www.linkedin.com/login');

      // Enter email
      const emailField = await this.driver.wait(until.elementLocated(By.id('username')), 10000);
      await emailField.sendKeys(this.email);

      // Enter password
      const passwordField = await this.driver.findElement(By.id('password'));
      await passwordField.sendKeys(this.password);

      // Click login button
      const loginButton = await this.driver.findElement(By.xpath("//button[@type='submit']"));
      await loginButton.click();

      // Wait for login to complete
      await this.driver.wait(until.elementLocated(By.id('global-nav')), 10000);
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

    if (!this.driver) {
      const initialized = await this.initialize();
      if (!initialized) return { success: false, message: "Failed to initialize driver" };
    }

    try {
      const loggedIn = await this.login();
      if (!loggedIn) return { success: false, message: "Failed to login with provided credentials" };

      console.log("Navigating to connections page...");
      await this.driver.get('https://www.linkedin.com/mynetwork/invite-connect/connections/');

      // Wait for the connections list to load
      await this.driver.wait(until.elementLocated(By.className('mn-connection-card')), 10000);

      console.log("Scrolling to load all connections...");
      // Scroll down to load more connections
      let connectionsScraped = 0;
      let lastHeight = await this.driver.executeScript("return document.body.scrollHeight");

      while (true) {
        // Scroll down
        await this.driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");

        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Calculate new scroll height and compare with last scroll height
        let newHeight = await this.driver.executeScript("return document.body.scrollHeight");

        // Count visible connections
        let connections = await this.driver.findElements(By.className('mn-connection-card'));
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
      const connections = await this.driver.findElements(By.className('mn-connection-card'));
      
      const connectionsToProcess = maxConnections ? connections.slice(0, maxConnections) : connections;
      
      const total = connectionsToProcess.length;
      console.log(`Found ${total} connections. Extracting data...`);
      
      const results = [];
      
      for (let idx = 0; idx < connectionsToProcess.length; idx++) {
        try {
          const connection = connectionsToProcess[idx];
          
          // Extract profile URL
          const profileLink = await connection.findElement(By.className('mn-connection-card__link'));
          const profileUrl = (await profileLink.getAttribute('href')).split('?')[0];
          
          // Extract name
          const nameElem = await connection.findElement(By.className('mn-connection-card__name'));
          const name = await nameElem.getText();
          
          // Extract headline (job title)
          let headline = "";
          try {
            const headlineElem = await connection.findElement(By.className('mn-connection-card__occupation'));
            headline = await headlineElem.getText();
          } catch (e) {
            // Headline not available
          }
          
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

    if (!this.driver) {
      const initialized = await this.initialize();
      if (!initialized) return { success: false, message: "Failed to initialize driver" };
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
          await this.driver.get(url);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Allow page to load
          
          // Extract location
          let location = "";
          try {
            const locationElem = await this.driver.findElement(By.xpath("//span[contains(@class, 'text-body-small') and contains(@class, 'inline')]"));
            location = await locationElem.getText();
          } catch (e) {
            // Location not available
          }
          
          // Get current company and position
          let company = "";
          let position = "";
          try {
            const experienceSection = await this.driver.findElement(By.id("experience-section"));
            const firstPosition = await experienceSection.findElement(By.tagName("li"));
            const companyElem = await firstPosition.findElement(By.className("pv-entity__secondary-title"));
            company = await companyElem.getText();
            const positionElem = await firstPosition.findElement(By.className("t-16"));
            position = await positionElem.getText();
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
          await new Promise(resolve => setTimeout(resolve, 3000));
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
      if (this.driver) {
        await this.driver.quit();
        this.driver = null;
        console.log("Browser closed");
      }
    } catch (error) {
      console.error(`Error closing browser: ${error}`);
    }
  }
}

module.exports = new LinkedInScraperService();