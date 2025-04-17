module.exports = {
    mongoURI: process.env.MONGO_URI || "mongodb+srv://aadithyanmerin:AdithyanMerin@cluster0.syz6u.mongodb.net/linkedin_db",
    headless: false, // Set to true for production, false for debugging
    geminiApiKey: "AIzaSyCTVtWact-y76MTpujnerE0CmgQsBl2KT0", // Gemini API key for CAPTCHA solving
    // Add any other configuration options here
    captchaTimeout: 30000, // Timeout for CAPTCHA solving in milliseconds
    maxRetries: 3, // Maximum number of retries for verification challenges
    userDataDir: "./user-data", // Directory to store user data for persistent sessions
    debug: false, // Enable debug logging
  };