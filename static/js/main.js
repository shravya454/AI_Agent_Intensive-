// State management
let state = {
    updates: [],
    filteredUpdates: [],
    currentFilter: 'all',
    searchQuery: '',
    lastSynced: null,
    selectedUpdate: null
};

// DOM Elements
const elements = {
    searchInput: document.getElementById('search-input'),
    categoryFilters: document.getElementById('category-filters'),
    refreshBtn: document.getElementById('refresh-btn'),
    refreshSpinner: document.getElementById('refresh-spinner'),
    syncTimeLabel: document.getElementById('sync-time-label'),
    
    // States
    feedLoading: document.getElementById('feed-loading'),
    feedError: document.getElementById('feed-error'),
    feedEmpty: document.getElementById('feed-empty'),
    notesFeed: document.getElementById('notes-feed'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    clearFiltersBtn: document.getElementById('clear-filters-btn'),
    
    // Modal
    tweetModal: document.getElementById('tweet-modal'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    tweetPreviewText: document.getElementById('tweet-preview-text'),
    charCount: document.getElementById('char-count'),
    charWarning: document.getElementById('char-warning'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    tweetIntentBtn: document.getElementById('tweet-intent-btn'),
    progressCircle: document.querySelector('.progress-ring__circle'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

// Circle progress constants
const CIRCLE_RADIUS = 11;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

// Initialize circular progress bar
if (elements.progressCircle) {
    elements.progressCircle.style.strokeDasharray = `${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`;
    elements.progressCircle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE;
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch
    fetchReleaseNotes();
    
    // Event listeners
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        filterAndRender();
    });
    
    // Category filters
    const filterItems = elements.categoryFilters.querySelectorAll('.filter-item');
    filterItems.forEach(item => {
        item.addEventListener('click', () => {
            // Update active state in UI
            filterItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Update state
            state.currentFilter = item.getAttribute('data-filter');
            filterAndRender();
        });
    });
    
    // Refresh buttons
    elements.refreshBtn.addEventListener('click', fetchReleaseNotes);
    elements.retryBtn.addEventListener('click', fetchReleaseNotes);
    
    // Clear filters
    elements.clearFiltersBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        
        // Reset category to 'all'
        filterItems.forEach(i => i.classList.remove('active'));
        elements.categoryFilters.querySelector('[data-filter="all"]').classList.add('active');
        state.currentFilter = 'all';
        
        filterAndRender();
    });
    
    // Modal controls
    elements.modalCloseBtn.addEventListener('click', closeTweetModal);
    elements.modalCancelBtn.addEventListener('click', closeTweetModal);
    
    // Outside click to close modal
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) {
            closeTweetModal();
        }
    });
    
    // Textarea input for live preview & char count
    elements.tweetTextarea.addEventListener('input', (e) => {
        updateTweetPreview(e.target.value);
    });
    
    // Twitter submit intent
    elements.tweetIntentBtn.addEventListener('click', () => {
        const text = elements.tweetTextarea.value;
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
        closeTweetModal();
        showToast("Redirected to X / Twitter!");
    });
}

// Fetch notes from Flask API
async function fetchReleaseNotes() {
    showLoading(true);
    
    try {
        const response = await fetch('/api/notes');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            state.updates = data.updates;
            state.lastSynced = new Date();
            updateSyncLabel();
            
            // Calculate and display sidebar badge counts
            updateSidebarCounts();
            
            // Render notes
            filterAndRender();
            showLoading(false);
        } else {
            throw new Error(data.message || "Unknown error occurred");
        }
    } catch (error) {
        console.error("Fetch error:", error);
        elements.errorMessage.textContent = error.message || "Failed to load release notes. Please verify your connection.";
        showError(true);
    }
}

// Update Sync Date label
function updateSyncLabel() {
    if (state.lastSynced) {
        const timeStr = state.lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        elements.syncTimeLabel.textContent = `Synced: ${timeStr}`;
    }
}

// Update sidebar badge counters based on full dataset
function updateSidebarCounts() {
    const counts = {
        all: state.updates.length,
        Feature: 0,
        Change: 0,
        Deprecation: 0,
        Issue: 0,
        'Bug Fix': 0,
        General: 0
    };
    
    state.updates.forEach(update => {
        const type = update.type;
        if (type in counts) {
            counts[type]++;
        } else {
            // Catch-all
            counts.General++;
        }
    });
    
    document.getElementById('count-all').textContent = counts.all;
    document.getElementById('count-feature').textContent = counts.Feature;
    document.getElementById('count-change').textContent = counts.Change;
    document.getElementById('count-deprecation').textContent = counts.Deprecation;
    document.getElementById('count-issue').textContent = counts.Issue;
    document.getElementById('count-bugfix').textContent = counts['Bug Fix'];
    document.getElementById('count-general').textContent = counts.General;
}

// Filter and render the cards
function filterAndRender() {
    // 1. Filter by category
    let filtered = state.updates;
    if (state.currentFilter !== 'all') {
        filtered = filtered.filter(item => item.type === state.currentFilter);
    }
    
    // 2. Filter by search query
    if (state.searchQuery) {
        filtered = filtered.filter(item => {
            const inType = item.type.toLowerCase().includes(state.searchQuery);
            const inDate = item.date.toLowerCase().includes(state.searchQuery);
            const inText = item.plain_text.toLowerCase().includes(state.searchQuery);
            return inType || inDate || inText;
        });
    }
    
    state.filteredUpdates = filtered;
    
    // Render the cards
    renderCards();
}

// Render release note cards to the DOM
function renderCards() {
    elements.notesFeed.innerHTML = '';
    
    if (state.filteredUpdates.length === 0) {
        showEmpty(true);
        return;
    }
    
    showEmpty(false);
    
    state.filteredUpdates.forEach(update => {
        const card = document.createElement('article');
        card.className = 'note-card';
        card.setAttribute('data-type', update.type);
        card.setAttribute('id', `card-${update.id}`);
        
        // Format the badge class name
        const badgeClass = update.type.toLowerCase().replace(' ', '-');
        
        card.innerHTML = `
            <div class="note-card-header">
                <div class="note-meta">
                    <span class="type-badge badge-${badgeClass}">${update.type}</span>
                    <span class="note-date">
                        <i data-lucide="calendar"></i>
                        ${update.date}
                    </span>
                </div>
                <a href="${update.link}" target="_blank" rel="noopener noreferrer" class="card-link-icon" title="View official release documentation">
                    <i data-lucide="external-link"></i>
                </a>
            </div>
            <div class="note-card-body">
                ${update.content}
            </div>
            <div class="note-card-footer">
                <button class="btn-card-action btn-copy" onclick="copyUpdateText('${update.id}')">
                    <i data-lucide="copy"></i>
                    <span>Copy Text</span>
                </button>
                <button class="btn-card-action btn-tweet" onclick="openTweetComposer('${update.id}')">
                    <i data-lucide="twitter"></i>
                    <span>Draft Tweet</span>
                </button>
            </div>
        `;
        
        elements.notesFeed.appendChild(card);
    });
    
    // Initialize Lucide icons on newly created elements
    lucide.createIcons();
}

// Global functions for card click handlers
window.copyUpdateText = function(id) {
    const update = state.updates.find(u => u.id === id);
    if (!update) return;
    
    navigator.clipboard.writeText(update.plain_text).then(() => {
        showToast("Copied release note to clipboard!");
    }).catch(err => {
        console.error("Clipboard error:", err);
        showToast("Failed to copy text", true);
    });
};

window.openTweetComposer = function(id) {
    const update = state.updates.find(u => u.id === id);
    if (!update) return;
    
    state.selectedUpdate = update;
    
    // Compose initial text
    const initialText = composeInitialTweet(update);
    
    // Populate composer and open modal
    elements.tweetTextarea.value = initialText;
    updateTweetPreview(initialText);
    
    // Open modal
    elements.tweetModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock main scrolling
};

// Compose pre-formatted high-quality tweet draft
function composeInitialTweet(update) {
    let prefix = "BigQuery release update:";
    if (update.type === "Feature") {
        prefix = "🚀 New BigQuery Feature:";
    } else if (update.type === "Bug Fix") {
        prefix = "🛠️ BigQuery Bug Fix:";
    } else if (update.type === "Deprecation") {
        prefix = "⚠️ BigQuery Deprecation:";
    } else if (update.type === "Issue") {
        prefix = "🛑 BigQuery Issue:";
    } else if (update.type === "Change") {
        prefix = "🔄 BigQuery Change:";
    }
    
    const desc = update.plain_text;
    const suffix = `\n\nDetails: ${update.link}\n#GoogleCloud #BigQuery`;
    
    // Standard limit is 280.
    // Calculate space for description.
    const reservedLen = prefix.length + suffix.length + 2; // +2 for extra spacing
    const maxDescLen = 280 - reservedLen;
    
    let cleanDesc = desc;
    if (desc.length > maxDescLen) {
        cleanDesc = desc.substring(0, maxDescLen - 3) + "...";
    }
    
    return `${prefix} ${cleanDesc}${suffix}`;
}

// Live update tweet preview, char counts, and SVG progress circle
function updateTweetPreview(text) {
    // 1. Text Preview: format links to look like blue highlights
    let previewHtml = text
        .replace(/(https?:\/\/[^\s]+)/g, '<span class="tweet-link">$1</span>')
        .replace(/(#[a-zA-Z0-9_]+)/g, '<span class="tweet-link">$1</span>')
        .replace(/(@[a-zA-Z0-9_]+)/g, '<span class="tweet-link">$1</span>');
    
    elements.tweetPreviewText.innerHTML = previewHtml || '<span style="color:#71767b">Post preview will appear here...</span>';
    
    // 2. Character counts
    const charCount = text.length;
    elements.charCount.textContent = charCount;
    
    const countRow = document.querySelector('.char-count-details');
    if (charCount > 280) {
        countRow.classList.add('exceeded');
        elements.charWarning.classList.remove('hidden');
        elements.tweetIntentBtn.classList.add('btn-warning');
    } else {
        countRow.classList.remove('exceeded');
        elements.charWarning.classList.add('hidden');
        elements.tweetIntentBtn.classList.remove('btn-warning');
    }
    
    // 3. Progress Ring Circle SVG offset
    if (elements.progressCircle) {
        const percentage = Math.min((charCount / 280) * 100, 100);
        const offset = CIRCLE_CIRCUMFERENCE - (percentage / 100) * CIRCLE_CIRCUMFERENCE;
        elements.progressCircle.style.strokeDashoffset = offset;
        
        // Progress ring color changes
        if (charCount > 280) {
            elements.progressCircle.style.stroke = '#ef4444'; // Red
        } else if (charCount > 240) {
            elements.progressCircle.style.stroke = '#f59e0b'; // Amber
        } else {
            elements.progressCircle.style.stroke = '#1da1f2'; // Twitter Blue
        }
    }
}

// Close Modal
function closeTweetModal() {
    elements.tweetModal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
    state.selectedUpdate = null;
}

// Show/Hide page states
function showLoading(isLoading) {
    if (isLoading) {
        elements.feedLoading.classList.remove('hidden');
        elements.notesFeed.classList.add('hidden');
        elements.feedError.classList.add('hidden');
        elements.feedEmpty.classList.add('hidden');
        elements.refreshSpinner.classList.add('active');
        elements.refreshBtn.disabled = true;
        
        const statusInd = document.querySelector('.status-indicator');
        if (statusInd) {
            statusInd.className = 'status-indicator syncing';
        }
    } else {
        elements.feedLoading.classList.add('hidden');
        elements.notesFeed.classList.remove('hidden');
        elements.refreshSpinner.classList.remove('active');
        elements.refreshBtn.disabled = false;
        
        const statusInd = document.querySelector('.status-indicator');
        if (statusInd) {
            statusInd.className = 'status-indicator';
        }
    }
}

function showError(isError) {
    if (isError) {
        elements.feedError.classList.remove('hidden');
        elements.feedLoading.classList.add('hidden');
        elements.notesFeed.classList.add('hidden');
        elements.feedEmpty.classList.add('hidden');
        elements.refreshSpinner.classList.remove('active');
        elements.refreshBtn.disabled = false;
        
        const statusInd = document.querySelector('.status-indicator');
        if (statusInd) {
            statusInd.className = 'status-indicator syncing'; // yellow/amber status
        }
    }
}

function showEmpty(isEmpty) {
    if (isEmpty) {
        elements.feedEmpty.classList.remove('hidden');
        elements.notesFeed.classList.add('hidden');
    } else {
        elements.feedEmpty.classList.add('hidden');
        elements.notesFeed.classList.remove('hidden');
    }
}

// Clipboard toast messages
let toastTimeout = null;
function showToast(message, isError = false) {
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    elements.toastMessage.textContent = message;
    
    const checkIcon = elements.toast.querySelector('.toast-check-icon');
    if (isError) {
        elements.toast.style.backgroundColor = '#ef4444';
        if (checkIcon) checkIcon.setAttribute('data-lucide', 'alert-circle');
    } else {
        elements.toast.style.backgroundColor = '#10b981';
        if (checkIcon) checkIcon.setAttribute('data-lucide', 'check');
    }
    
    lucide.createIcons();
    
    elements.toast.classList.remove('hidden');
    
    toastTimeout = setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 2800);
}
