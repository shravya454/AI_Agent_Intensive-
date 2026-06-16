# BigQuery Release Explorer

A premium web application built using **Python Flask** and **plain vanilla HTML, CSS, and JavaScript** that fetches, parses, and displays Google BigQuery release notes. It allows users to filter updates by category, search through them in real-time, and compose and customize tweets to share specific updates directly on X (formerly Twitter).

---

## 🌟 Key Features

1. **Live XML Feed Fetching**: Integrates directly with Google Cloud's BigQuery feeds (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`) to retrieve the latest release notes.
2. **Atom Feed Splitter (Granular Parser)**: Google's feed bundles all updates for a single day into one feed entry. Our backend parses this HTML content and splits it by `<h3>` tags (e.g., `Feature`, `Issue`, `Change`, `Deprecation`, `Bug Fix`) so that users can select and share a **specific** change rather than the entire day's log.
3. **Premium UI/UX Theme**: 
   - **Deep Dark Theme**: Implements sleek dark-mode aesthetics with custom glassmorphism layers, glow shadows, and responsive layouts.
   - **Color-Coded Badges**: Color-coded gradients distinguish features, bug fixes, changes, issues, deprecations, and general updates.
   - **Smooth Animations**: Hover states, micro-transitions, and loading indicators are designed for fluid interactions.
4. **Real-time Filters**: Instant search by keywords and filter badges with dynamic count indicators in the sidebar.
5. **Interactive Twitter/X Composer Modal**:
   - Opens when the user clicks **Draft Tweet** on any specific update card.
   - Pre-composes a high-quality tweet draft fitting within Twitter's 280-character limit (automatically truncating the description and appending the official link and hashtags `#GoogleCloud #BigQuery`).
   - Features a **live post preview** styled exactly like a real Twitter/X card (complete with avatars, verified badges, action counters, and styling).
   - Features a **character counter** with a circular SVG progress indicator that turns red when the text length exceeds the limit.
   - Integrates with Twitter's official Web Intent API to submit the post.
6. **One-click Copy-to-Clipboard**: Copies the plain text of any release note with visual checkmark toast notifications.

---

## 📂 File Structure

```
agy-cli-projects/
├── app.py                  # Flask server and XML feed parsing logic
├── requirements.txt        # Python dependencies (Flask & requests)
├── README.md               # Project documentation
├── templates/
│   └── index.html          # Main application page layout and Twitter modal
└── static/
    ├── css/
    │   └── styles.css      # Premium dark-theme variables, cards, modal, and animations
    └── js/
        └── main.js         # State management, filtering, composer, and API integration
```

---

## 🛠️ Installation & Setup

### 1. Prerequisites
Ensure you have Python 3.10+ installed on your system.

### 2. Clone the Repository (Optional)
If you are running this from a fresh environment, clone the repository first:
```bash
git clone https://github.com/shravya454/AI_Agent_Intensive-.git
cd AI_Agent_Intensive-
```

### 3. Install Dependencies
Install the required dependencies using pip:
```bash
pip install -r requirements.txt
```

### 4. Start the Application
Launch the Flask development server:
```bash
python app.py
```
By default, the server will start on [http://localhost:5000](http://localhost:5000).

---

## 💻 Technical Details

### Backend XML & HTML Parsing
Google Cloud release notes are delivered via an Atom XML feed. Each entry is a group of updates on a specific date. We retrieve the XML using Python's `urllib.request` and parse it using `xml.etree.ElementTree`. 
To parse individual updates, we use regular expressions to split the content by `<h3>` headers:
```python
parts = re.split(r'<h3>(.*?)</h3>', html_content, flags=re.IGNORECASE)
```
We then clean the HTML tags out of each update using a custom `html.parser.HTMLParser` wrapper to make it suitable for plain-text tweets.

### Interactive Live Composer
As you edit your draft in the modal, the JavaScript client-side logic updates the live preview dynamically. Links, hashtags (`#`), and mentions (`@`) are highlighted in blue. The character progress circle calculates the offset dynamically:
```javascript
const percentage = Math.min((charCount / 280) * 100, 100);
const offset = CIRCLE_CIRCUMFERENCE - (percentage / 100) * CIRCLE_CIRCUMFERENCE;
progressCircle.style.strokeDashoffset = offset;
```
When characters exceed 280, the stroke color turns red and a warning banner appears.
