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
    
    const prompt = `Classify sentiment of this review as positive, negative, or neutral: "${currentReview.text}"`;
    await callApi(prompt, 'sentiment', 'cardiffnlp/twitter-roberta-base-sentiment-latest');
}

async function countNouns() {
    if (!currentReview) {
        showError('Please select a review first');
        return;
    }
    
    const actualCount = countNounsInText(currentReview.text);
    let level = 'Low';
    if (actualCount > 15) level = 'High';
    else if (actualCount >= 6) level = 'Medium';
    
    const resultElement = document.getElementById('result');
    if (level === 'High') resultElement.innerHTML = 'Noun Count: 🟢 High (' + actualCount + ' nouns)';
    else if (level === 'Medium') resultElement.innerHTML = 'Noun Count: 🟡 Medium (' + actualCount + ' nouns)';
    else resultElement.innerHTML = 'Noun Count: 🔴 Low (' + actualCount + ' nouns)';
}

function countNounsInText(text) {
    const words = text.toLowerCase().split(/\s+/);
    const commonNouns = [
        'product', 'review', 'time', 'year', 'friend', 'child', 'daughter', 'bottle', 'film',
        'water', 'splash', 'pineapple', 'dr', 'oz', 'thing', 'way', 'people', 'work', 'life',
        'world', 'house', 'car', 'book', 'movie', 'music', 'food', 'water', 'coffee', 'tea',
        'phone', 'computer', 'money', 'day', 'week', 'month', 'year', 'hour', 'minute', 'second',
        'family', 'friend', 'home', 'job', 'school', 'student', 'teacher', 'city', 'country',
        'company', 'business', 'problem', 'solution', 'idea', 'story', 'information', 'system',
        'service', 'price', 'quality', 'experience', 'result', 'change', 'development', 'level',
        'question', 'answer', 'number', 'part', 'area', 'word', 'fact', 'piece', 'place', 'state',
        'person', 'man', 'woman', 'child', 'boy', 'girl', 'mother', 'father', 'brother', 'sister',
        'eye', 'hand', 'head', 'face', 'body', 'health', 'art', 'war', 'history', 'party', 'room',
        'door', 'window', 'table', 'chair', 'bed', 'floor', 'wall', 'roof', 'garden', 'street',
        'road', 'bridge', 'river', 'mountain', 'sea', 'ocean', 'sky', 'sun', 'moon', 'star',
        'tree', 'flower', 'animal', 'dog', 'cat', 'bird', 'fish', 'horse', 'cow', 'sheep',
        'color', 'sound', 'light', 'dark', 'heat', 'cold', 'size', 'weight', 'height', 'length',
        'speed', 'temperature', 'direction', 'position', 'action', 'movement', 'thought', 'feeling',
        'love', 'hate', 'fear', 'hope', 'dream', 'success', 'failure', 'beauty', 'truth', 'lie',
        'game', 'sport', 'team', 'player', 'ball', 'goal', 'point', 'score', 'win', 'loss',
        'price', 'cost', 'value', 'money', 'cash', 'bank', 'account', 'card', 'bill', 'tax',
        'law', 'rule', 'government', 'president', 'minister', 'office', 'power', 'right', 'freedom',
        'peace', 'war', 'army', 'soldier', 'weapon', 'battle', 'victory', 'defeat', 'enemy', 'friend'
    ];
    
    return words.filter(word => {
        return commonNouns.includes(word) || 
               (word.length > 3 && !word.match(/[0-9]/) && 
                !['the','and','but','for','with','from','this','that','have','been','they','what','when','where','how'].includes(word));
    }).length;
}

async function callApi(prompt, analysisType, model) {
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
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ inputs: prompt })
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Model not found or API endpoint changed. Please check the model name.');
            }
            if (response.status === 402 || response.status === 429) {
                throw new Error('API rate limit exceeded. Please try again later or use your own API token.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        processApiResponse(data, analysisType);
        
    } catch (error) {
        showError(error.message);
    } finally {
        showSpinner(false);
    }
}

function processApiResponse(data, analysisType) {
    const resultElement = document.getElementById('result');
    
    if (analysisType === 'sentiment') {
        let sentiment = 'Unable to determine';
        
        if (Array.isArray(data) && data.length > 0) {
            const firstItem = data[0];
            if (Array.isArray(firstItem) && firstItem.length > 0) {
                sentiment = firstItem[0].label || '';
            } else if (firstItem.label) {
                sentiment = firstItem.label;
            }
        } else if (data.label) {
            sentiment = data.label;
        }
        
        sentiment = sentiment.toLowerCase();
        
        if (sentiment.includes('positive') || sentiment.includes('pos')) {
            resultElement.innerHTML = 'Sentiment: 👍 Positive';
        } else if (sentiment.includes('negative') || sentiment.includes('neg')) {
            resultElement.innerHTML = 'Sentiment: 👎 Negative';
        } else if (sentiment.includes('neutral') || sentiment.includes('neu')) {
            resultElement.innerHTML = 'Sentiment: ❓ Neutral';
        } else {
            resultElement.innerHTML = 'Sentiment: ❓ Unable to determine';
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
