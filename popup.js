// Add this function at the top of the file
function checkUrlAndUpdateUI() {
    const button = document.getElementById('extractBtn');
    const errorContainer = document.getElementById('errorContainer');

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        
        if (!currentUrl.startsWith('https://app.ofppt-langues.ma/')) {
            errorContainer.classList.add('show');
            button.disabled = true;
            button.classList.add('disabled');
        } else {
            errorContainer.classList.remove('show');
            button.disabled = false;
            button.classList.remove('disabled');
        }
    });
}

// Modify the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // Check URL immediately when popup opens
    checkUrlAndUpdateUI();
    
    const feedbackIcon = document.querySelector('.feedback-icon');
    feedbackIcon.addEventListener('click', function() {
        window.open('https://t.me/hafide', '_blank');
    });
});

// Modify the extract button click handler
document.getElementById('extractBtn').addEventListener('click', function() {
    // Get UI elements
    const button = document.getElementById('extractBtn');
    const loader = document.getElementById('loader');
    const timeoutMessage = document.getElementById('timeoutMessage');
    const errorContainer = document.getElementById('errorContainer');
    
    // Reset UI state
    timeoutMessage.classList.remove('show');
    errorContainer.classList.remove('show');

    // Check URL again when button is clicked
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        
        if (!currentUrl.startsWith('https://app.ofppt-langues.ma/')) {
            errorContainer.classList.add('show');
            button.disabled = true;
            button.classList.add('disabled');
            return;
        }

        // Continue with existing monitoring logic
        button.textContent = 'Loading...';
        button.classList.add('loading');
        loader.classList.remove('warning');
        loader.classList.add('active');
        
        // Set timeout for 3 seconds
        const timeout = setTimeout(() => {
            timeoutMessage.style.display = 'block'; // Force display
            timeoutMessage.classList.add('show');
            loader.classList.add('warning');
        }, 3000);
        
        chrome.runtime.sendMessage({ action: 'startMonitoring' }, function(response) {
            if (chrome.runtime.lastError) {
                clearTimeout(timeout);
                button.textContent = 'Error';
                timeoutMessage.classList.remove('show');
                loader.classList.remove('active');
                return;
            }
            if (response && response.success) {
                button.textContent = 'Monitoring...';
                // Don't remove timeout message here - let it stay visible if already shown
            } else {
                clearTimeout(timeout);
                button.textContent = 'Failed';
                button.classList.remove('loading');
                loader.classList.remove('active');
                timeoutMessage.classList.remove('show');
            }
        });
    });
});
