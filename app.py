import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from html.parser import HTMLParser
import io
import logging
from flask import Flask, render_template, jsonify, request

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
DEFAULT_LINK = "https://cloud.google.com/bigquery/docs/release-notes"

class MLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.reset()
        self.strict = False
        self.convert_charrefs = True
        self.text = io.StringIO()
        
    def handle_data(self, d):
        self.text.write(d)
        
    def get_data(self):
        return self.text.getvalue()

def strip_tags(html):
    """Strip HTML tags to get clean plain text."""
    try:
        s = MLStripper()
        s.feed(html)
        return s.get_data()
    except Exception as e:
        logger.error(f"Error stripping HTML tags: {e}")
        # Fallback simple regex stripper if HTMLParser fails
        return re.sub(r'<[^>]*>', '', html)

def clean_plain_text(text):
    """Clean extra spaces and format the text for tweets."""
    if not text:
        return ""
    # Replace multiple spaces/newlines with a single space
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def parse_updates_from_html(html_content):
    """
    Splits the HTML content of a feed entry by its <h3> tags.
    Returns a list of updates, each with a type and its HTML & plain text content.
    """
    if not html_content:
        return []
        
    # Split using case-insensitive <h3> tags
    parts = re.split(r'<h3>(.*?)</h3>', html_content, flags=re.IGNORECASE)
    
    updates = []
    
    # If there are no <h3> tags, the split returns a list of length 1 (the original text)
    if len(parts) <= 1:
        content = html_content.strip()
        plain = clean_plain_text(strip_tags(content))
        updates.append({
            'type': 'General',
            'content': content,
            'plain_text': plain
        })
    else:
        # If there is text before the first <h3>, capture it as General
        first_part = parts[0].strip()
        if first_part:
            plain = clean_plain_text(strip_tags(first_part))
            updates.append({
                'type': 'General',
                'content': first_part,
                'plain_text': plain
            })
            
        # The list alternates between the header text (type) and the sibling content:
        # parts[1] = type, parts[2] = content, parts[3] = type, parts[4] = content...
        for i in range(1, len(parts), 2):
            if i + 1 < len(parts):
                update_type = parts[i].strip()
                update_content = parts[i+1].strip()
                plain = clean_plain_text(strip_tags(update_content))
                
                # Normalize types to title case for badges
                normalized_type = update_type.title()
                
                updates.append({
                    'type': normalized_type,
                    'content': update_content,
                    'plain_text': plain
                })
                
    return updates

def parse_feed_xml(xml_data):
    """Parses the Atom feed XML and extracts structured release updates."""
    root = ET.fromstring(xml_data)
    
    # Namespaces dictionary
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = root.findall('.//atom:entry', ns)
    if not entries:
        # Try finding elements without namespace prefix as a fallback
        entries = root.findall('.//entry')
        
    all_updates = []
    
    for entry_idx, entry in enumerate(entries):
        # Extract title (usually the date, e.g. "June 15, 2026")
        title_elem = entry.find('atom:title', ns)
        date_str = title_elem.text.strip() if title_elem is not None else "Unknown Date"
        
        # Extract ISO updated time
        updated_elem = entry.find('atom:updated', ns)
        iso_date = updated_elem.text.strip() if updated_elem is not None else ""
        
        # Format date for visual presentation if possible
        formatted_date = date_str
        try:
            # ISO timestamp: 2026-06-15T00:00:00-07:00 or similar
            # Let's extract date part
            if iso_date:
                dt_part = iso_date.split('T')[0]
                dt = datetime.strptime(dt_part, "%Y-%m-%d")
                formatted_date = dt.strftime("%B %d, %Y")
        except Exception:
            pass # Keep date_str as fallback
            
        # Extract Entry ID
        id_elem = entry.find('atom:id', ns)
        entry_id = id_elem.text.strip() if id_elem is not None else f"feed-entry-{entry_idx}"
        
        # Extract Feed Link
        link_elem = entry.find("atom:link[@rel='alternate']", ns)
        entry_link = DEFAULT_LINK
        if link_elem is not None and link_elem.get('href'):
            entry_link = link_elem.get('href')
            
        # Extract content (which contains HTML)
        content_elem = entry.find('atom:content', ns)
        if content_elem is None:
            content_elem = entry.find('atom:summary', ns)
            
        html_content = content_elem.text if content_elem is not None else ""
        
        # Parse the HTML content into multiple distinct updates
        parsed_items = parse_updates_from_html(html_content)
        
        for item_idx, item in enumerate(parsed_items):
            # Combine entry ID and item index to form a unique ID
            unique_id = f"{entry_id}-{item_idx}"
            
            all_updates.append({
                'id': unique_id,
                'entry_id': entry_id,
                'date': formatted_date,
                'raw_date_str': date_str,
                'iso_date': iso_date,
                'type': item['type'],
                'content': item['content'],
                'plain_text': item['plain_text'],
                'link': entry_link
            })
            
    return all_updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_release_notes():
    try:
        # Fetch xml feed with a standard User-Agent header to avoid blocking
        req = urllib.request.Request(
            FEED_URL,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AntigravityFeedReader/1.0'}
        )
        
        # Set timeout to 15 seconds
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
            
        updates = parse_feed_xml(xml_data)
        
        return jsonify({
            'status': 'success',
            'last_fetched': datetime.utcnow().isoformat() + 'Z',
            'count': len(updates),
            'updates': updates
        })
        
    except Exception as e:
        logger.error(f"Error fetching/parsing feed: {e}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    # Run on default port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
