document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const apiTokenInput = document.getElementById('apiToken');
    const reviewDisplay = document.getElementById('reviewDisplay');
    const sentimentResult = document.getElementById('sentimentResult');
    const statusDiv = document.getElementById('status');
    const errorDiv = document.getElementById('error');
    
    let reviews = [];
    
    // Load and parse the TSV file
    fetch('reviews_test.tsv')
        .then(response => response.text())
        .then(data => {
            statusDiv.textContent = 'Loading reviews...';
            
            Papa.parse(data, {
                header: true,
                delimiter: '\t',
                skipEmptyLines: true,
                complete: function(results) {
                    reviews = results.data.map(row => row.text).filter(text => text);
                    statusDiv.textContent = `Loaded ${reviews.length} reviews`;
                    analyzeBtn.disabled = false;
                },
                error: function(error) {
                    showError('Error parsing TSV file: ' + error.message);
                }
            });
        })
        .catch(error => {
            showError('Error loading TSV file: ' + error.message);
        });
    
    analyzeBtn.addEventListener('click', function() {
        errorDiv.textContent = '';
        sentimentResult.innerHTML = '';
        
        if (reviews.length === 0) {
            showError('No reviews loaded yet');
            return;
        }
        
        // Select a random review
        const randomIndex = Math.floor(Math.random() * reviews.length);
        const randomReview = reviews[randomIndex];
        
        // Display the review
        reviewDisplay.textContent = randomReview;
        statusDiv.textContent = 'Analyzing sentiment...';
        analyzeBtn.disabled = true;
        
        // Prepare the API request
        const apiToken = apiTokenInput.value.trim();
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (apiToken) {
            headers['Authorization'] = `Bearer ${apiToken}`;
        }
        
        // Call Hugging Face API
        fetch('https://api-inference.huggingface.co/models/siebert/sentiment-roberta-large-english', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ inputs: randomReview })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 503) {
                    throw new Error('Model is loading, please try again in a few moments');
                } else if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please add your API token for higher limits');
                } else {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }
            }
            return response.json();
        })
        .then(data => {
            // Process the response
            if (Array.isArray(data) && data.length > 0 && data[0].length > 0) {
                const result = data[0][0];
                displaySentiment(result);
            } else {
                throw new Error('Unexpected API response format');
            }
        })
        .catch(error => {
            showError(error.message);
        })
        .finally(() => {
            analyzeBtn.disabled = false;
            statusDiv.textContent = 'Analysis complete';
        });
    });
    
    function displaySentiment(result) {
        let icon, label;
        
        if (result.label === 'POSITIVE' && result.score > 0.5) {
            icon = '<i class="fas fa-thumbs-up"></i>';
            label = 'Positive';
        } else if (result.label === 'NEGATIVE' && result.score > 0.5) {
            icon = '<i class="fas fa-thumbs-down"></i>';
            label = 'Negative';
        } else {
            icon = '<i class="fas fa-question-circle"></i>';
            label = 'Neutral';
        }
        
        sentimentResult.innerHTML = `${icon} ${label} (${(result.score * 100).toFixed(1)}%)`;
    }
    
    function showError(message) {
        errorDiv.textContent = message;
        statusDiv.textContent = 'Error occurred';
        analyzeBtn.disabled = false;
    }
});
