// At the top of the file
export {}; // Add this line to mark as module

const TARGET_URL = 'https://app.ofppt-langues.ma/gw/eventapi/main/api/event/internal/events';
const ENCRYPTION_KEY = 'wYxULMKtf31rnvS/MpkVMtIEOIxbKHwREtLTVSFD+44=';
let isMonitoring = false;

// Add this helper function to decode base64
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Add these helper functions for compression
async function compressData(jsonString) {
    const compressionStream = new CompressionStream('gzip');
    const writer = compressionStream.writable.getWriter();
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(jsonString);
    
    writer.write(encodedData);
    writer.close();
    
    const output = [];
    const reader = compressionStream.readable.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        output.push(...value);
    }
    
    return new Uint8Array(output);
}

// Obfuscate encryption key using a more secure approach
const getEncryptionKey = () => {
    const parts = [
        'wYxULMKtf3',
        '1rnvS/MpkV',
        'MtIEOIxbKH',
        'wREtLTVSFD+44='
    ];
    return parts.map(p => atob(btoa(p))).join('');
};

// Add request validation
const isValidRequest = (details) => {
    if (!details || !details.url || !details.method) return false;
    const validOrigin = details.initiator?.includes('ofppt-langues.ma') || 
                       details.originUrl?.includes('ofppt-langues.ma');
    return validOrigin && details.method === 'POST';
};

// Add data validation
const validateData = (data) => {
    if (!data || typeof data !== 'object') return false;
    if (!data.data?.payload || !Array.isArray(data.data.payload)) return false;
    if (!data.data?.cookies || !Array.isArray(data.data.cookies)) return false;
    return true;
};

// Replace direct encryption key usage with getter
async function encryptData(data) {
    if (!validateData(data)) {
        throw new Error('Invalid data format');
    }

    const jsonString = JSON.stringify(data);
    const compressedData = await compressData(jsonString);
    
    const keyData = base64ToArrayBuffer(getEncryptionKey());
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        compressedData
    );
    
    return {
        encrypted: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv)
    };
}

// Add request rate limiting
const requestLimiter = {
    requests: new Map(),
    maxRequests: 5,
    timeWindow: 60000, // 1 minute
    
    isAllowed: function(ip) {
        const now = Date.now();
        const reqs = this.requests.get(ip) || [];
        const recentReqs = reqs.filter(time => now - time < this.timeWindow);
        
        if (recentReqs.length >= this.maxRequests) return false;
        
        recentReqs.push(now);
        this.requests.set(ip, recentReqs);
        return true;
    }
};

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.url.includes('ofppt-langues.ma')) {
            // Remove console.log
        }
    },
    { urls: ["*://*.ofppt-langues.ma/*"] },
    ["requestBody"]
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getCookies') {
        // Use a wider domain pattern to ensure we catch all cookies
        chrome.cookies.getAll({
            domain: "ofppt-langues.ma"
        }, (cookies) => {
            if (!cookies || cookies.length === 0) {
                console.warn('No cookies found');
                sendResponse({ cookies: [] });
                return;
            }

            // Filter and format cookies
            const formattedCookies = cookies
                .filter(cookie => 
                    ['x-altissia-token', 'x-device-uuid', 'JSESSIONID'].includes(cookie.name)
                )
                .map(cookie => ({
                    domain: cookie.domain,
                    name: cookie.name,
                    value: cookie.value,
                    path: cookie.path,
                    secure: cookie.secure,
                    httpOnly: cookie.httpOnly,
                    sameSite: cookie.sameSite || "no_restriction"
                }));

            sendResponse({ cookies: formattedCookies });
        });
        return true; // Keep the message channel open for async response
    }

    if (message.action === 'startMonitoring') {
        isMonitoring = true;
        sendResponse({ success: true });
    }
});

// Network request listener
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (!isValidRequest(details)) return;
        if (!isMonitoring) return;
        
        const sourceIP = details.ip || 'unknown';
        if (!requestLimiter.isAllowed(sourceIP)) {
            console.warn('Rate limit exceeded for', sourceIP);
            return;
        }

        isMonitoring = false;
        let payload = {};
        
        try {
            if (details.requestBody) {
                if (details.requestBody.raw) {
                    // Handle raw data
                    const decoder = new TextDecoder('utf-8');
                    const rawData = details.requestBody.raw[0].bytes;
                    const decodedData = decoder.decode(rawData);
                    payload = JSON.parse(decodedData);
                } else if (details.requestBody.formData) {
                    // Handle form data
                    payload = details.requestBody.formData;
                }
            }
        } catch (e) {
            payload = details.requestBody || {}; // Fallback to raw request body
        }

        // Update cookie gathering
        chrome.cookies.getAll({ 
            domain: "ofppt-langues.ma"
        }, (cookies) => {
            const filteredCookies = (cookies || []).filter(cookie => 
                cookie && cookie.name && 
                ['x-altissia-token', 'x-device-uuid', 'JSESSIONID'].includes(cookie.name)
            );

            if (!filteredCookies || filteredCookies.length === 0) {
                console.warn('Required cookies not found');
                return;
            }

            const formattedCookies = filteredCookies.map(cookie => ({
                domain: cookie.domain,
                name: cookie.name,
                value: cookie.value,
                path: cookie.path,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite || "no_restriction"
            }));

            const dataToExport = {
                data: {
                    payload: [payload],
                    cookies: formattedCookies
                }
            };

            encryptData(dataToExport).then(encryptedData => {
                chrome.storage.local.set({ 
                    extractedData: encryptedData
                }, function() {
                    if (chrome.runtime.lastError) {
                        return;
                    }
                    
                    chrome.tabs.create({ url: 'data.html' });
                });
            });
        });
    },
    { urls: [TARGET_URL] },
    ['requestBody']
);

// Clear monitoring state when extension unloads
chrome.runtime.onSuspend.addListener(() => {
    isMonitoring = false;
});

const LESSON_URL_PATTERN = /https:\/\/app\.ofppt-langues\.ma\/gw\/lcapi\/main\/api\/lc\/lessons\/(.*?)$/;

// Listen for URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.url.includes('ofppt-langues.ma')) {
        checkForLessonApi(tabId);
    }
});

// Monitor network requests
chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (LESSON_URL_PATTERN.test(details.url)) {
            fetch(details.url)
                .then(response => response.json())
                .then(responseData => {
                    const answers = processLessonData(responseData);
                    // Store answers and inject overlay
                    chrome.storage.local.set({ 'lastAnswers': answers });
                    injectOverlay(details.tabId, answers);
                });
        }
    },
    { urls: ["*://*.ofppt-langues.ma/*"] }
);

function processLessonData(responseData) {
    const answers = responseData.content?.items?.map((item, index) => ({
        question: item.question,
        correctAnswer: item.correctAnswers.length > 1 
            ? item.correctAnswers.map(set => set[0]).join(' OR ')
            : item.correctAnswers[0].join(' OR '),
        index: index,
        isMultiAnswer: item.correctAnswers.length > 1 || item.correctAnswers[0].length > 1
    })) || [];

    return {
        title: responseData.title,
        answers: answers
    };
}

function injectOverlay(tabId, answers) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: createOverlay,
        args: [answers]
    });
}

function checkForLessonApi(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: () => {
            // Monitor fetch requests
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                const response = await originalFetch(...args);
                if (args[0].includes('/lessons/')) {
                    response.clone().json().then(data => {
                        chrome.runtime.sendMessage({ 
                            type: 'lessonData',
                            data: data
                        });
                    });
                }
                return response;
            };
        }
    });
}
