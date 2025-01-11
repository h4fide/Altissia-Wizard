let panelWindow = null;
const TARGET_URL = 'https://app.ofppt-langues.ma/gw/eventapi/main/api/event/internal/events';
const ACTIVITY_URL_PATTERN = /https:\/\/app\.ofppt-langues\.ma\/platform\/learning-path\/mission\/.*\/activity\/(.*?)\?/;
const LESSON_URL_PATTERN = /https:\/\/app\.ofppt-langues\.ma\/gw\/lcapi\/main\/api\/lc\/lessons\/(.*?)$/;

chrome.devtools.panels.create(
    "Altissia Wizard Monitor",
    "icons/icon.png",
    "devtools.html",
    function(panel) {
        if (!panel) return;

        panel.onShown.addListener(function(extPanelWindow) {
            if (!extPanelWindow) return;
            // Store reference to panel window
            panelWindow = extPanelWindow;
            
            // Initialize panel elements
            const clearBtn = panelWindow.document.getElementById('clearBtn');
            if (clearBtn) {
                clearBtn.addEventListener('click', function() {
                    const container = panelWindow.document.getElementById('requests-container');
                    const status = panelWindow.document.getElementById('status-message');
                    if (container) container.innerHTML = '';
                    if (status) {
                        status.textContent = 'Waiting for events...';
                        status.style.color = '#666';
                    }
                });
            }

            const showOverlayBtn = panelWindow.document.getElementById('showOverlayBtn');
            if (showOverlayBtn) {
                showOverlayBtn.addEventListener('click', () => {
                    // Re-inject last captured answers if available
                    if (window.lastCapturedAnswers) {
                        injectOverlay(window.lastCapturedAnswers);
                    }
                });
            }
        });

        // Use correct event listener method
        panel.onHidden.addListener(() => {
            panelWindow = null;
        });
    }
);

function createDataDisplay(window, data) {
    const container = window.document.createElement('div');
    container.className = 'data-container';
    
    const dataText = window.document.createElement('pre');
    dataText.className = 'response-data';
    dataText.textContent = JSON.stringify(data, null, 2);
    
    container.appendChild(dataText);
    return container;
}

function createCopyButton(window, data) {
    const btn = window.document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy Data';
    btn.onclick = () => {
        const textArea = window.document.createElement('textarea');
        textArea.value = JSON.stringify(data, null, 2);
        textArea.style.position = 'fixed';  // Prevent scrolling to bottom
        window.document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = window.document.execCommand('copy');
            if (successful) {
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy Data', 2000);
            } else {
                throw new Error('Copy command unsuccessful');
            }
        } catch (err) {
            console.error('Copy failed:', err);
            btn.textContent = 'Copy Failed';
        }
        window.document.body.removeChild(textArea);
    };
    return btn;
}

// Add this function to store answers in chrome storage
function storeAnswers(answers) {
    chrome.storage.local.set({ 'lastAnswers': answers }, function() {
        console.log('Answers saved to storage');
    });
}

// Modify injectOverlay function
function injectOverlay(answers) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        // Store answers before injecting
        storeAnswers(answers);
        
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: createOverlay,
            args: [answers]
        });
    });
}

// Add content script injection to auto-show overlay on page load
chrome.runtime.onInstalled.addListener(() => {
    chrome.scripting.registerContentScripts([{
        id: 'answers-overlay',
        matches: ['https://app.ofppt-langues.ma/*'],
        js: ['contentScript.js'],
        runAt: 'document_end'
    }]);
});

function injectOverlay(answers) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: createOverlay,
            args: [answers]
        });
    });
}

function createOverlay(answers) {
    // Remove existing overlay if any
    let existing = document.getElementById('answers-overlay');
    if (existing) existing.remove();

    // Create overlay
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

    // Add title
    const title = document.createElement('h3');
    title.textContent = answers.title;
    title.style.margin = '0 0 10px 0';
    overlay.appendChild(title);

    // Add answers
    const answersList = document.createElement('ul');
    answersList.style.cssText = `
        list-style: none;
        padding: 0;
        margin: 0;
    `;

    answers.answers.forEach(answer => {
        const li = document.createElement('li');
        li.style.marginBottom = '10px';
        li.innerHTML = `
            <strong>Q${answer.index + 1}:</strong> ${answer.question}<br>
            <span style="color: ${answer.isMultiAnswer ? '#FFA500' : '#4CAF50'}">
                ${answer.correctAnswer}
                ${answer.isMultiAnswer ? '<br><small>(Multiple answers)</small>' : ''}
            </span>
        `;
        answersList.appendChild(li);
    });

    overlay.appendChild(answersList);
    document.body.appendChild(overlay);

    // Make draggable
    overlay.style.cursor = 'move';
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    overlay.addEventListener('mousedown', e => {
        isDragging = true;
        initialX = e.clientX - overlay.offsetLeft;
        initialY = e.clientY - overlay.offsetTop;
    });

    document.addEventListener('mousemove', e => {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        overlay.style.left = `${currentX}px`;
        overlay.style.top = `${currentY}px`;
        overlay.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

chrome.devtools.network.onRequestFinished.addListener((request) => {
    if (!panelWindow) return;
    
    const lessonMatch = request.request.url.match(LESSON_URL_PATTERN);
    
    // Only handle lesson GET requests
    if (request.request.method === 'GET' && lessonMatch) {
        const container = panelWindow.document.getElementById('requests-container');
        const status = panelWindow.document.getElementById('status-message');
        
        if (status) {
            status.textContent = 'Lesson data captured!';
            status.style.color = '#4CAF50';
        }
        
        request.getContent((content, encoding) => {
            try {
                const responseData = JSON.parse(content);
                
                // Extract correct answers from content items with multiple answer support
                const answers = responseData.content?.items?.map((item, index) => {
                    // Handle multiple sets of correct answers or multiple correct answers in one set
                    const allCorrectAnswers = item.correctAnswers.length > 1 
                        ? item.correctAnswers.map(set => set[0]) // Multiple sets, take first answer from each
                        : item.correctAnswers[0]; // Single set, take all answers

                    return {
                        question: item.question,
                        correctAnswer: Array.isArray(allCorrectAnswers) 
                            ? allCorrectAnswers.join(' OR ') 
                            : allCorrectAnswers,
                        index: index,
                        isMultiAnswer: item.correctAnswers.length > 1 || item.correctAnswers[0].length > 1
                    };
                }) || [];

                const lessonData = {
                    title: responseData.title,
                    answers: answers
                };
                
                // Store the answers globally
                window.lastCapturedAnswers = lessonData;
                
                // Inject overlay with answers
                injectOverlay(lessonData);
                
                // Create UI elements for lesson data
                const copyBtn = createCopyButton(panelWindow, lessonData);
                
                const headerDiv = panelWindow.document.createElement('div');
                headerDiv.className = 'request-header';
                const methodDiv = panelWindow.document.createElement('span');
                methodDiv.className = 'request-method';
                methodDiv.textContent = 'GET';
                methodDiv.style.backgroundColor = '#9C27B0';
                
                const lessonLabel = panelWindow.document.createElement('span');
                lessonLabel.className = 'lesson-label';
                lessonLabel.textContent = `Lesson: ${responseData.title}`;
                lessonLabel.style.marginLeft = '10px';
                
                headerDiv.appendChild(methodDiv);
                headerDiv.appendChild(lessonLabel);
                headerDiv.appendChild(copyBtn);
                
                const dataDiv = panelWindow.document.createElement('div');
                dataDiv.className = 'response-data';
                // Format the answers in a more readable way
                const formattedData = {
                    title: lessonData.title,
                    answers: lessonData.answers.map(a => `Q${a.index + 1}: ${a.question} => ${a.correctAnswer}`).join('\n')
                };
                dataDiv.textContent = JSON.stringify(formattedData, null, 2);
                
                const requestDiv = panelWindow.document.createElement('div');
                requestDiv.className = 'request-item lesson';
                requestDiv.appendChild(headerDiv);
                requestDiv.appendChild(dataDiv);
                
                if (container) {
                    container.insertBefore(requestDiv, container.firstChild);
                }
            } catch (error) {
                console.error('Error processing lesson response:', error);
            }
        });
        return;
    }
});
