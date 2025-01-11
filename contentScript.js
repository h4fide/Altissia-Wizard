// Check for stored answers and show overlay on page load
chrome.storage.local.get(['lastAnswers'], function(result) {
    if (result.lastAnswers) {
        createOverlay(result.lastAnswers);
    }
});

// Listen for storage changes to update overlay
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.lastAnswers) {
        createOverlay(changes.lastAnswers.newValue);
    }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'lessonData') {
        createOverlay(message.data);
    }
});

function createOverlay(answers) {
    // Remove existing overlay
    let existing = document.getElementById('answers-overlay');
    if (existing) existing.remove();

    // Create new overlay
    const overlay = document.createElement('div');
    overlay.id = 'answers-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: #fff;
        padding: 15px;
        border-radius: 5px;
        z-index: 10000;
        max-width: 300px;
        max-height: 80vh;
        overflow-y: auto;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
    `;

    // ...existing overlay creation code...
}
