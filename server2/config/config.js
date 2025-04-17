module.exports = {
    mongoURI: process.env.MONGO_URI || "mongodb+srv://aadithyanmerin:AdithyanMerin@cluster0.syz6u.mongodb.net/linkedin_db",
    headless: process.env.HEADLESS === 'true'
  };