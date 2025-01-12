// Error handling
window.onerror = function(msg, url, lineNo, columnNo, error) {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
        errorContainer.style.display = 'block';
        errorContainer.textContent = `Error: ${msg}`;
    }
    console.error('Error:', msg, 'at', lineNo, ':', columnNo);
    return false;
};

// Copy text function
function copyText(element) {
    const text = element.querySelector('.answer-text').textContent;
    navigator.clipboard.writeText(text)
        .then(() => {
            element.classList.add('copied');
            setTimeout(() => {
                element.classList.remove('copied');
            }, 1000);
        })
        .catch(err => {
            console.error('Failed to copy text:', err);
        });
}

let panelWindow = null;
const LESSON_URL_PATTERN = /https:\/\/app\.ofppt-langues\.ma\/gw\/lcapi\/main\/api\/lc\/lessons\/(.*?)$/;

// Create container and display functions
function createRequestContainer(panelWindow, title, answers) {
    const container = panelWindow.document.querySelector('.container');
    if (!container) return;

    const formatQuestion = (question) => {
        return question.replace(/\[GAP\]/g, '<span class="gap-dots"> .....</span>');
    };

    container.innerHTML = `
        <div class="header">
            <a href="#" class="back-button">Questions disponibles</a>
            <span class="progress">${answers.length} questions</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
        <h1 class="question-title">${title || 'Réponses correctes'}</h1>
        ${answers.map((answer, idx) => `
            <div class="question-box">
                <div class="question">
                    <b>Question ${idx + 1}:</b> ${formatQuestion(answer.question)}
                </div>
                <div class="options">
                    ${answer.correctAnswer.map((ans, ansIdx) => `
                        <div class="option ${answer.isMultipleCorrect ? 'primary-option' : (ansIdx === 0 ? 'primary-option' : 'alternative-option')}" onclick="copyText(this)">
                            ${(!answer.isMultipleCorrect && ansIdx > 0) ? '<span class="ou-label">OU</span>' : ''}
                            <span class="answer-text">${ans}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
    `;
}

// Update panel creation and request listener
chrome.devtools.panels.create(
    "Altissia Wizard",
    "icons/icon.png",
    "devtools.html",
    function(panel) {
        console.log('Panel created');
        
        panel.onShown.addListener(function(extPanelWindow) {
            console.log('Panel shown');
            panelWindow = extPanelWindow;
        });

        panel.onHidden.addListener(() => {
            console.log('Panel hidden');
            panelWindow = null;
        });

        // Move network listener inside panel creation callback
        chrome.devtools.network.onRequestFinished.addListener((request) => {
            console.log('Request intercepted:', request.request.url);
            
            if (!panelWindow) {
                console.log('Panel window not available');
                return;
            }
            
            const lessonMatch = request.request.url.match(LESSON_URL_PATTERN);
            
            if (request.request.method === 'GET' && lessonMatch) {
                console.log('Processing lesson request');
                request.getContent((content, encoding) => {
                    try {
                        const responseData = JSON.parse(content);
                        const answers = responseData.content?.items?.map((item, index) => {
                            let allCorrectAnswers;
                            
                            if (item.correctAnswers[0].length > 1) {
                                allCorrectAnswers = item.correctAnswers[0];
                            } else {
                                allCorrectAnswers = item.correctAnswers.map(set => set[0]);
                            }

                            return {
                                question: item.question,
                                correctAnswer: allCorrectAnswers,
                                isMultipleCorrect: item.correctAnswers.length > 1 && item.correctAnswers[0].length === 1,
                                index: index
                            };
                        }) || [];

                        console.log('Processed answers:', answers.length);
                        createRequestContainer(panelWindow, responseData.title, answers);

                    } catch (error) {
                        console.error('Error processing lesson response:', error);
                        const container = panelWindow.document.querySelector('.container');
                        if (container) {
                            container.innerHTML = `<div class="error">Error loading lesson content: ${error.message}</div>`;
                        }
                    }
                });
            }
        });
    }
);
