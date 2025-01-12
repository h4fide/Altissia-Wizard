# Altissia Wizard Chrome Extension

A Chrome DevTools extension that helps display answers for Altissia language learning platform exercises.

## Features

- Automatically detects and displays exercise answers
- Copy answers with a single click
- Shows multiple correct answers when available
- Real-time updates as you navigate through lessons
- Clean and intuitive user interface

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. Open DevTools (F12) and find the "Altissia Wizard" tab

## Usage

1. Navigate to `app.ofppt-langues.ma`
2. Open Chrome DevTools (F12) or `Ctrl+Shift+I`
3. Select the `Altissia Wizard` tab
4. Start a lesson or exercise
5. Answers will automatically appear in the panel
6. Click on any answer to copy it to clipboard

## Development

### File Structure

```
Altissia Wizard/
├── manifest.json
├── devtools.html
├── devtools.js
├── styles.css
└── icons/
    └── icon.png
```

### Technical Details
- Uses Chrome DevTools API
- Monitors network requests for lesson data
- Processes JSON responses to extract answers
- Updates UI in real-time

## Contributing

Feel free to submit issues and enhancement requests.

## Disclaimer ⚠️

### This extension is for educational purposes only please use it responsibly.