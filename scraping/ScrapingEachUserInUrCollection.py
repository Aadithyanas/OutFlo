from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, StaleElementReferenceException
import time
import json
import os
from datetime import datetime
import pymongo
import random

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
    
    def get_connections(self, max_connections=10):  # Default to 10 connections
        """Navigate to connections page and scrape data"""
        print(f"Navigating to connections page to extract {max_connections} connections...")
        self.driver.get('https://www.linkedin.com/mynetwork/invite-connect/connections/')
        
        # Wait for the connections list to load
        try:
            self.wait.until(EC.presence_of_element_located((By.CLASS_NAME, 'mn-connection-card')))
        except TimeoutException:
            print("Could not load connections page.")
            return False
        
        print("Scrolling to load connections...")
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
            
            # Count visible connections
            connections = self.driver.find_elements(By.CLASS_NAME, 'mn-connection-card')
            connections_scraped = len(connections)
            print(f"Loaded {connections_scraped} connections so far...")
            
            # Check if we've reached the end or hit max_connections
            if new_height == last_height or connections_scraped >= max_connections:
                break
                
            last_height = new_height
        
        print(f"Loaded {connections_scraped} connections. Now extracting data...")
        return self.extract_connection_data(max_connections)
    
    def extract_connection_data(self, max_connections=10):  # Default to 10 connections
        """Extract data from each connection card"""
        connections = self.driver.find_elements(By.CLASS_NAME, 'mn-connection-card')
        
        if max_connections:
            connections = connections[:max_connections]
        
        total = len(connections)
        print(f"Found {total} connections. Extracting data for first {max_connections}...")
        
        results = []
        profile_urls = []
        
        for idx, connection in enumerate(connections):
            if idx >= max_connections:  # Ensure we only process max_connections
                break
                
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
                
                # Build basic connection data
                connection_data = {
                    'profile_url': profile_url,
                    'full_name': name,
                    'descrp': headline,
                    'scraped_date': datetime.now()
                }
                
                # Save to MongoDB (basic info first)
                self.save_connection(connection_data)
                
                results.append(connection_data)
                profile_urls.append(profile_url)
                
                print(f"Processed basic info for connection {idx + 1}/{max_connections}...")
                
            except Exception as e:
                print(f"Error extracting data for connection {idx + 1}: {str(e)}")
        
        print("Finished extracting basic connection data.")
        print("Now proceeding to get detailed profile information...")
        
        # Now process each profile in detail
        self.get_detailed_profile_data(profile_urls)
        
        return results
    
    def get_detailed_profile_data(self, urls):
        """Visit each profile and get detailed information"""
        print(f"Getting detailed information for {len(urls)} profiles...")
        
        for idx, url in enumerate(urls):
            try:
                print(f"Visiting profile {idx + 1}/{len(urls)}: {url}")
                self.driver.get(url)
                
                # Wait for profile to load
                time.sleep(random.uniform(3, 5))  # Random delay to avoid detection
                
                # Initialize profile data dictionary
                profile_data = {
                    'last_updated': datetime.now()
                }
                
                # Extract basic profile information
                try:
                    # Name (as a double-check)
                    try:
                        name_element = self.driver.find_element(By.XPATH, "//h1[contains(@class, 'text-heading-xlarge')]")
                        profile_data['full_name'] = name_element.text
                    except:
                        pass
                    
                    # Headline
                    try:
                        headline_element = self.driver.find_element(By.XPATH, "//div[contains(@class, 'text-body-medium')]")
                        profile_data['headline'] = headline_element.text
                    except:
                        pass
                    
                    # Location
                    try:
                        location_element = self.driver.find_element(By.XPATH, "//span[contains(@class, 'text-body-small') and contains(@class, 'inline')]")
                        profile_data['location'] = location_element.text
                    except:
                        profile_data['location'] = ""
                    
                    # About/Summary - FIXED ABOUT EXTRACTION
                    try:
                        # First attempt: Try to find the about section directly
                        about_section = self.driver.find_element(By.XPATH, "//section[@data-section='summary' or contains(@class, 'summary')]")
                        
                        # Click "See more" in the about section if it exists
                        try:
                            see_more = about_section.find_element(By.XPATH, ".//button[contains(text(), 'see more') or contains(@aria-label, 'expand')]")
                            see_more.click()
                            time.sleep(1)
                        except:
                            pass
                        
                        # Multiple approaches to extract the text
                        try:
                            about_element = about_section.find_element(By.XPATH, ".//div[contains(@class, 'display-flex')]/span")
                            profile_data['about'] = about_element.text
                        except:
                            try:
                                about_element = about_section.find_element(By.XPATH, ".//div[contains(@class, 'inline-show-more-text')]")
                                profile_data['about'] = about_element.text
                            except:
                                try:
                                    # Get all paragraphs in the about section
                                    about_paragraphs = about_section.find_elements(By.XPATH, ".//span[contains(@class, 'visually-hidden')]")
                                    profile_data['about'] = "\n".join([p.text for p in about_paragraphs if p.text.strip()])
                                except:
                                    # Last attempt - try to get any text in the about section
                                    profile_data['about'] = about_section.text.replace("About", "").strip()
                    except:
                        # Alternative approach - look for about section by heading
                        try:
                            about_section = self.driver.find_element(By.XPATH, "//section[.//div[contains(@id, 'about') or .//span[text()='About']]]")
                            
                            # Try to click "See more" if available
                            try:
                                see_more = about_section.find_element(By.XPATH, ".//button[contains(text(), 'show more') or contains(text(), 'see more')]")
                                see_more.click()
                                time.sleep(1)
                            except:
                                pass
                            
                            # Extract the text content, excluding the "About" heading
                            about_text = about_section.text
                            if about_text.startswith("About"):
                                about_text = about_text[5:].strip()
                            profile_data['about'] = about_text
                        except:
                            profile_data['about'] = ""
                        
                except Exception as e:
                    print(f"Error extracting about section: {str(e)}")
                    profile_data['about'] = ""
                
                # Extract contact information - FIXED CONTACT INFO EXTRACTION
                try:
                    # Click on "Contact info" button - try multiple possible selectors
                    contact_button = None
                    try:
                        # First attempt - look for contact info link with explicit text
                        contact_button = self.driver.find_element(By.XPATH, "//a[contains(text(), 'Contact info')]")
                    except:
                        try:
                            # Second attempt - look for contact info icon/button
                            contact_button = self.driver.find_element(By.XPATH, "//a[contains(@href, 'overlay/contact-info/') or contains(@href, 'overlay/contact_info/')]")
                        except:
                            try:
                                # Third attempt - look for contact info in a dropdown menu
                                # First click on the "More" button if it exists
                                more_button = self.driver.find_element(By.XPATH, "//button[contains(@aria-label, 'More actions')]")
                                more_button.click()
                                time.sleep(1)
                                
                                # Then look for Contact info option
                                contact_button = self.driver.find_element(By.XPATH, "//div[contains(@class, 'artdeco-dropdown')]//li[contains(text(), 'Contact info')]")
                            except:
                                print("Could not find contact info button")
                    
                    # Click the contact button if found
                    if contact_button:
                        contact_button.click()
                        time.sleep(2)  # Wait for modal to open
                        
                        contact_info = {}
                        
                        # Use a more robust approach to extract contact details
                        # First check if the contact info modal is open
                        try:
                            contact_modal = self.driver.find_element(By.XPATH, "//div[contains(@class, 'artdeco-modal') or contains(@role, 'dialog')]")
                            
                            # Extract profile URL
                            try:
                                profile_url_elem = contact_modal.find_element(By.XPATH, ".//section[contains(@class, 'ci-vanity-url') or .//h3[contains(text(), 'Profile')]]//a")
                                contact_info['profile_url'] = profile_url_elem.get_attribute('href')
                            except:
                                contact_info['profile_url'] = url
                            
                            # Extract email
                            try:
                                email_section = contact_modal.find_element(By.XPATH, ".//section[contains(@class, 'ci-email') or .//h3[contains(text(), 'Email')]]")
                                email_elem = email_section.find_element(By.XPATH, ".//a")
                                contact_info['email'] = email_elem.text
                            except:
                                try:
                                    # Alternative approach
                                    email_elem = contact_modal.find_element(By.XPATH, ".//*[contains(text(), '@') and contains(text(), '.')]")
                                    contact_info['email'] = email_elem.text
                                except:
                                    contact_info['email'] = ""
                            
                            # Extract phone number
                            try:
                                phone_section = contact_modal.find_element(By.XPATH, ".//section[contains(@class, 'ci-phone') or .//h3[contains(text(), 'Phone')]]")
                                phone_elem = phone_section.find_element(By.XPATH, ".//span")
                                contact_info['phone'] = phone_elem.text
                            except:
                                try:
                                    # Alternative approach - look for phone number pattern
                                    phone_text = contact_modal.text
                                    import re
                                    phone_match = re.search(r'\+?[\d\s\(\)-]{7,}', phone_text)
                                    if phone_match:
                                        contact_info['phone'] = phone_match.group(0)
                                    else:
                                        contact_info['phone'] = ""
                                except:
                                    contact_info['phone'] = ""
                            
                            # Extract website
                            try:
                                website_section = contact_modal.find_element(By.XPATH, ".//section[contains(@class, 'ci-websites') or .//h3[contains(text(), 'Website')]]")
                                website_elems = website_section.find_elements(By.XPATH, ".//a")
                                contact_info['websites'] = [elem.get_attribute('href') for elem in website_elems]
                            except:
                                contact_info['websites'] = []
                            
                            # Extract social links
                            try:
                                social_section = contact_modal.find_element(By.XPATH, ".//section[contains(@class, 'ci-connected-accounts') or .//h3[contains(text(), 'Social') or contains(text(), 'Accounts')]]")
                                social_elems = social_section.find_elements(By.XPATH, ".//a")
                                contact_info['social_links'] = [{'name': elem.text, 'url': elem.get_attribute('href')} for elem in social_elems]
                            except:
                                contact_info['social_links'] = []
                            
                            # Close contact info modal
                            try:
                                close_button = contact_modal.find_element(By.XPATH, ".//button[contains(@aria-label, 'Dismiss') or contains(@aria-label, 'Close')]")
                                close_button.click()
                                time.sleep(1)
                            except:
                                try:
                                    # Try different close button if modal didn't close
                                    close_button = self.driver.find_element(By.XPATH, "//button[contains(@class, 'artdeco-modal__dismiss')]")
                                    close_button.click()
                                    time.sleep(1)
                                except:
                                    # Try escape key if buttons don't work
                                    from selenium.webdriver.common.keys import Keys
                                    webdriver.ActionChains(self.driver).send_keys(Keys.ESCAPE).perform()
                                    time.sleep(1)
                        except Exception as e:
                            print(f"Error processing contact modal: {str(e)}")
                            
                    profile_data['contact_info'] = contact_info
                    
                except Exception as e:
                    print(f"Error extracting contact info: {str(e)}")
                    profile_data['contact_info'] = {}
                
                # Extract Experience
                try:
                    experiences = []
                    # Try to expand the experience section if it's collapsed
                    try:
                        experience_section = self.driver.find_element(By.XPATH, "//section[.//div[contains(@class, 'pvs-header__container')]//*[contains(text(), 'Experience')]]")
                        see_more = experience_section.find_element(By.XPATH, ".//button[contains(text(), 'Show all')]")
                        see_more.click()
                        time.sleep(2)
                        self.wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'scaffold-finite-scroll')]")))
                    except:
                        pass
                    
                    # Extract experience list
                    try:
                        exp_elements = self.driver.find_elements(By.XPATH, "//section[.//div[contains(@class, 'pvs-header__container')]//*[contains(text(), 'Experience')]]//li[contains(@class, 'pvs-list__item')]")
                        
                        for exp in exp_elements:
                            try:
                                # Company name
                                try:
                                    company_elem = exp.find_element(By.XPATH, ".//span[contains(@class, 'hoverable-link-text')]")
                                    company = company_elem.text
                                except:
                                    company = ""
                                
                                # Title
                                try:
                                    title_elem = exp.find_element(By.XPATH, ".//span[contains(@class, 't-bold')]")
                                    title = title_elem.text
                                except:
                                    title = ""
                                
                                # Date range
                                try:
                                    date_elem = exp.find_element(By.XPATH, ".//span[contains(@class, 't-normal') and contains(@class, 't-black--light')]")
                                    date_range = date_elem.text
                                except:
                                    date_range = ""
                                
                                # Description
                                try:
                                    desc_elem = exp.find_element(By.XPATH, ".//div[contains(@class, 'pvs-list__item--no-padding-when-nested')]/span")
                                    description = desc_elem.text
                                except:
                                    description = ""
                                
                                experiences.append({
                                    'title': title,
                                    'company': company,
                                    'date_range': date_range,
                                    'description': description
                                })
                            except Exception as e:
                                print(f"Error extracting individual experience: {str(e)}")
                        
                        # Close experience overlay if opened
                        try:
                            close_button = self.driver.find_element(By.XPATH, "//button[contains(@aria-label, 'Dismiss')]")
                            close_button.click()
                            time.sleep(1)
                        except:
                            pass
                            
                    except Exception as e:
                        print(f"Error parsing experience elements: {str(e)}")
                    
                    profile_data['experiences'] = experiences
                except Exception as e:
                    print(f"Error extracting experience section: {str(e)}")
                    profile_data['experiences'] = []
                
                # Extract Education
                try:
                    education = []
                    # Try to expand the education section if it's collapsed
                    try:
                        education_section = self.driver.find_element(By.XPATH, "//section[.//div[contains(@class, 'pvs-header__container')]//*[contains(text(), 'Education')]]")
                        see_more = education_section.find_element(By.XPATH, ".//button[contains(text(), 'Show all')]")
                        see_more.click()
                        time.sleep(2)
                    except:
                        pass
                    
                    # Extract education list
                    try:
                        edu_elements = self.driver.find_elements(By.XPATH, "//section[.//div[contains(@class, 'pvs-header__container')]//*[contains(text(), 'Education')]]//li[contains(@class, 'pvs-list__item')]")
                        
                        for edu in edu_elements:
                            try:
                                # School name
                                try:
                                    school_elem = edu.find_element(By.XPATH, ".//span[contains(@class, 'hoverable-link-text')]")
                                    school = school_elem.text
                                except:
                                    school = ""
                                
                                # Degree
                                try:
                                    degree_elem = edu.find_element(By.XPATH, ".//span[contains(@class, 't-bold')]")
                                    degree = degree_elem.text
                                except:
                                    degree = ""
                                
                                # Field of study and graduation year
                                try:
                                    field_date_elem = edu.find_element(By.XPATH, ".//span[contains(@class, 't-normal') and contains(@class, 't-black--light')]")
                                    field_date = field_date_elem.text
                                except:
                                    field_date = ""
                                
                                education.append({
                                    'school': school,
                                    'degree': degree,
                                    'field_and_date': field_date
                                })
                            except Exception as e:
                                print(f"Error extracting individual education: {str(e)}")
                        
                        # Close education overlay if opened
                        try:
                            close_button = self.driver.find_element(By.XPATH, "//button[contains(@aria-label, 'Dismiss')]")
                            close_button.click()
                            time.sleep(1)
                        except:
                            pass
                            
                    except Exception as e:
                        print(f"Error parsing education elements: {str(e)}")
                    
                    profile_data['education'] = education
                except Exception as e:
                    print(f"Error extracting education section: {str(e)}")
                    profile_data['education'] = []
                
                # Extract Skills
                try:
                    skills = []
                    # Try to expand the skills section if it's collapsed
                    try:
                        skills_section = self.driver.find_element(By.XPATH, "//section[.//div[contains(@class, 'pvs-header__container')]//*[contains(text(), 'Skills')]]")
                        see_more = skills_section.find_element(By.XPATH, ".//button[contains(text(), 'Show all')]")
                        see_more.click()
                        time.sleep(2)
                    except:
                        pass
                    
                    # Extract skills list
                    try:
                        skill_elements = self.driver.find_elements(By.XPATH, "//section[.//div[contains(@class, 'pvs-header__container')]//*[contains(text(), 'Skills')]]//li[contains(@class, 'pvs-list__item')]")
                        
                        for skill in skill_elements:
                            try:
                                skill_name_elem = skill.find_element(By.XPATH, ".//span[contains(@class, 'hoverable-link-text')]")
                                skill_name = skill_name_elem.text
                                skills.append(skill_name)
                            except:
                                continue
                        
                        # Close skills overlay if opened
                        try:
                            close_button = self.driver.find_element(By.XPATH, "//button[contains(@aria-label, 'Dismiss')]")
                            close_button.click()
                            time.sleep(1)
                        except:
                            pass
                    except Exception as e:
                        print(f"Error parsing skills elements: {str(e)}")
                    
                    profile_data['skills'] = skills
                except Exception as e:
                    print(f"Error extracting skills section: {str(e)}")
                    profile_data['skills'] = []
                
                # Update MongoDB with detailed profile data
                self.connections_collection.update_one(
                    {"profile_url": url},
                    {"$set": profile_data}
                )
                
                print(f"Successfully saved detailed data for profile {idx + 1}/{len(urls)}")
                
                # Random delay between profile visits to avoid rate limiting
                delay = random.uniform(5, 8)
                print(f"Waiting {delay:.1f} seconds before next profile...")
                time.sleep(delay)
                
            except Exception as e:
                print(f"Error processing profile {url}: {str(e)}")
                continue
        
        print("Finished extracting detailed profile information.")
    
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
    email = "Enter your Email"  # Replace with your LinkedIn email
    password = "Enter your Password"        # Replace with your LinkedIn password
    
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
            # Get exactly 10 connections data and detailed information
            connections = scraper.get_connections(max_connections=10)
            
            if connections:
                print(f"Successfully scraped {len(connections)} connections with detailed information")
                
                # Export all data to JSON
                scraper.export_to_json()
                
                print(f"All connection data has been saved to MongoDB database: {db_name}")
            
        except Exception as e:
            print(f"Error occurred: {str(e)}")
        
        finally:
            # Clean up
            scraper.close()
    else:
        print("Unable to login. Exiting.")