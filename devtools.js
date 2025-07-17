const LESSON_URL_PATTERN = /\/gw\/lcapi\/main\/api\/lc\/lessons\/(.*?)$/;
let panelWindow = null;
let isPanelActive = false;
let isTermsAccepted = false;

function checkTermsAcceptance() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['termsAccepted'], function(result) {
            isTermsAccepted = !!result.termsAccepted;
            resolve(isTermsAccepted);
        });
    });
}

function showLegalModalIfNeeded() {
    checkTermsAcceptance().then(accepted => {
        if (!accepted) {
            document.getElementById('legalModal').style.display = 'flex';
        }
    });
}

function handleTermsAcceptance(accepted) {
    const legalModal = document.getElementById('legalModal');
    
    if (accepted) {
        chrome.storage.local.set({termsAccepted: true}, function() {
            isTermsAccepted = true;
            legalModal.style.display = 'none';
            location.reload();
        });
    } else {
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div class="header">
                    <span class="progress">Terms Declined</span>
                </div>
                <div style="text-align: center; padding: 20px;">
                    <h2>Extension Disabled</h2>
                    <img src="icons/decline.png" alt="decline" style="width: 100px; height: 100px; display: block; margin: 15px auto;">
                    <p>You must accept the terms to use this extension.</p>
                    <button id="showTermsAgain" style="margin-top: 20px; padding: 10px 15px; background-color: #1C4072; color: white; border: none; border-radius: 4px; cursor: pointer;">Show Terms Again</button>
                </div>
            `;
            
            document.getElementById('showTermsAgain').addEventListener('click', function() {
                legalModal.style.display = 'flex';
            });
        }
    }
}

window.onerror = function(msg, url, lineNo, columnNo, error) {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
        errorContainer.style.display = 'block';
        errorContainer.textContent = `Error: ${msg}`;
    }
    console.error('Error:', msg, 'at', lineNo, ':', columnNo);
    return false;
};

function formatQuestion(question) {
    return question?.replace(/\[GAP\]/g, '<span class="gap-dots"> .....</span>') || '';
}

function processAnswers(items) {
    return items.map((item, index) => {
        if (!item) return null;

        const correctAnswers = item.correctAnswers || [];
        let allCorrectAnswers = [];
        let hasMultipleGaps = false;

        try {
            if (Array.isArray(correctAnswers) && correctAnswers.length > 1 && 
                correctAnswers.every(arr => Array.isArray(arr))) {
                hasMultipleGaps = true;
                allCorrectAnswers = correctAnswers.map(gapAnswers => 
                    Array.isArray(gapAnswers) ? gapAnswers[0] : gapAnswers
                ).filter(Boolean);
            } 
            else if (Array.isArray(correctAnswers[0])) {
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
            hasMultipleGaps: hasMultipleGaps,
            index: index
        };
    }).filter(Boolean);
}
 



function showWaitingMessage(container) {
    if (!container) {
        console.error('Container not available for waiting message');
        return;
    }
    
    container.innerHTML = `
        <div class="header">
            <span class="progress"><img src="icons/wizard-3d.png" alt="Wizard" style="height: 2em; vertical-align: bottom;"> Waiting</span>
        </div>
        <div class="waiting-message" style="text-align: center; padding: 20px; color: #666;">
            <h1 class="eye-catching">👀</h1>
            <h2>Waiting for next exercise...</h2>
        </div>
    `;
}

function createRequestContainer(panelWindow, title, answers) {
    if (!isPanelActive || !panelWindow || !panelWindow.document) {
        console.error('Panel window is not available');
        return;
    }

    try {
        const container = panelWindow.document.querySelector('.container');
        if (!container) {
            console.error('Container not found in panel window');
            return;
        }

        container.innerHTML = `
            <div class="header">
                <a href="#" class="back-button" id="backButton">Available Questions</a>
                <span class="progress">${answers?.length || 0} Questions</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <h1 class="question-title">${title || 'Correct Answers'}</h1>
            ${(answers || []).map((answer, index) => `
                <div class="question-box">
                    <div class="question">
                        <b>Question ${index + 1}:</b> ${formatQuestion(answer.question)}
                    </div>
                    <div class="options">
                        ${answer.hasMultipleGaps
                            ? answer.correctAnswer.map((correct, gapIndex) => `
                                <div class="option primary-option" data-answer="${correct}">
                                    <span class="gap-number">${gapIndex + 1}</span>
                                    <span class="answer-text">${correct}</span>
                                </div>
                              `).join('')
                            : (answer.correctAnswer || []).map((ans, i) => `
                                <div class="option ${answer.isMultipleCorrect ? 'primary-option' : (i === 0 ? 'primary-option' : 'alternative-option')}" data-answer="${ans}">
                                    ${(!answer.isMultipleCorrect && i > 0) ? '<span class="ou-label">OR</span>' : ''}
                                    <span class="answer-text">${ans}</span>
                                </div>
                              `).join('')}
                    </div>
                </div>
            `).join('')}
        `;

        const optionElements = panelWindow.document.querySelectorAll('.option');
        optionElements.forEach(option => {
            option.addEventListener('click', () => {
                const text = option.getAttribute('data-answer');
                if (text) copy(text, panelWindow.document);
            });
        });

    } catch (error) {
        console.error('Error updating panel content:', error);
    }
}

function copy(text, doc) {
    const tempInput = doc.createElement("input");
    tempInput.style.position = "absolute";
    tempInput.style.left = "-9999px";
    tempInput.value = text;
    doc.body.appendChild(tempInput);
    tempInput.select();
    doc.execCommand("copy");
    doc.body.removeChild(tempInput);
    showCopySuccess(doc);
}

function showCopySuccess(doc) {
    const existing = doc.getElementById('copy-success-msg');
    if (existing) {
        existing.remove();
    }

    const successMsg = doc.createElement('div');
    successMsg.id = 'copy-success-msg';
    successMsg.textContent = '✅ Copy successful';
    successMsg.style.position = 'fixed';
    successMsg.style.bottom = '30px';
    successMsg.style.right = '30px';
    successMsg.style.backgroundColor = '#4caf50';
    successMsg.style.color = 'white';
    successMsg.style.padding = '10px 20px';
    successMsg.style.borderRadius = '8px';
    successMsg.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    successMsg.style.zIndex = '9999';
    successMsg.style.fontFamily = 'Inter, sans-serif';
    successMsg.style.transition = 'opacity 0.5s ease';
    successMsg.style.opacity = '1';

    doc.body.appendChild(successMsg);

    setTimeout(() => {
        successMsg.style.opacity = '0';
        setTimeout(() => {
            if (successMsg.parentNode) {
                successMsg.parentNode.removeChild(successMsg);
            }
        }, 500);
    }, 1500);
}

window.addEventListener('message', function(event) {
    if (event.data.type === 'updateContent') {
        const data = event.data.data;
        const container = document.querySelector('.container');
        const questionsCounter = document.querySelector('#questions-dis');
        
        if (container && questionsCounter) {
            questionsCounter.textContent = `${data.questionCount} Questions`;
            container.innerHTML = `
                <div class="header">
                    <a href="#" class="back-button">Available Questions</a>
                    <span class="progress">${data.questionCount} Questions</span>
                </div>
            `;
        }
    }
});

chrome.devtools.panels.create(
    "Altissia Wizard",
    "icons/icon.png",
    "devtools.html",
    function(panel) {
        console.log('Panel created');
        
        panel.onShown.addListener(function(extPanelWindow) {
            panelWindow = extPanelWindow;
            isPanelActive = true;
        });

        panel.onHidden.addListener(() => {
            isPanelActive = false;
            panelWindow = null;
        });

        chrome.devtools.network.onRequestFinished.addListener((request) => {
            if (!request.request.url.match(LESSON_URL_PATTERN) || 
                request.request.method !== 'GET') {
                return;
            }

            if (!isPanelActive || !panelWindow || !isTermsAccepted) {
                console.log('Panel window not active or terms not accepted');
                return;
            }

            request.getContent((content, encoding) => {
                try {
                    if (!isPanelActive || !panelWindow) {
                        console.log('Panel became inactive while processing request');
                        return;
                    }

                    const responseData = JSON.parse(content);
                    
                    try {
                        const container = panelWindow.document.querySelector('.container');
                        
                        if (!container) {
                            console.error('Container not found in panel');
                            return;
                        }

                        if (!responseData?.content?.items?.length) {
                            showWaitingMessage(container);
                            return;
                        }

                        const answers = processAnswers(responseData.content.items);
                        if (answers.length > 0) {
                            createRequestContainer(panelWindow, responseData.title || 'Untitled Lesson', answers);
                        }
                    } catch (domError) {
                        console.error('DOM access error:', domError);
                    }
                } catch (error) {
                    console.error('Error processing content:', error);
                }
            });
        });
    }
);

// Help modal functionality
document.getElementById('helpButton').addEventListener('click', function() {
    document.getElementById('helpModal').style.display = 'flex';
});

document.getElementById('closeModal').addEventListener('click', function() {
    document.getElementById('helpModal').style.display = 'none';
});

// Legal modal functionality
document.getElementById('acceptTerms').addEventListener('click', function() {
    handleTermsAcceptance(true);
});

document.getElementById('declineTerms').addEventListener('click', function() {
    handleTermsAcceptance(false);
    document.getElementById('legalModal').style.display = 'none';
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const helpModal = document.getElementById('helpModal');
    if (event.target === helpModal) {
        helpModal.style.display = 'none';
    }
});

// Initialize when DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
    showLegalModalIfNeeded();
});