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

class LinkedInScraper:
    def __init__(self, email, password, headless=False, 
                 mongo_uri="mongodb+srv://aadithyanmerin:AdithyanMerin@cluster0.syz6u.mongodb.net/", db_name="linkedin_db"):
        self.email = email
        self.password = password
        
        # Setup Chrome options
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-notifications")
        
        # Initialize the Chrome driver
        self.driver = webdriver.Chrome(options=chrome_options)
        self.wait = WebDriverWait(self.driver, 10)
        
        # Setup MongoDB connection
        try:
            self.client = pymongo.MongoClient(mongo_uri)
            self.db = self.client[db_name]
            self.connections_collection = self.db['connections']
            
            # Create index on profile_url for faster lookups and to ensure uniqueness
            self.connections_collection.create_index([("profile_url", pymongo.ASCENDING)], unique=True)
            
            print(f"Connected to MongoDB: {db_name}")
        except Exception as e:
            print(f"Error connecting to MongoDB: {str(e)}")
            raise
    
    def login(self):
        """Login to LinkedIn with provided credentials"""
        print("Logging in to LinkedIn...")
        self.driver.get('https://www.linkedin.com/login')
        
        try:
            # Enter email
            email_field = self.wait.until(EC.presence_of_element_located((By.ID, 'username')))
            email_field.send_keys(self.email)
            
            # Enter password
            password_field = self.driver.find_element(By.ID, 'password')
            password_field.send_keys(self.password)
            
            # Click login button
            login_button = self.driver.find_element(By.XPATH, "//button[@type='submit']")
            login_button.click()
            
            # Wait for login to complete
            self.wait.until(EC.presence_of_element_located((By.ID, 'global-nav')))
            print("Successfully logged in!")
            return True
            
        except TimeoutException:
            print("Login failed. Check your credentials or if there's a CAPTCHA challenge.")
            return False
        except Exception as e:
            print(f"Login error: {str(e)}")
            return False
    
    def get_connections(self, max_connections=None):
        """Navigate to connections page and scrape data"""
        print("Navigating to connections page...")
        self.driver.get('https://www.linkedin.com/mynetwork/invite-connect/connections/')
        
        # Wait for the connections list to load
        try:
            self.wait.until(EC.presence_of_element_located((By.CLASS_NAME, 'mn-connection-card')))
        except TimeoutException:
            print("Could not load connections page.")
            return False
        
        print("Scrolling to load all connections...")
        # Scroll down to load more connections
        connections_scraped = 0
        last_height = self.driver.execute_script("return document.body.scrollHeight")
        
        while True:
            # Scroll down
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            
            # Wait for page to load
            time.sleep(2)
            
            # Calculate new scroll height and compare with last scroll height
            new_height = self.driver.execute_script("return document.body.scrollHeight")
            
            # Check if we've reached the end or hit max_connections
            if new_height == last_height:
                break
            if max_connections and connections_scraped >= max_connections:
                break
                
            last_height = new_height
            
            # Count visible connections
            connections = self.driver.find_elements(By.CLASS_NAME, 'mn-connection-card')
            connections_scraped = len(connections)
            print(f"Loaded {connections_scraped} connections so far...")
            
            if max_connections and connections_scraped >= max_connections:
                break
        
        print(f"Loaded {connections_scraped} connections. Now extracting data...")
        return self.extract_connection_data(max_connections)
    
    def extract_connection_data(self, max_connections=None):
        """Extract data from each connection card"""
        connections = self.driver.find_elements(By.CLASS_NAME, 'mn-connection-card')
        
        if max_connections:
            connections = connections[:max_connections]
        
        total = len(connections)
        print(f"Found {total} connections. Extracting data...")
        
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
                    'scraped_date': datetime.now()
                }
                
                # Save to MongoDB
                self.save_connection(connection_data)
                
                results.append(connection_data)
                
                if (idx + 1) % 10 == 0:
                    print(f"Processed {idx + 1}/{total} connections...")
                
            except Exception as e:
                print(f"Error extracting data for connection {idx + 1}: {str(e)}")
        
        return results
    
    def get_detailed_profile_data(self, urls):
        """Visit each profile and get more detailed information"""
        print(f"Getting detailed information for {len(urls)} profiles...")
        results = []
        
        for idx, url in enumerate(urls):
            try:
                print(f"Visiting profile {idx + 1}/{len(urls)}: {url}")
                self.driver.get(url)
                time.sleep(2)  # Allow page to load
                
                # Extract data here (customize based on what you need)
                try:
                    location = self.driver.find_element(By.XPATH, "//span[contains(@class, 'text-body-small') and contains(@class, 'inline')]").text
                except:
                    location = ""
                
                # Get current company and position
                try:
                    experience_section = self.driver.find_element(By.ID, "experience-section")
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
                print(f"Error processing profile {url}: {str(e)}")
        
        return results
    
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
            print(f"Error saving connection to MongoDB: {str(e)}")
    
    def export_to_json(self, filename='linkedin_connections.json'):
        """Export all connections from MongoDB to a JSON file"""
        connections = list(self.connections_collection.find({}, {"_id": 0}))
        
        # Convert datetime objects to strings for JSON serialization
        for conn in connections:
            if 'scraped_date' in conn and isinstance(conn['scraped_date'], datetime):
                conn['scraped_date'] = conn['scraped_date'].isoformat()
            if 'last_updated' in conn and isinstance(conn['last_updated'], datetime):
                conn['last_updated'] = conn['last_updated'].isoformat()
        
        # Write to file
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(connections, f, ensure_ascii=False, indent=4)
        
        print(f"Exported {len(connections)} connections to {filename}")
    
    def close(self):
        """Close the browser and database connection"""
        self.driver.quit()
        if hasattr(self, 'client'):
            self.client.close()
            print("Closed MongoDB connection.")

if __name__ == "__main__":
    # Your LinkedIn credentials
    email = "Your Email"  # Replace with your LinkedIn email
    password = "Your Password"        # Replace with your LinkedIn password
    
    # MongoDB connection details
    mongo_uri = "mongodb+srv://aadithyanmerin:AdithyanMerin@cluster0.syz6u.mongodb.net/"  # Update with your MongoDB connection URI
    db_name = "linkedin_db"                  # Update with your preferred database name
    
    # Initialize the scraper with credentials and MongoDB connection
    scraper = LinkedInScraper(
        email=email,
        password=password,
        headless=False,  # Set to True if you don't want to see the browser
        mongo_uri=mongo_uri,
        db_name=db_name
    )
    
    # Login and scrape
    if scraper.login():
        try:
            # Get connections data
            connections = scraper.get_connections(max_connections=None)  # Set to None to get all connections
            
            if connections:
                print(f"Successfully scraped {len(connections)} connections")
                
                # Optional: Get detailed data for the first few connections
                # Uncomment these lines if you want detailed profile data
                # profile_urls = [conn['profile_url'] for conn in connections[:10]]
                # detailed_data = scraper.get_detailed_profile_data(profile_urls)
                
                # Export all data to JSON (optional)
                scraper.export_to_json()
                
                print(f"All connection data has been saved to MongoDB database: {db_name}")
            
        except Exception as e:
            print(f"Error occurred: {str(e)}")
        
        finally:
            # Clean up
            scraper.close()
    else:
        print("Unable to login. Exiting.")