// src/services/aiService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

dotenv.config();

const GEMINI_API_KEY = "AIzaSyCTVtWact-y76MTpujnerE0CmgQsBl2KT0";

if (!GEMINI_API_KEY) {
  throw new Error("Gemini API key not found in environment variables");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash", // or "gemini-2.0-flash"
});

const generationConfig = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 500,
  responseMimeType: "text/plain",
};

const chatSession = model.startChat({
  generationConfig,
  history: [],
});

/**
 * Generate personalized outreach message for a LinkedIn profile
 * @param {Object} profileData
 * @returns {Promise<string>}
 */
const generatePersonalizedMessage = async (profileData) => {
  try {
    const prompt = `
You are an AI assistant that creates short, friendly, and personalized outreach messages for sales professionals.

Generate a message based on the LinkedIn profile below. Mention their role, company, and location, and suggest connecting to discuss our outreach automation tool, Outflo.

Name: ${profileData.name}
Job Title: ${profileData.job_title}
Company: ${profileData.company}
Location: ${profileData.location}
Summary: ${profileData.summary}

Write the message in a warm, conversational tone and keep it concise.
`;

    const result = await chatSession.sendMessage(prompt);
    const responseText = await result.response.text();
    return responseText.trim().replace(/\s+/g, " ");
  } catch (error) {
    console.error("Error generating personalized message:", error.message || error);
    throw new Error("Failed to generate personalized message");
  }
};

module.exports = {
  generatePersonalizedMessage,
};
