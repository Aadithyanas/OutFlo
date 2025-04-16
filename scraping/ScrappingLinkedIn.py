from flask import Flask, request, jsonify
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time
import json
import os
from datetime import datetime
import pymongo
from threading import Lock
import logging

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LinkedInScraperServer:
    def __init__(self, mongo_uri="mongodb+srv://aadithyanmerin:AdithyanMerin@cluster0.syz6u.mongodb.net/", db_name="linkedin_db"):
        # Setup MongoDB connection
        try:
            self.client = pymongo.MongoClient(mongo_uri)
            self.db = self.client[db_name]
            self.connections_collection = self.db['connections']
            self.sessions_collection = self.db['scraper_sessions']
            
            # Create indexes
            self.connections_collection.create_index([("profile_url", pymongo.ASCENDING)], unique=True)
            self.sessions_collection.create_index([("session_id", pymongo.ASCENDING)], unique=True)
            
            logger.info(f"Connected to MongoDB: {db_name}")
        except Exception as e:
            logger.error(f"Error connecting to MongoDB: {str(e)}")
            raise
        
        # Thread-safe lock for driver operations
        self.driver_lock = Lock()
        self.active_drivers = {}
    
    def create_driver(self, session_id, headless=True):
        """Create a new Chrome driver instance for a session"""
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-notifications")
        
        driver = webdriver.Chrome(options=chrome_options)
        self.active_drivers[session_id] = driver
        return driver
    
    def get_driver(self, session_id):
        """Get the driver for a session or create a new one"""
        with self.driver_lock:
            if session_id not in self.active_drivers:
                self.create_driver(session_id)
            return self.active_drivers[session_id]
    
    def close_driver(self, session_id):
        """Close and remove a driver for a session"""
        with self.driver_lock:
            if session_id in self.active_drivers:
                try:
                    self.active_drivers[session_id].quit()
                except:
                    pass
                del self.active_drivers[session_id]
    
    def login(self, session_id, email, password):
        """Login to LinkedIn with provided credentials"""
        driver = self.get_driver(session_id)
        logger.info(f"Logging in to LinkedIn for session {session_id}")
        
        try:
            driver.get('https://www.linkedin.com/login')
            
            # Enter email
            email_field = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, 'username')))
            email_field.send_keys(email)
            
            # Enter password
            password_field = driver.find_element(By.ID, 'password')
            password_field.send_keys(password)
            
            # Click login button
            login_button = driver.find_element(By.XPATH, "//button[@type='submit']")
            login_button.click()
            
            # Wait for login to complete
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, 'global-nav')))
            logger.info(f"Successfully logged in for session {session_id}")
            
            # Save session info
            self.sessions_collection.update_one(
                {"session_id": session_id},
                {"$set": {
                    "email": email,
                    "logged_in": True,
                    "last_activity": datetime.now()
                }},
                upsert=True
            )
            
            return {"status": "success", "message": "Logged in successfully"}
            
        except TimeoutException:
            error_msg = "Login failed. Check your credentials or if there's a CAPTCHA challenge."
            logger.error(f"Login failed for session {session_id}: {error_msg}")
            return {"status": "error", "message": error_msg}
        except Exception as e:
            error_msg = f"Login error: {str(e)}"
            logger.error(f"Login error for session {session_id}: {error_msg}")
            return {"status": "error", "message": error_msg}
    
    def get_connections(self, session_id, max_connections=None):
        """Navigate to connections page and scrape data"""
        driver = self.get_driver(session_id)
        logger.info(f"Getting connections for session {session_id}")
        
        try:
            driver.get('https://www.linkedin.com/mynetwork/invite-connect/connections/')
            
            # Wait for the connections list to load
            try:
                WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CLASS_NAME, 'mn-connection-card')))
            except TimeoutException:
                error_msg = "Could not load connections page."
                logger.error(error_msg)
                return {"status": "error", "message": error_msg}
            
            logger.info("Scrolling to load all connections...")
            # Scroll down to load more connections
            connections_scraped = 0
            last_height = driver.execute_script("return document.body.scrollHeight")
            
            while True:
                # Scroll down
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                
                # Wait for page to load
                time.sleep(2)
                
                # Calculate new scroll height and compare with last scroll height
                new_height = driver.execute_script("return document.body.scrollHeight")
                
                # Check if we've reached the end or hit max_connections
                if new_height == last_height:
                    break
                if max_connections and connections_scraped >= max_connections:
                    break
                    
                last_height = new_height
                
                # Count visible connections
                connections = driver.find_elements(By.CLASS_NAME, 'mn-connection-card')
                connections_scraped = len(connections)
                logger.info(f"Loaded {connections_scraped} connections so far...")
                
                if max_connections and connections_scraped >= max_connections:
                    break
            
            logger.info(f"Loaded {connections_scraped} connections. Now extracting data...")
            return self.extract_connection_data(session_id, max_connections)
            
        except Exception as e:
            error_msg = f"Error getting connections: {str(e)}"
            logger.error(f"Error in get_connections for session {session_id}: {error_msg}")
            return {"status": "error", "message": error_msg}
    
    def extract_connection_data(self, session_id, max_connections=None):
        """Extract data from each connection card"""
        driver = self.get_driver(session_id)
        
        try:
            connections = driver.find_elements(By.CLASS_NAME, 'mn-connection-card')
            
            if max_connections:
                connections = connections[:max_connections]
            
            total = len(connections)
            logger.info(f"Found {total} connections. Extracting data...")
            
            results = []
            for idx, connection in enumerate(connections):
                try:
                    # Extract profile URL
                    profile_url = connection.find_element(By.CLASS_NAME, 'mn-connection-card__link').get_attribute('href').split('?')[0]
                    
                    # Extract name
                    name_elem = connection.find_element(By.CLASS_NAME, 'mn-connection-card__name')
                    name = name_elem.text if name_elem else "Unknown"
                    
                    # Extract headline (job title)
                    try:
                        headline_elem = connection.find_element(By.CLASS_NAME, 'mn-connection-card__occupation')
                        headline = headline_elem.text
                    except NoSuchElementException:
                        headline = ""
                    
                    # Build connection data
                    connection_data = {
                        'profile_url': profile_url,
                        'name': name,
                        'about': headline,
                        'location': "",  # Will need to visit profile page for this
                        'company': "",   # Will need to visit profile page for this
                        'position': "",  # Extracted from headline if possible
                        'connection_date': "",  # Will need additional parsing
                        'scraped_date': datetime.now(),
                        'session_id': session_id
                    }
                    
                    # Save to MongoDB
                    self.save_connection(connection_data)
                    
                    results.append(connection_data)
                    
                    if (idx + 1) % 10 == 0:
                        logger.info(f"Processed {idx + 1}/{total} connections...")
                    
                except Exception as e:
                    logger.error(f"Error extracting data for connection {idx + 1}: {str(e)}")
            
            # Update session info
            self.sessions_collection.update_one(
                {"session_id": session_id},
                {"$set": {
                    "last_activity": datetime.now(),
                    "connections_count": len(results)
                }}
            )
            
            return {
                "status": "success",
                "message": f"Successfully scraped {len(results)} connections",
                "data": results
            }
        
        except Exception as e:
            error_msg = f"Error extracting connection data: {str(e)}"
            logger.error(f"Error in extract_connection_data for session {session_id}: {error_msg}")
            return {"status": "error", "message": error_msg}
    
    def get_detailed_profile_data(self, session_id, profile_urls):
        """Visit each profile and get more detailed information"""
        driver = self.get_driver(session_id)
        logger.info(f"Getting detailed information for {len(profile_urls)} profiles in session {session_id}")
        
        results = []
        
        for idx, url in enumerate(profile_urls):
            try:
                logger.info(f"Visiting profile {idx + 1}/{len(profile_urls)}: {url}")
                driver.get(url)
                time.sleep(2)  # Allow page to load
                
                # Extract data here (customize based on what you need)
                try:
                    location = driver.find_element(By.XPATH, "//span[contains(@class, 'text-body-small') and contains(@class, 'inline')]").text
                except:
                    location = ""
                
                # Get current company and position
                try:
                    experience_section = driver.find_element(By.ID, "experience-section")
                    first_position = experience_section.find_element(By.TAG_NAME, "li")
                    company = first_position.find_element(By.CLASS_NAME, "pv-entity__secondary-title").text
                    position = first_position.find_element(By.CLASS_NAME, "t-16").text
                except:
                    company = ""
                    position = ""
                
                # Update MongoDB with detailed info
                self.connections_collection.update_one(
                    {"profile_url": url},
                    {"$set": {
                        "location": location,
                        "company": company,
                        "position": position,
                        "last_updated": datetime.now()
                    }}
                )
                
                results.append({
                    'profile_url': url,
                    'location': location,
                    'company': company,
                    'position': position
                })
                
                # Be nice to LinkedIn servers
                time.sleep(3)
                
            except Exception as e:
                logger.error(f"Error processing profile {url}: {str(e)}")
        
        # Update session info
        self.sessions_collection.update_one(
            {"session_id": session_id},
            {"$set": {
                "last_activity": datetime.now(),
                "profiles_processed": len(results)
            }}
        )
        
        return {
            "status": "success",
            "message": f"Processed {len(results)} profiles",
            "data": results
        }
    
    def save_connection(self, connection_data):
        """Save or update connection data in MongoDB"""
        try:
            # Use upsert to either insert a new document or update an existing one
            self.connections_collection.update_one(
                {"profile_url": connection_data["profile_url"]},
                {"$set": connection_data},
                upsert=True
            )
        except Exception as e:
            logger.error(f"Error saving connection to MongoDB: {str(e)}")
    
    def get_connections_from_db(self, session_id=None):
        """Retrieve connections from MongoDB, optionally filtered by session_id"""
        query = {}
        if session_id:
            query["session_id"] = session_id
        
        try:
            connections = list(self.connections_collection.find(query, {"_id": 0}))
            
            # Convert datetime objects to strings for JSON serialization
            for conn in connections:
                if 'scraped_date' in conn and isinstance(conn['scraped_date'], datetime):
                    conn['scraped_date'] = conn['scraped_date'].isoformat()
                if 'last_updated' in conn and isinstance(conn['last_updated'], datetime):
                    conn['last_updated'] = conn['last_updated'].isoformat()
            
            return {
                "status": "success",
                "message": f"Found {len(connections)} connections",
                "data": connections
            }
        except Exception as e:
            error_msg = f"Error retrieving connections from DB: {str(e)}"
            logger.error(error_msg)
            return {"status": "error", "message": error_msg}
    
    def cleanup_session(self, session_id):
        """Clean up resources for a session"""
        self.close_driver(session_id)
        logger.info(f"Cleaned up resources for session {session_id}")

# Initialize the scraper server
scraper_server = LinkedInScraperServer()

# API Endpoints
@app.route('/api/session', methods=['POST'])
def create_session():
    """Create a new scraping session"""
    session_id = request.json.get('session_id') or f"session_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    return jsonify({"status": "success", "session_id": session_id})

@app.route('/api/login', methods=['POST'])
def login():
    """Login to LinkedIn"""
    data = request.json
    session_id = data.get('session_id')
    email = data.get('email')
    password = data.get('password')
    
    if not all([session_id, email, password]):
        return jsonify({"status": "error", "message": "Missing required parameters"}), 400
    
    result = scraper_server.login(session_id, email, password)
    return jsonify(result)

@app.route('/api/connections', methods=['GET', 'POST'])
def connections():
    """Get connections from LinkedIn or from database"""
    if request.method == 'POST':
        # Scrape new connections
        data = request.json
        session_id = data.get('session_id')
        max_connections = data.get('max_connections')
        
        if not session_id:
            return jsonify({"status": "error", "message": "session_id is required"}), 400
        
        result = scraper_server.get_connections(session_id, max_connections)
        return jsonify(result)
    else:
        # Get connections from database
        session_id = request.args.get('session_id')
        result = scraper_server.get_connections_from_db(session_id)
        return jsonify(result)

@app.route('/api/profiles', methods=['POST'])
def profiles():
    """Get detailed profile information"""
    data = request.json
    session_id = data.get('session_id')
    profile_urls = data.get('profile_urls')
    
    if not all([session_id, profile_urls]):
        return jsonify({"status": "error", "message": "session_id and profile_urls are required"}), 400
    
    if not isinstance(profile_urls, list):
        return jsonify({"status": "error", "message": "profile_urls must be a list"}), 400
    
    result = scraper_server.get_detailed_profile_data(session_id, profile_urls)
    return jsonify(result)

@app.route('/api/cleanup', methods=['POST'])
def cleanup():
    """Clean up session resources"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({"status": "error", "message": "session_id is required"}), 400
    
    scraper_server.cleanup_session(session_id)
    return jsonify({"status": "success", "message": f"Session {session_id} cleaned up"})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, threaded=True)