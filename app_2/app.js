let reviews = [];
let currentReview = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadReviews();
    setupEventListeners();
});

async function loadReviews() {
    try {
        const response = await fetch('reviews_test.tsv');
        const tsvData = await response.text();
        
        return new Promise((resolve) => {
            Papa.parse(tsvData, {
                header: true,
                delimiter: '\t',
                complete: (results) => {
                    reviews = results.data.filter(review => review.text && review.text.trim());
                    resolve();
                },
                error: (error) => {
                    showError('Failed to parse TSV file: ' + error.message);
                    resolve();
                }
            });
        });
    } catch (error) {
        showError('Failed to load reviews file: ' + error.message);
    }
}

function setupEventListeners() {
    document.getElementById('random-review').addEventListener('click', showRandomReview);
    document.getElementById('analyze-sentiment').addEventListener('click', analyzeSentiment);
    document.getElementById('count-nouns').addEventListener('click', countNouns);
}

function showRandomReview() {
    if (reviews.length === 0) {
        showError('No reviews loaded yet');
        return;
    }
    
    resetUI();
    const randomIndex = Math.floor(Math.random() * reviews.length);
    currentReview = reviews[randomIndex];
    document.getElementById('review-text').textContent = currentReview.text;
}

async function analyzeSentiment() {
    if (!currentReview) {
        showError('Please select a review first');
        return;
    }
    
    const prompt = `Classify this review as positive, negative, or neutral: ${currentReview.text}`;
    await callApi(prompt, 'sentiment');
}

async function countNouns() {
    if (!currentReview) {
        showError('Please select a review first');
        return;
    }
    
    const prompt = `Count the nouns in this review and return only High (>15), Medium (6-15), or Low (<6). ${currentReview.text}`;
    await callApi(prompt, 'nouns');
}

async function callApi(prompt, analysisType) {
    resetUI();
    showSpinner(true);
    
    const token = document.getElementById('token-input').value.trim();
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch('https://api-inference.huggingface.co/models/tiiuae/falcon3-7b-base', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ inputs: prompt })
        });
        
        if (!response.ok) {
            if (response.status === 402 || response.status === 429) {
                throw new Error('API rate limit exceeded. Please try again later or use your own API token.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const resultText = data[0]?.generated_text || '';
        const firstLine = resultText.split('\n')[0].toLowerCase().trim();
        
        displayResult(firstLine, analysisType);
        
    } catch (error) {
        showError(error.message);
    } finally {
        showSpinner(false);
    }
}

function displayResult(result, analysisType) {
    const resultElement = document.getElementById('result');
    
    if (analysisType === 'sentiment') {
        if (result.includes('positive')) {
            resultElement.innerHTML = 'Sentiment: 👍 Positive';
        } else if (result.includes('negative')) {
            resultElement.innerHTML = 'Sentiment: 👎 Negative';
        } else if (result.includes('neutral')) {
            resultElement.innerHTML = 'Sentiment: ❓ Neutral';
        } else {
            resultElement.innerHTML = 'Sentiment: ❓ Unable to determine';
        }
    } else if (analysisType === 'nouns') {
        if (result.includes('high')) {
            resultElement.innerHTML = 'Noun Count: 🟢 High';
        } else if (result.includes('medium')) {
            resultElement.innerHTML = 'Noun Count: 🟡 Medium';
        } else if (result.includes('low')) {
            resultElement.innerHTML = 'Noun Count: 🔴 Low';
        } else {
            resultElement.innerHTML = 'Noun Count: ❓ Unable to determine';
        }
    }
}

function showSpinner(show) {
    document.getElementById('spinner').style.display = show ? 'block' : 'none';
}

function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function resetUI() {
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('result').textContent = 'Results will appear here';
}
