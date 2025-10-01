let reviews = [];
let currentReview = null;

const tokenInput = document.getElementById('token-input');
const randomBtn = document.getElementById('random-btn');
const sentimentBtn = document.getElementById('sentiment-btn');
const nounsBtn = document.getElementById('nouns-btn');
const reviewText = document.getElementById('review-text');
const sentimentResult = document.getElementById('sentiment-result');
const nounsResult = document.getElementById('nouns-result');
const errorMessage = document.getElementById('error-message');
const spinner = document.getElementById('spinner');

const MODEL_ENDPOINTS = [
    'https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct',
    'https://api-inference.huggingface.co/models/microsoft/DialoGPT-large'
];

let currentModelIndex = 0;

async function loadReviews() {
    try {
        showSpinner();
        const response = await fetch('reviews_test.tsv');
        const tsvData = await response.text();
        
        Papa.parse(tsvData, {
            header: true,
            delimiter: '\t',
            complete: function(results) {
                reviews = results.data.filter(review => review.text && review.text.trim());
                hideSpinner();
                if (reviews.length === 0) {
                    showError('No reviews found in the TSV file');
                }
            },
            error: function(error) {
                hideSpinner();
                showError('Error parsing TSV file: ' + error.message);
            }
        });
    } catch (error) {
        hideSpinner();
        showError('Error loading reviews: ' + error.message);
    }
}

function showSpinner() {
    spinner.style.display = 'block';
}

function hideSpinner() {
    spinner.style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

function hideError() {
    errorMessage.style.display = 'none';
}

function resetUI() {
    sentimentResult.textContent = '❓';
    nounsResult.textContent = '⚪';
    hideError();
}

function getRandomReview() {
    if (reviews.length === 0) {
        showError('No reviews available');
        return null;
    }
    return reviews[Math.floor(Math.random() * reviews.length)];
}

function countNouns(text) {
    const nounRegex = /\b(NN|NNS|NNP|NNPS)\b/;
    const posTags = [
        'NN', 'NNS', 'NNP', 'NNPS'
    ];
    
    const words = text.toLowerCase().split(/\s+/);
    let nounCount = 0;
    
    words.forEach(word => {
        if (word.length < 2) return;
        
        const cleanWord = word.replace(/[^a-z]/g, '');
        if (cleanWord.length < 2) return;
        
        if (posTags.some(tag => {
            const pattern = new RegExp(`\\b${cleanWord}\\b`, 'i');
            return nounRegex.test(tag) && pattern.test(text);
        })) {
            nounCount++;
        } else {
            if (cleanWord.length > 3 && 
                !['the', 'and', 'but', 'for', 'nor', 'not', 'yet', 'so'].includes(cleanWord) &&
                !cleanWord.endsWith('ly') && !cleanWord.endsWith('ing') && 
                !cleanWord.endsWith('ed') && !cleanWord.endsWith('es') &&
                !cleanWord.match(/^\d+$/) && cleanWord.match(/[aeiou]/i)) {
                nounCount++;
            }
        }
    });
    
    return nounCount;
}

async function callApi(prompt, text) {
    const fullPrompt = prompt + text;
    const token = tokenInput.value.trim();
    
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(MODEL_ENDPOINTS[currentModelIndex], {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ inputs: fullPrompt })
        });
        
        if (response.status === 402 || response.status === 429) {
            if (currentModelIndex < MODEL_ENDPOINTS.length - 1) {
                currentModelIndex++;
                return await callApi(prompt, text);
            } else {
                throw new Error('Rate limit exceeded on all models. Please try again later or use your API token.');
            }
        }
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data[0]?.generated_text || '';
    } catch (error) {
        if (error.message.includes('Rate limit') && currentModelIndex < MODEL_ENDPOINTS.length - 1) {
            currentModelIndex++;
            return await callApi(prompt, text);
        }
        throw error;
    }
}

function analyzeSentimentResponse(response) {
    const firstLine = response.split('\n')[0].toLowerCase();
    
    if (firstLine.includes('positive')) return '👍';
    if (firstLine.includes('negative')) return '👎';
    if (firstLine.includes('neutral')) return '❓';
    
    if (firstLine.includes('good') || firstLine.includes('great') || firstLine.includes('excellent') || 
        firstLine.includes('awesome') || firstLine.includes('love') || firstLine.includes('wonderful')) {
        return '👍';
    }
    
    if (firstLine.includes('bad') || firstLine.includes('terrible') || firstLine.includes('awful') || 
        firstLine.includes('hate') || firstLine.includes('poor')) {
        return '👎';
    }
    
    return '❓';
}

function analyzeNounsResponse(response) {
    const firstLine = response.split('\n')[0].toLowerCase();
    
    if (firstLine.includes('high')) return '🟢';
    if (firstLine.includes('medium')) return '🟡';
    if (firstLine.includes('low')) return '🔴';
    
    const match = firstLine.match(/\d+/);
    if (match) {
        const count = parseInt(match[0]);
        if (count > 15) return '🟢';
        if (count >= 6) return '🟡';
        return '🔴';
    }
    
    return '⚪';
}

async function handleRandomReview() {
    resetUI();
    const review = getRandomReview();
    if (review) {
        currentReview = review;
        reviewText.textContent = review.text;
    }
}

async function handleSentimentAnalysis() {
    if (!currentReview) {
        showError('Please select a random review first');
        return;
    }
    
    try {
        resetUI();
        showSpinner();
        sentimentBtn.disabled = true;
        
        const response = await callApi(
            "Classify this review as positive, negative, or neutral: ",
            currentReview.text
        );
        
        const sentiment = analyzeSentimentResponse(response);
        sentimentResult.textContent = sentiment;
        
    } catch (error) {
        showError(error.message);
    } finally {
        hideSpinner();
        sentimentBtn.disabled = false;
    }
}

async function handleNounsAnalysis() {
    if (!currentReview) {
        showError('Please select a random review first');
        return;
    }
    
    try {
        resetUI();
        showSpinner();
        nounsBtn.disabled = true;
        
        const actualCount = countNouns(currentReview.text);
        
        const response = await callApi(
            "Count the nouns in this review and return only High (>15), Medium (6-15), or Low (<6).",
            currentReview.text
        );
        
        const nounLevel = analyzeNounsResponse(response);
        nounsResult.textContent = nounLevel;
        
    } catch (error) {
        showError(error.message);
    } finally {
        hideSpinner();
        nounsBtn.disabled = false;
    }
}

randomBtn.addEventListener('click', handleRandomReview);
sentimentBtn.addEventListener('click', handleSentimentAnalysis);
nounsBtn.addEventListener('click', handleNounsAnalysis);

document.addEventListener('DOMContentLoaded', loadReviews);
