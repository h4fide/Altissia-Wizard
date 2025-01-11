// Remove direct encryption key reference
// ...existing code...

// Add data validation
const validateStoredData = (data) => {
    if (!data || !data.encrypted || !data.iv) return false;
    if (!Array.isArray(data.encrypted) || !Array.isArray(data.iv)) return false;
    if (data.iv.length !== 12) return false;
    return true;
};

const ENCRYPTION_KEY = 'wYxULMKtf31rnvS/MpkVMtIEOIxbKHwREtLTVSFD+44=';

// Add this helper function to decode base64
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Data page loaded, checking storage...');
    
    chrome.storage.local.get('extractedData', async function(result) {
        const dataField = document.getElementById('dataField');
        const statusElement = document.getElementById('status');
        
        if (chrome.runtime.lastError) {
            statusElement.textContent = 'Error accessing storage';
            return;
        }

        const encryptedData = result.extractedData;
        if (!validateStoredData(encryptedData)) {
            statusElement.textContent = 'Invalid data format';
            return;
        }

        if (encryptedData) {
            try {
                // Show encrypted data as base64
                const encryptedString = btoa(JSON.stringify(encryptedData));
                dataField.textContent = encryptedString;
                statusElement.textContent = 'Config loaded successfully';
                statusElement.style.color = 'green';
            } catch (error) {
                dataField.textContent = 'Error processing data';
                statusElement.textContent = 'Error processing data';
                statusElement.style.color = 'red';
            }
        } else {
            dataField.textContent = 'No data found in storage.';
            statusElement.textContent = 'No data available';
            statusElement.style.color = 'red';
        }
    });

    // Clear sensitive data when page is unloaded
    window.addEventListener('unload', () => {
        const dataField = document.getElementById('dataField');
        if (dataField) dataField.textContent = '';
        chrome.storage.local.remove('extractedData');
    });

    document.getElementById('copyBtn').addEventListener('click', function() {
        const dataField = document.getElementById('dataField');
        const notification = document.getElementById('notification');
        
        navigator.clipboard.writeText(dataField.textContent).then(() => {
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
            }, 2000);
        }, (err) => {
            console.error('Could not copy text: ', err);
            notification.textContent = 'Failed to copy!';
            notification.style.background = '#ef4444';
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
                notification.style.background = '#22c55e';
                notification.textContent = 'Copied to clipboard!';
            }, 2000);
        });
    });
});