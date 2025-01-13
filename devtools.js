window.onerror = function(msg, url, lineNo, columnNo, error) {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
        errorContainer.style.display = 'block';
        errorContainer.textContent = `Error: ${msg}`;
    }
    console.error('Error:', msg, 'at', lineNo, ':', columnNo);
    return false;
};

window.addEventListener('message', function(event) {
    if (event.data.type === 'updateContent') {
        const data = event.data.data;
        const container = document.querySelector('.container');
        const questionsCounter = document.querySelector('#questions-dis');
        
        if (container && questionsCounter) {
            questionsCounter.textContent = `${data.questionCount} Questions`;
            container.innerHTML = `
                <div class="header">
                    <a href="#" class="back-button">Questions disponibles</a>
                    <span class="progress">${data.questionCount} Questions</span>
                </div>
            `;
        }
    }
});

let panelWindow = null;
const LESSON_URL_PATTERN = /https:\/\/app\.ofppt-langues\.ma\/gw\/lcapi\/main\/api\/lc\/lessons\/(.*?)$/;

function createRequestContainer(panelWindow, title, answers) {
    const container = panelWindow.document.querySelector('.container');
    if (!container) return;

    const formatQuestion = (question) => {
        return question?.replace(/\[GAP\]/g, '<span class="gap-dots"> .....</span>') || '';
    };

    container.innerHTML = `
        <div class="header">
            <a href="#" class="back-button" id="backButton">Questions disponibles</a>
            <span class="progress">${answers?.length || 0} Questions</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
        <h1 class="question-title">${title || 'Réponses correctes'}</h1>
        ${(answers || []).map((answer, idx) => `
            <div class="question-box">
                <div class="question">
                    <b>Question ${idx + 1}:</b> ${formatQuestion(answer.question)}
                </div>
                <div class="options">
                    ${(answer.correctAnswer || []).map((ans, ansIdx) => `
                        <div class="option ${answer.isMultipleCorrect ? 'primary-option' : (ansIdx === 0 ? 'primary-option' : 'alternative-option')}" data-answer="${ans}">
                            ${(!answer.isMultipleCorrect && ansIdx > 0) ? '<span class="ou-label">OU</span>' : ''}
                            <span class="answer-text">${ans}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
    `;
}

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
                        console.log('Parsed response data:', responseData);

                        if (!responseData || !responseData.content || !Array.isArray(responseData.content.items)) {
                            const container = panelWindow.document.querySelector('.container');
                            if (container) {
                                container.innerHTML = `
                                <div class="header">
                                    <span class="progress">🧙‍♂️ Waiting</span>
                                </div>
                                <div class="waiting-message" style="text-align: center; padding: 20px; color: #666;">
                                    <h1 style="font-size: 4em;">👀</h1>
                                    <h2>En attente du prochain exercice...</2>
                                </div>
                                `;
                            }
                            return;
                        }

                        const items = responseData.content.items;
                        const answers = items.map((item, index) => {
                            if (!item) return null;

                            const correctAnswers = item.correctAnswers || [];
                            let allCorrectAnswers = [];

                            try {
                                if (Array.isArray(correctAnswers[0])) {
                                    allCorrectAnswers = correctAnswers[0].filter(Boolean);
                                } else {
                                    allCorrectAnswers = correctAnswers.map(set => 
                                        Array.isArray(set) ? set[0] : set
                                    ).filter(Boolean);
                                }
                            } catch (e) {
                                console.warn('Error processing answers for item:', item);
                            }

                            return {
                                question: item.question || 'Question not available',
                                correctAnswer: allCorrectAnswers,
                                isMultipleCorrect: correctAnswers.length > 1 && 
                                    Array.isArray(correctAnswers[0]) && 
                                    correctAnswers[0].length === 1,
                                index: index
                            };
                        }).filter(Boolean);

                        if (answers.length > 0) {
                            createRequestContainer(panelWindow, responseData.title || 'Untitled Lesson', answers);
                        }

                    } catch (error) {
                        console.warn('Waiting for valid exercise data');
                        const container = panelWindow.document.querySelector('.container');
                        if (container) {
                            container.innerHTML = `
                                <div class="header">
                                    <span class="progress">🧙‍♂️ Waiting...</span>
                                </div>
                                <div class="waiting-message" style="text-align: center; padding: 20px; color: #666;">
                                    <h1 style="font-size: 4em;">👀</h1>
                                    <h2>En attente du prochain exercice...</2>
                                </div>

                            `;
                        }
                    }
                });
            }
        });
    }
);
