const puppeteer = require("puppeteer")
const config = require("../config/config")
const Connection = require("../models/connections")
const fs = require("fs").promises
const path = require("path")
const axios = require("axios")

class LinkedInScraperService {
  constructor() {
    this.email = null
    this.password = null
    this.headless = config.headless
    this.browser = null
    this.page = null
    this.geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY
    this.captchaDir = path.join(__dirname, "../temp/captchas")
  }

  setCredentials(email, password) {
    this.email = email
    this.password = password
  }

  async initialize() {
    try {
      // Create captcha directory if it doesn't exist
      try {
        await fs.mkdir(this.captchaDir, { recursive: true })
      } catch (err) {
        console.log("Captcha directory already exists or could not be created")
      }

      // Launch the browser with proper flags for cloud environments
      this.browser = await puppeteer.launch({
        headless: true, // Must be true for Render
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
          "--window-size=1920,1080",
          "--disable-notifications",
        ],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
      })

      // Create a new page
      this.page = await this.browser.newPage()

      // Set user agent to avoid detection
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
      )

      return true
    } catch (error) {
      console.error(`Error initializing browser: ${error}`)
      return false
    }
  }

  // Helper function for waiting/timeout since waitForTimeout might not be available
  async delay(time) {
    return new Promise((resolve) => setTimeout(resolve, time))
  }

  async login() {
    if (!this.email || !this.password) {
      throw new Error("LinkedIn credentials not provided")
    }

    if (!this.browser || !this.page) {
      await this.initialize()
    }

    try {
      console.log("Logging in to LinkedIn...")
      await this.page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2" })

      // Take a screenshot to debug
      const loginScreenshot = path.join(this.captchaDir, `login_screen_${Date.now()}.png`)
      await this.page.screenshot({ path: loginScreenshot, fullPage: true })
      console.log(`Saved login screenshot to ${loginScreenshot}`)

      // Enter email
      await this.page.waitForSelector("#username", { timeout: 10000 }).catch((error) => {
        console.error("Username field not found:", error.message)
        throw new Error("Username field not found")
      })

      await this.page.type("#username", this.email)

      // Enter password
      await this.page.type("#password", this.password)

      // Click login button
      await this.page.click("button[type='submit']")

      // Wait for a short time to see if verification appears
      await this.delay(5000)

      // Take a screenshot after login attempt
      const afterLoginScreenshot = path.join(this.captchaDir, `after_login_${Date.now()}.png`)
      await this.page.screenshot({ path: afterLoginScreenshot, fullPage: true })
      console.log(`Saved post-login screenshot to ${afterLoginScreenshot}`)

      // Check for verification challenge
      const hasVerification = await this.checkForVerification()
      if (hasVerification) {
        const verificationSolved = await this.handleVerification()
        if (!verificationSolved) {
          console.error("Failed to solve verification challenge")
          return false
        }
      }

      // Check if we're already logged in by looking for common elements
      const isLoggedIn = await this.checkIfLoggedIn()
      if (isLoggedIn) {
        console.log("Successfully logged in!")
        return true
      }

      // Wait for login to complete (for the global navigation to appear)
      try {
        await this.page.waitForSelector("#global-nav", { timeout: 15000 })
        console.log("Successfully logged in!")
        return true
      } catch (error) {
        console.error(`Error waiting for global-nav: ${error}`)

        // Take another screenshot to see what happened
        const timeoutScreenshot = path.join(this.captchaDir, `timeout_screen_${Date.now()}.png`)
        await this.page.screenshot({ path: timeoutScreenshot, fullPage: true })
        console.log(`Saved timeout screenshot to ${timeoutScreenshot}`)

        // Check if we're on a different page that indicates successful login
        const isLoggedInRetry = await this.checkIfLoggedIn()
        if (isLoggedInRetry) {
          console.log("Successfully logged in despite not finding global-nav!")
          return true
        }

        // Check again for verification
        const hasVerificationRetry = await this.checkForVerification()
        if (hasVerificationRetry) {
          await this.handleVerification()
          // Check one more time if we're logged in
          return await this.checkIfLoggedIn()
        }

        return false
      }
    } catch (error) {
      console.error(`Login error: ${error}`)
      return false
    }
  }

  async checkIfLoggedIn() {
    try {
      // Check for various elements that indicate we're logged in
      const loggedInSelectors = [
        "#global-nav", // Main navigation
        ".feed-identity-module", // Feed identity module
        ".search-global-typeahead", // Search bar
        ".global-nav__me", // Me dropdown
        "a[href='/feed/']", // Feed link
        "a[href='/mynetwork/']", // My Network link
        "a[href='/jobs/']", // Jobs link
        "a[href='/messaging/']", // Messaging link
        "a[href='/notifications/']", // Notifications link
      ]

      for (const selector of loggedInSelectors) {
        const hasElement = await this.page.evaluate((sel) => {
          return document.querySelector(sel) !== null
        }, selector)

        if (hasElement) {
          console.log(`Logged in status confirmed by selector: ${selector}`)
          return true
        }
      }

      // Check for text that might indicate we're logged in
      const pageText = await this.page.evaluate(() => document.body.innerText)
      const loggedInTexts = [
        "Home",
        "My Network",
        "Jobs",
        "Messaging",
        "Notifications",
        "Search",
        "Profile",
        "Work",
        "Premium",
      ]

      for (const text of loggedInTexts) {
        if (pageText.includes(text)) {
          console.log(`Logged in status confirmed by text: ${text}`)
          return true
        }
      }

      // Check URL to see if we're redirected to feed or homepage
      const currentUrl = this.page.url()
      if (
        currentUrl.includes("linkedin.com/feed") ||
        currentUrl.includes("linkedin.com/home") ||
        currentUrl.includes("linkedin.com/mynetwork")
      ) {
        console.log(`Logged in status confirmed by URL: ${currentUrl}`)
        return true
      }

      return false
    } catch (error) {
      console.error(`Error checking if logged in: ${error}`)
      return false
    }
  }

  async checkForVerification() {
    try {
      // Check for various verification elements that might appear
      const verificationSelectors = [
        ".challenge-dialog", // General verification dialog
        'input[name="pin"]', // PIN verification
        ".recaptcha-checkbox-border", // reCAPTCHA
        'img[alt*="captcha"]', // Image CAPTCHA
        'img[alt*="verification"]', // Image verification
        ".captcha-container", // CAPTCHA container
        ".verification-challenge", // Verification challenge
        'button[aria-label*="verify"]', // Verify button
      ]

      for (const selector of verificationSelectors) {
        const hasVerification = await this.page.evaluate((sel) => {
          return document.querySelector(sel) !== null
        }, selector)

        if (hasVerification) {
          console.log(`Verification detected with selector: ${selector}`)
          return true
        }
      }

      // Check for buttons with "verify" text (using proper DOM methods, not jQuery)
      const hasVerifyButton = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"))
        return buttons.some((button) => button.textContent && button.textContent.toLowerCase().includes("verify"))
      })

      if (hasVerifyButton) {
        console.log("Verification detected with button containing 'verify' text")
        return true
      }

      // Check for text that might indicate verification
      const pageText = await this.page.evaluate(() => document.body.innerText)
      const verificationTexts = [
        "verify",
        "verification",
        "captcha",
        "security check",
        "prove you're a person",
        "confirm your identity",
      ]

      for (const text of verificationTexts) {
        if (pageText.toLowerCase().includes(text.toLowerCase())) {
          console.log(`Verification detected with text: ${text}`)
          return true
        }
      }

      return false
    } catch (error) {
      console.error(`Error checking for verification: ${error}`)
      return false
    }
  }

  async handleVerification() {
    try {
      console.log("Handling verification challenge...")

      // Take a screenshot of the entire page
      const screenshotPath = path.join(this.captchaDir, `captcha_${Date.now()}.png`)
      await this.page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`Saved verification screenshot to ${screenshotPath}`)

      // Try to identify the verification type
      const isImageCaptcha = await this.page.evaluate(() => {
        const images = Array.from(document.querySelectorAll("img"))
        return images.some(
          (img) =>
            (img.alt && (img.alt.includes("captcha") || img.alt.includes("verification"))) ||
            (img.src && (img.src.includes("captcha") || img.src.includes("verification"))),
        )
      })

      if (isImageCaptcha) {
        console.log("Image-based CAPTCHA detected")
        return await this.solveImageCaptcha(screenshotPath)
      }

      // Check for PIN verification
      const isPinVerification = await this.page.evaluate(() => {
        return document.querySelector('input[name="pin"]') !== null
      })

      if (isPinVerification) {
        console.log("PIN verification detected")
        // This would require user intervention or email checking
        return await this.handlePinVerification()
      }

      // Check for "I'm not a robot" checkbox
      const isCheckboxCaptcha = await this.page.evaluate(() => {
        return document.querySelector(".recaptcha-checkbox-border") !== null
      })

      if (isCheckboxCaptcha) {
        console.log("Checkbox CAPTCHA detected")
        await this.page.click(".recaptcha-checkbox-border")
        await this.delay(2000)

        // Check if we need to solve an image CAPTCHA after clicking the checkbox
        const hasImageCaptcha = await this.checkForVerification()
        if (hasImageCaptcha) {
          return await this.handleVerification()
        }

        return true
      }

      // Look for a verify button (using proper DOM methods, not jQuery)
      const verifyButton = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"))
        const verifyBtn = buttons.find(
          (btn) =>
            (btn.textContent && btn.textContent.toLowerCase().includes("verify")) ||
            (btn.getAttribute("aria-label") && btn.getAttribute("aria-label").toLowerCase().includes("verify")),
        )
        return verifyBtn ? true : false
      })

      if (verifyButton) {
        console.log("Verify button found, clicking it")
        await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll("button"))
          const verifyBtn = buttons.find(
            (btn) =>
              (btn.textContent && btn.textContent.toLowerCase().includes("verify")) ||
              (btn.getAttribute("aria-label") && btn.getAttribute("aria-label").toLowerCase().includes("verify")),
          )
          if (verifyBtn) verifyBtn.click()
        })
        await this.delay(3000)

        // Check if we need to solve another verification after clicking
        const hasMoreVerification = await this.checkForVerification()
        if (hasMoreVerification) {
          return await this.handleVerification()
        }

        return true
      }

      console.log("Could not identify verification type, attempting to use Gemini API for guidance")
      return await this.getGeminiGuidance(screenshotPath)
    } catch (error) {
      console.error(`Error handling verification: ${error}`)
      return false
    }
  }

  async solveImageCaptcha(screenshotPath) {
    try {
      console.log("Attempting to solve image CAPTCHA with Gemini API")

      if (!this.geminiApiKey) {
        console.error("Gemini API key not provided. Cannot solve CAPTCHA automatically.")
        return false
      }

      // Get the base64 image data
      const imageBuffer = await fs.readFile(screenshotPath)
      const base64Image = imageBuffer.toString("base64")

      // Prepare the request to Gemini API
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${this.geminiApiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: "This is a LinkedIn verification CAPTCHA. Analyze the image and tell me what I need to do to solve it. If there are specific objects to select, tell me their positions (top-left, bottom-right, etc.). If there's text to enter, tell me what the text is. Be as specific as possible.",
                },
                {
                  inline_data: {
                    mime_type: "image/png",
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        },
      )

      // Extract the guidance from Gemini
      const geminiResponse = response.data.candidates[0].content.parts[0].text
      console.log("Gemini API response:", geminiResponse)

      // Implement the solution based on Gemini's guidance
      if (geminiResponse.includes("select") || geminiResponse.includes("click")) {
        // Handle image selection CAPTCHA
        console.log("Gemini suggests clicking specific elements")

        // Extract positions from the response
        const positions = this.extractPositionsFromText(geminiResponse)

        if (positions.length > 0) {
          for (const position of positions) {
            // Convert position description to viewport coordinates
            const coords = await this.getCoordinatesForPosition(position)
            if (coords) {
              await this.page.mouse.click(coords.x, coords.y)
              await this.delay(1000)
            }
          }

          // Look for a submit/verify button after selecting images
          await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button"))
            const submitBtn = buttons.find((btn) =>
              ["submit", "verify", "continue", "next"].some(
                (text) => btn.textContent && btn.textContent.toLowerCase().includes(text),
              ),
            )
            if (submitBtn) submitBtn.click()
          })

          await this.delay(3000)
          return true
        }
      } else if (geminiResponse.includes("type") || geminiResponse.includes("enter")) {
        // Handle text input CAPTCHA
        console.log("Gemini suggests entering text")

        // Extract text to enter
        const textToEnter = this.extractTextToEnter(geminiResponse)

        if (textToEnter) {
          // Find input field
          const inputField = await this.page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll("input"))
            return inputs.find(
              (input) =>
                input.type === "text" || (input.placeholder && input.placeholder.toLowerCase().includes("captcha")),
            )
              ? true
              : false
          })

          if (inputField) {
            await this.page.evaluate((text) => {
              const inputs = Array.from(document.querySelectorAll("input"))
              const input = inputs.find(
                (input) =>
                  input.type === "text" || (input.placeholder && input.placeholder.toLowerCase().includes("captcha")),
              )
              if (input) input.value = text
            }, textToEnter)

            // Submit the form
            await this.page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll("button"))
              const submitBtn = buttons.find((btn) =>
                ["submit", "verify", "continue", "next"].some(
                  (text) => btn.textContent && btn.textContent.toLowerCase().includes(text),
                ),
              )
              if (submitBtn) submitBtn.click()
            })

            await this.delay(3000)
            return true
          }
        }
      }

      console.log("Could not automatically solve the CAPTCHA based on Gemini's guidance")
      return false
    } catch (error) {
      console.error(`Error solving image CAPTCHA: ${error}`)
      return false
    }
  }

  extractPositionsFromText(text) {
    const positionKeywords = [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
      "center",
      "middle",
      "top",
      "bottom",
      "left",
      "right",
    ]

    const positions = []

    for (const keyword of positionKeywords) {
      if (text.toLowerCase().includes(keyword)) {
        positions.push(keyword)
      }
    }

    return positions
  }

  async getCoordinatesForPosition(position) {
    // Get viewport dimensions
    const dimensions = await this.page.evaluate(() => {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
      }
    })

    const width = dimensions.width
    const height = dimensions.height

    // Map position keywords to coordinates
    const positionMap = {
      "top-left": { x: width * 0.25, y: height * 0.25 },
      "top-right": { x: width * 0.75, y: height * 0.25 },
      "bottom-left": { x: width * 0.25, y: height * 0.75 },
      "bottom-right": { x: width * 0.75, y: height * 0.75 },
      center: { x: width * 0.5, y: height * 0.5 },
      middle: { x: width * 0.5, y: height * 0.5 },
      top: { x: width * 0.5, y: height * 0.25 },
      bottom: { x: width * 0.5, y: height * 0.75 },
      left: { x: width * 0.25, y: height * 0.5 },
      right: { x: width * 0.75, y: height * 0.5 },
    }

    return positionMap[position] || null
  }

  extractTextToEnter(text) {
    // Look for patterns like "type X" or "enter X" or "text is X"
    const patterns = [
      /type\s+["']?([^"'.,]+)["']?/i,
      /enter\s+["']?([^"'.,]+)["']?/i,
      /text\s+is\s+["']?([^"'.,]+)["']?/i,
      /captcha\s+(?:says|reads|shows)\s+["']?([^"'.,]+)["']?/i,
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    return null
  }

  async handlePinVerification() {
    console.log("PIN verification requires checking email or phone for a code")
    // This would typically require user intervention
    // For now, we'll return false as we can't automatically handle this
    return false
  }

  async getGeminiGuidance(screenshotPath) {
    try {
      if (!this.geminiApiKey) {
        console.error("Gemini API key not provided. Cannot get guidance.")
        return false
      }

      // Get the base64 image data
      const imageBuffer = await fs.readFile(screenshotPath)
      const base64Image = imageBuffer.toString("base64")

      // Prepare the request to Gemini API
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${this.geminiApiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: "This is a LinkedIn verification screen. Analyze the image and tell me exactly what steps I should take to pass this verification. Be very specific about what elements to click, what text to enter, or what actions to take.",
                },
                {
                  inline_data: {
                    mime_type: "image/png",
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        },
      )

      // Extract the guidance from Gemini
      const geminiResponse = response.data.candidates[0].content.parts[0].text
      console.log("Gemini guidance:", geminiResponse)

      // Try to implement the guidance
      // This is a simplified implementation and may need to be enhanced
      if (geminiResponse.includes("click")) {
        // Extract what to click
        const clickMatch = geminiResponse.match(/click\s+(?:on\s+)?(?:the\s+)?["']?([^"'.,]+)["']?/i)
        if (clickMatch && clickMatch[1]) {
          const elementToClick = clickMatch[1].trim()
          console.log(`Attempting to click on "${elementToClick}"`)

          // Try to find and click the element
          await this.page.evaluate((text) => {
            const elements = Array.from(document.querySelectorAll("button, a, div, span"))
            const element = elements.find(
              (el) =>
                (el.textContent && el.textContent.toLowerCase().includes(text.toLowerCase())) ||
                (el.getAttribute("aria-label") &&
                  el.getAttribute("aria-label").toLowerCase().includes(text.toLowerCase())),
            )
            if (element) element.click()
          }, elementToClick)

          await this.delay(3000)
        }
      }

      if (geminiResponse.includes("type") || geminiResponse.includes("enter")) {
        // Extract what to type
        const typeMatch = geminiResponse.match(/(?:type|enter)\s+["']?([^"'.,]+)["']?/i)
        if (typeMatch && typeMatch[1]) {
          const textToType = typeMatch[1].trim()
          console.log(`Attempting to type "${textToType}"`)

          // Try to find an input field and type the text
          await this.page.evaluate((text) => {
            const inputs = Array.from(document.querySelectorAll("input"))
            const input = inputs.find((input) => input.type === "text")
            if (input) input.value = text
          }, textToType)

          await this.delay(1000)

          // Try to submit
          await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button"))
            const submitBtn = buttons.find((btn) =>
              ["submit", "verify", "continue", "next"].some(
                (text) => btn.textContent && btn.textContent.toLowerCase().includes(text),
              ),
            )
            if (submitBtn) submitBtn.click()
          })

          await this.delay(3000)
        }
      }

      // Check if we've passed the verification
      const stillHasVerification = await this.checkForVerification()
      return !stillHasVerification
    } catch (error) {
      console.error(`Error getting Gemini guidance: ${error}`)
      return false
    }
  }

  async getConnections(email, password, maxConnections = null) {
    // Set credentials
    this.setCredentials(email, password)

    if (!this.browser || !this.page) {
      const initialized = await this.initialize()
      if (!initialized) return { success: false, message: "Failed to initialize browser" }
    }

    try {
      const loggedIn = await this.login()
      if (!loggedIn) return { success: false, message: "Failed to login with provided credentials" }

      console.log("Navigating to connections page...")
      await this.page.goto("https://www.linkedin.com/mynetwork/invite-connect/connections/", {
        waitUntil: "networkidle2",
      })

      // Check for verification after navigation
      const hasVerification = await this.checkForVerification()
      if (hasVerification) {
        const verificationSolved = await this.handleVerification()
        if (!verificationSolved) {
          return { success: false, message: "Failed to solve verification challenge" }
        }
      }

      // Wait for the connections list to load
      try {
        await this.page.waitForSelector(".mn-connection-card", { timeout: 10000 })
      } catch (error) {
        console.error("Could not find connection cards:", error.message)

        // Take a screenshot to see what's on the page
        const connectionsScreenshot = path.join(this.captchaDir, `connections_screen_${Date.now()}.png`)
        await this.page.screenshot({ path: connectionsScreenshot, fullPage: true })
        console.log(`Saved connections page screenshot to ${connectionsScreenshot}`)

        return { success: false, message: "Could not find connection cards on the page" }
      }

      console.log("Scrolling to load all connections...")
      // Scroll down to load more connections
      let connectionsScraped = 0
      let lastHeight = await this.page.evaluate(() => document.body.scrollHeight)

      while (true) {
        // Scroll down
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight)
        })

        // Wait for page to load
        await this.delay(2000)

        // Calculate new scroll height and compare with last scroll height
        const newHeight = await this.page.evaluate(() => document.body.scrollHeight)

        // Count visible connections
        const connections = await this.page.$$(".mn-connection-card")
        connectionsScraped = connections.length
        console.log(`Loaded ${connectionsScraped} connections so far...`)

        // Check if we've reached the end or hit maxConnections
        if (newHeight === lastHeight || (maxConnections && connectionsScraped >= maxConnections)) {
          break
        }
        lastHeight = newHeight
      }

      console.log(`Loaded ${connectionsScraped} connections. Now extracting data...`)
      return await this.extractConnectionData(maxConnections)
    } catch (error) {
      console.error(`Error getting connections: ${error}`)
      return { success: false, message: error.toString() }
    } finally {
      await this.close() // This will run whether the scraping succeeds or fails
    }
  }

  async extractConnectionData(maxConnections = null) {
    try {
      // Get all connection cards
      const connections = await this.page.$$(".mn-connection-card")

      const connectionsToProcess = maxConnections ? connections.slice(0, maxConnections) : connections

      const total = connectionsToProcess.length
      console.log(`Found ${total} connections. Extracting data...`)

      const results = []

      for (let idx = 0; idx < connectionsToProcess.length; idx++) {
        try {
          const connection = connectionsToProcess[idx]

          // Extract profile URL
          const profileUrl = await this.page.evaluate((el) => {
            const link = el.querySelector(".mn-connection-card__link")
            return link ? link.href.split("?")[0] : null
          }, connection)

          // Extract name
          const name = await this.page.evaluate((el) => {
            const nameEl = el.querySelector(".mn-connection-card__name")
            return nameEl ? nameEl.textContent.trim() : null
          }, connection)

          // Extract headline (job title)
          const headline = await this.page.evaluate((el) => {
            const headlineEl = el.querySelector(".mn-connection-card__occupation")
            return headlineEl ? headlineEl.textContent.trim() : ""
          }, connection)

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
            user_email: this.email, // Associate connections with the user who scraped them
          }

          // Save to MongoDB
          await this.saveConnection(connectionData)

          results.push(connectionData)

          if ((idx + 1) % 10 === 0) {
            console.log(`Processed ${idx + 1}/${total} connections...`)
          }
        } catch (e) {
          console.error(`Error extracting data for connection ${idx + 1}: ${e}`)
        }
      }

      return { success: true, data: results }
    } catch (error) {
      console.error(`Error extracting connection data: ${error}`)
      return { success: false, message: error.toString() }
    }
  }

  async getDetailedProfileData(email, password, urls) {
    // Set credentials
    this.setCredentials(email, password)

    if (!this.browser || !this.page) {
      const initialized = await this.initialize()
      if (!initialized) return { success: false, message: "Failed to initialize browser" }
    }

    try {
      const loggedIn = await this.login()
      if (!loggedIn) return { success: false, message: "Failed to login with provided credentials" }

      console.log(`Getting detailed information for ${urls.length} profiles...`)
      const results = []

      for (let idx = 0; idx < urls.length; idx++) {
        const url = urls[idx]
        try {
          console.log(`Visiting profile ${idx + 1}/${urls.length}: ${url}`)
          await this.page.goto(url, { waitUntil: "networkidle2" })

          // Check for verification after navigation
          const hasVerification = await this.checkForVerification()
          if (hasVerification) {
            const verificationSolved = await this.handleVerification()
            if (!verificationSolved) {
              console.error("Failed to solve verification challenge, continuing to next profile")
              continue
            }
          }

          await this.delay(2000) // Allow page to fully load

          // Take a screenshot of the profile page for debugging
          const profileScreenshot = path.join(this.captchaDir, `profile_${idx}_${Date.now()}.png`)
          await this.page.screenshot({ path: profileScreenshot, fullPage: true })
          console.log(`Saved profile screenshot to ${profileScreenshot}`)

          // Extract location
          let location = ""
          try {
            location = await this.page.$eval("span.text-body-small.inline", (el) => el.textContent.trim())
          } catch (e) {
            console.log("Location not available for this profile")
            // Location not available
          }

          // Get current company and position
          let company = ""
          let position = ""
          try {
            await this.page.waitForSelector("#experience-section", { timeout: 5000 })

            position = await this.page.$eval("#experience-section li .t-16", (el) => el.textContent.trim())
            company = await this.page.$eval("#experience-section li .pv-entity__secondary-title", (el) =>
              el.textContent.trim(),
            )
          } catch (e) {
            console.log("Experience details not available for this profile")
            // Experience details not available
          }

          // Update MongoDB with detailed info
          await Connection.findOneAndUpdate(
            { profile_url: url, user_email: this.email },
            {
              location: location,
              company: company,
              position: position,
              last_updated: new Date(),
            },
            { new: true },
          )

          results.push({
            profile_url: url,
            location: location,
            company: company,
            position: position,
          })

          // Be nice to LinkedIn servers
          await this.delay(3000)
        } catch (e) {
          console.error(`Error processing profile ${url}: ${e}`)
        }
      }

      return { success: true, data: results }
    } catch (error) {
      console.error(`Error getting detailed profile data: ${error}`)
      return { success: false, message: error.toString() }
    } finally {
      await this.close() // This will run whether the scraping succeeds or fails
    }
  }

  async saveConnection(connectionData) {
    try {
      await Connection.findOneAndUpdate(
        { profile_url: connectionData.profile_url, user_email: connectionData.user_email },
        connectionData,
        { upsert: true, new: true },
      )
    } catch (error) {
      console.error(`Error saving connection to MongoDB: ${error}`)
    }
  }

  async exportToJson(userEmail) {
    try {
      const connections = await Connection.find({ user_email: userEmail }, { _id: 0 }).lean()
      return { success: true, data: connections }
    } catch (error) {
      console.error(`Error exporting connections: ${error}`)
      return { success: false, message: error.toString() }
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close()
        this.browser = null
        this.page = null
        console.log("Browser closed")
      }
    } catch (error) {
      console.error(`Error closing browser: ${error}`)
    }
  }
}

module.exports = new LinkedInScraperService()
