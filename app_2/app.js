class ReviewAnalyzer {
    constructor() {
        this.reviews = [];
        this.currentReview = null;
        this.isLoading = false;

        this.initializeElements();
        this.loadReviews();
        this.attachEventListeners();
    }

    initializeElements() {
        this.reviewTextElement = document.getElementById('review-text');
        this.sentimentResultElement = document.getElementById('sentiment-result');
        this.nounResultElement = document.getElementById('noun-result');
        this.errorMessageElement = document.getElementById('error-message');
        this.spinnerElement = document.getElementById('spinner');
        this.randomReviewButton = document.getElementById('random-review');
        this.analyzeSentimentButton = document.getElementById('analyze-sentiment');
        this.countNounsButton = document.getElementById('count-nouns');
        this.apiTokenInput = document.getElementById('api-token');
    }

    async loadReviews() {
        try {
            this.showSpinner();
            const response = await fetch('reviews_test.tsv');
            const tsvData = await response.text();
            
            Papa.parse(tsvData, {
                header: true,
                delimiter: '\t',
                complete: (results) => {
                    this.reviews = results.data.filter(review => review.text && review.text.trim());
                    this.hideSpinner();
                    if (this.reviews.length === 0) {
                        this.showError('No reviews found in the TSV file');
                    }
                },
                error: (error) => {
                    this.showError('Failed to parse TSV file: ' + error.message);
                    this.hideSpinner();
                }
            });
        } catch (error) {
            this.showError('Failed to load reviews file: ' + error.message);
            this.hideSpinner();
        }
    }

    attachEventListeners() {
        this.randomReviewButton.addEventListener('click', () => this.selectRandomReview());
        this.analyzeSentimentButton.addEventListener('click', () => this.analyzeSentiment());
        this.countNounsButton.addEventListener('click', () => this.countNouns());
    }

    selectRandomReview() {
        if (this.reviews.length === 0) {
            this.showError('No reviews available. Please wait for reviews to load.');
            return;
        }

        const randomIndex = Math.floor(Math.random() * this.reviews.length);
        this.currentReview = this.reviews[randomIndex];
        this.reviewTextElement.textContent = this.currentReview.text;
        this.clearResults();
        this.hideError();
    }

    async analyzeSentiment() {
        if (!this.validateReview()) return;

        const prompt = `Classify this review as positive, negative, or neutral: ${this.currentReview.text}`;
        await this.callApi(prompt, 'sentiment');
    }

    async countNouns() {
        if (!this.validateReview()) return;

        const prompt = `Count the nouns in this review and return only High (>15), Medium (6-15), or Low (<6). ${this.currentReview.text}`;
        await this.callApi(prompt, 'nouns');
    }

    async callApi(prompt, analysisType) {
        if (this.isLoading) return;

        this.showSpinner();
        this.hideError();
        this.isLoading = true;

        try {
            const token = this.apiTokenInput.value.trim();
            const headers = {
                'Content-Type': 'application/json',
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Use different models for different tasks
            const model = analysisType === 'sentiment' 
                ? 'microsoft/DialoGPT-medium'  // Good for classification tasks
                : 'microsoft/DialoGPT-large';  // Better for complex counting tasks

            const response = await fetch(
                `https://api-inference.huggingface.co/models/${model}`,
                {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ inputs: prompt })
                }
            );

            if (!response.ok) {
                await this.handleApiError(response);
                return;
            }

            const data = await response.json();
            this.processApiResponse(data, analysisType);

        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideSpinner();
            this.isLoading = false;
        }
    }

    processApiResponse(data, analysisType) {
        try {
            let resultText = '';
            
            if (data && data[0] && data[0].generated_text) {
                resultText = data[0].generated_text.toLowerCase().trim();
            } else if (data && data.generated_text) {
                resultText = data.generated_text.toLowerCase().trim();
            } else {
                throw new Error('Unexpected API response format');
            }

            // Extract first line and clean up the response
            const firstLine = resultText.split('\n')[0].trim();
            
            if (analysisType === 'sentiment') {
                this.processSentimentResult(firstLine);
            } else {
                this.processNounResult(firstLine);
            }

        } catch (error) {
            this.showError('Failed to process API response: ' + error.message);
        }
    }

    processSentimentResult(result) {
        if (result.includes('positive')) {
            this.sentimentResultElement.textContent = '👍';
            this.sentimentResultElement.style.color = '#10b981';
        } else if (result.includes('negative')) {
            this.sentimentResultElement.textContent = '👎';
            this.sentimentResultElement.style.color = '#ef4444';
        } else if (result.includes('neutral')) {
            this.sentimentResultElement.textContent = '❓';
            this.sentimentResultElement.style.color = '#6b7280';
        } else {
            this.showError('Could not determine sentiment from response');
        }
    }

    processNounResult(result) {
        if (result.includes('high') || result.includes('>15')) {
            this.nounResultElement.textContent = '🟢';
            this.nounResultElement.style.color = '#10b981';
        } else if (result.includes('medium') || (result.includes('6') && result.includes('15'))) {
            this.nounResultElement.textContent = '🟡';
            this.nounResultElement.style.color = '#f59e0b';
        } else if (result.includes('low') || result.includes('<6')) {
            this.nounResultElement.textContent = '🔴';
            this.nounResultElement.style.color = '#ef4444';
        } else {
            // Fallback: count nouns manually from the original text
            this.fallbackNounCount();
        }
    }

    fallbackNounCount() {
        // Simple noun counting fallback using common noun patterns
        const text = this.currentReview.text.toLowerCase();
        const nounPattern = /\b(the |a |an )?[a-z]+(ing|ed|s|ment|tion|ity|ness|ance|ence)?\b/g;
        const words = text.match(nounPattern) || [];
        
        // Filter out common non-nouns and count unique nouns
        const stopWords = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were']);
        const nouns = new Set();
        
        words.forEach(word => {
            const cleanWord = word.replace(/^(the |a |an )/, '').trim();
            if (cleanWord.length > 2 && !stopWords.has(cleanWord)) {
                nouns.add(cleanWord);
            }
        });

        const count = nouns.size;
        
        if (count > 15) {
            this.nounResultElement.textContent = '🟢';
            this.nounResultElement.style.color = '#10b981';
        } else if (count >= 6) {
            this.nounResultElement.textContent = '🟡';
            this.nounResultElement.style.color = '#f59e0b';
        } else {
            this.nounResultElement.textContent = '🔴';
            this.nounResultElement.style.color = '#ef4444';
        }
    }

    async handleApiError(response) {
        switch (response.status) {
            case 402:
                this.showError('Payment required. Please check your Hugging Face API token.');
                break;
            case 429:
                this.showError('Rate limit exceeded. Please wait or add your API token for higher limits.');
                break;
            case 401:
                this.showError('Invalid API token. Please check your Hugging Face API token.');
                break;
            case 503:
                this.showError('Model is loading. Please try again in a few seconds.');
                break;
            default:
                this.showError(`API error: ${response.status} - ${response.statusText}`);
        }
    }

    validateReview() {
        if (!this.currentReview) {
            this.showError('Please select a review first using "Select Random Review"');
            return false;
        }
        return true;
    }

    showSpinner() {
        this.spinnerElement.style.display = 'block';
    }

    hideSpinner() {
        this.spinnerElement.style.display = 'none';
    }

    showError(message) {
        this.errorMessageElement.textContent = message;
        this.errorMessageElement.style.display = 'block';
    }

    hideError() {
        this.errorMessageElement.style.display = 'none';
    }

    clearResults() {
        this.sentimentResultElement.textContent = '❓';
        this.sentimentResultElement.style.color = '';
        this.nounResultElement.textContent = '⚪';
        this.nounResultElement.style.color = '';
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ReviewAnalyzer();
});
