
# OutFlo-Assignment

This project is a **Campaign Management System** developed as part of an OutFlo technical task. It includes full-stack features such as:
- RESTful API backend with campaign CRUD functionality
- AI-powered message generation based on LinkedIn profiles
- LinkedIn profile scraping (Python + Selenium & Node.js + Puppeteer)
- Frontend dashboard for campaign management and message testing

---

## 📁 Project Structure

```
client/          # Frontend (React + TypeScript)
scraping/        # Python-based LinkedIn scraping scripts
 ├── scraper_sample.py       # Fetches connection sample data
 └── scraper_details.py      # Scrapes detailed profile information
server/          # Backend (CRUD APIs + AI message generation)
server2/         # Puppeteer-based scraping backend integrated with frontend
README.md
package.json
```

---

## ⚙️ Backend Overview (Node.js + Express + TypeScript + MongoDB)

### 🔌 Features

#### 🔧 Campaign CRUD APIs
| Method | Endpoint            | Description                          |
|--------|---------------------|--------------------------------------|
| GET    | `/campaigns`        | Fetch all campaigns (excluding DELETED) |
| GET    | `/campaigns/:id`    | Get campaign by ID                   |
| POST   | `/campaigns`        | Create a new campaign                |
| PUT    | `/campaigns/:id`    | Update campaign info or status       |
| DELETE | `/campaigns/:id`    | Soft delete (set status to DELETED)  |

Each campaign has the following structure:
```json
{
  "name": "Campaign 1",
  "description": "Find leads in X industry",
  "status": "active",
  "leads": ["https://linkedin.com/in/example1", "https://linkedin.com/in/example2"],
  "accountIDs": ["abc123", "def456"]
}
```

#### 🤖 AI Outreach Message Generator
| Method | Endpoint                | Description                             |
|--------|-------------------------|-----------------------------------------|
| POST   | `/personalized-message` | Generates LinkedIn outreach message using AI |

**Payload Example:**
```json
{
  "name": "Jane Smith",
  "job_title": "CTO",
  "company": "InnovateX",
  "location": "New York",
  "summary": "Experienced leader in product and tech strategy..."
}
```

**Response Example:**
```json
{
  "message": "Hi Jane, I noticed you're the CTO at InnovateX. Outflo can help boost your outreach process using smart automation. Let's connect!"
}
```

✅ Implemented using Gemini AI (or OpenAI, Claude, or LlamaIndex – all using free tiers).

---

## 🌐 Frontend Overview (React + TypeScript)

### 🧩 Features

- **Campaign Dashboard**:
  - List all campaigns
  - Create, Edit, Delete campaigns
  - Toggle Active/Inactive status

- **AI Message Generator**:
  - Form to input profile details
  - AI-generated output shown below
  - Editable sample input fields for testing

- **Scraped Lead Viewer** (via server2):
  - UI to search & view leads scraped from LinkedIn
  - Pulled from local MongoDB (server2 + Puppeteer integration)

---

## 🕷️ Scraping Functionality

### 📂 Scraping Folder (`scraping/`)

Implemented in **Python using Selenium** for automation of LinkedIn profile scraping.

1. **`scraper_sample.py`**
   - Logs into LinkedIn
   - Extracts basic sample data of your first-degree connections
   - Generates mock dataset for testing

2. **`scraper_details.py`**
   - Takes URLs from the sample data
   - Scrapes detailed information:
     - Full Name
     - Job Title
     - Company
     - Location
     - LinkedIn Profile URL

🔒 _Requires your own LinkedIn login session. Use carefully and respect LinkedIn's TOS. Mimics human behavior using delay and scrolling._

---

### 📂 `server2/` Folder

Backend written in **Node.js using Puppeteer**.

- Scrapes live LinkedIn profile data via Puppeteer
- Fetches and stores profiles in MongoDB
- Fully connected to the frontend for user search
- Lets users interact with scraped data directly in the browser

This acts as an **alternate server** combining:
- Scraping
- Campaign integration
- Searchable frontend UI for scraped leads

---

## 🧪 Tech Stack

| Layer       | Stack                                    |
|-------------|------------------------------------------|
| Backend     | Node.js, Express, TypeScript, MongoDB    |
| Frontend    | React, TypeScript                        |
| Scraping    | Python (Selenium), Node.js (Puppeteer)   |
| AI          | Gemini AI / OpenAI API (free tier)       |
| Deployment  | Render (backend), Vercel/Netlify (frontend) |

---

## 🚀 Deployment

| Service  | Link |
|----------|------|
| GitHub Repository | [GitHub - OutFlo-Assignment](https://github.com/YOUR_USERNAME/OutFlo-Assignment) |
| Frontend Live     | https://your-vercel-or-netlify-link |
| Backend Live      | https://your-render-link |

---

## ✅ Assignment Checklist

- [x] Campaign CRUD APIs (with status handling)
- [x] AI message generation via `/personalized-message`
- [x] React frontend with form-based campaign UI
- [x] Python-based scraping with Selenium (local use)
- [x] Node.js Puppeteer scraping (integrated into UI via server2)
- [x] Data stored in MongoDB
- [x] Fully deployed and testable project

---

## 📸 (Optional) Screenshots

- Campaign dashboard UI
- Message generator with AI result
- Scraped leads view from UI (via server2)

---

## 📝 Notes

- Scraping scripts (Python and Puppeteer) should be run locally.
- Credentials and headless sessions not deployed for safety reasons.
- All APIs and UIs are testable on deployment links.

---

## 📞 Submission Details

- Submit GitHub repo and deployed project via **Google Form**.
- Optional: Share on Internshala chat.
- For urgent queries: **Akshat - 80521 60589** (Do not spam)
