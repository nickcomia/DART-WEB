// js/dart-api.js
let apiUrl = localStorage.getItem('dart_api_url') || 'http://localhost:3000/api/analyze';

async function analyzeReview() {
    const reviewText = document.getElementById('reviewText').value;
    const rating = document.getElementById('rating').value;
    const imageInput = document.getElementById('imageInput');
    let imageBase64 = null;
    
    if (!reviewText.trim()) {
        alert('Please enter a review text to analyze');
        return;
    }
    
    if (imageInput && imageInput.files && imageInput.files[0]) {
        imageBase64 = await fileToBase64(imageInput.files[0]);
    }
    
    document.getElementById('loading').style.display = 'block';
    document.getElementById('result').style.display = 'none';
    
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewText, rating, imageBase64 })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        displayResult(data);
    } catch (error) {
        alert('Analysis failed: ' + error.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function displayResult(data) {
    const resultDiv = document.getElementById('result');
    const riskClass = data.riskLevel === 'High' ? 'risk-high' : (data.riskLevel === 'Medium' ? 'risk-medium' : 'risk-low');
    let riskColor = '#10b981';
    if (data.riskLevel === 'Medium') riskColor = '#f59e0b';
    if (data.riskLevel === 'High') riskColor = '#ef4444';
    
    let flagsHtml = '';
    if (data.flags && data.flags.length) {
        flagsHtml = `<div class="flags">${data.flags.map(f => `<span class="flag">⚠️ ${f}</span>`).join('')}</div>`;
    }
    
    resultDiv.innerHTML = `
        <div class="result-card ${riskClass}">
            <h3>Analysis Results</h3>
            <div style="margin: 1rem 0;">
                <strong>Risk Score:</strong> ${data.riskScore}/100
                <div style="height: 8px; background: #2a2a35; border-radius: 4px; margin-top: 5px;">
                    <div style="width: ${data.riskScore}%; height: 100%; background: ${riskColor}; border-radius: 4px;"></div>
                </div>
            </div>
            <p><strong>Risk Level:</strong> <span style="color: ${riskColor}">${data.riskLevel}</span></p>
            <p><strong>Explanation:</strong> ${data.explanation}</p>
            ${data.textAnalysis ? `<p><strong>Text Analysis:</strong> ${data.textAnalysis}</p>` : ''}
            ${data.behavioralAnalysis ? `<p><strong>Behavioral Analysis:</strong> ${data.behavioralAnalysis}</p>` : ''}
            ${flagsHtml}
        </div>
    `;
    resultDiv.style.display = 'block';
}

// Update apiUrl if changed in settings
window.addEventListener('storage', function(e) {
    if (e.key === 'dart_api_url') apiUrl = e.newValue;
});