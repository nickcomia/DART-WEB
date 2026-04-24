// js/server.js
require('dotenv').config({ path: './env' });
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..'))); // Serve from root

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/api/analyze', async (req, res) => {
    try {
        const { reviewText, rating, imageBase64 } = req.body;
        if (!reviewText || reviewText.trim().length === 0) {
            return res.status(400).json({ error: 'Review text is required' });
        }

        const messages = [
            {
                role: 'system',
                content: `You are DART (Deceptive Assessment and Review Tracking), an expert AI system for detecting fake product reviews.
                Analyze the provided review and determine if it's likely fake or genuine.
                Consider: unnatural writing patterns, forced emotions, keyword stuffing, AI-generation, rating mismatch, vagueness, and excessive positivity/negativity.
                Return ONLY valid JSON with this exact structure:
                {
                    "riskScore": number (0-100, higher = more fake),
                    "riskLevel": "Low" | "Medium" | "High",
                    "explanation": "detailed analysis",
                    "flags": ["flag1", "flag2"],
                    "textAnalysis": "brief analysis of text quality",
                    "behavioralAnalysis": "rating consistency and pattern analysis"
                }`
            },
            {
                role: 'user',
                content: `Review Text: "${reviewText}"\nStar Rating: ${rating || 'Not provided'} out of 5 stars\n\nAnalyze authenticity and return JSON.`
            }
        ];

        if (imageBase64 && imageBase64.length > 0) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: 'Also analyze this product image for authenticity (stock photo, AI-generated, irrelevant, or genuine user photo).' },
                    { type: 'image_url', image_url: { url: imageBase64 } }
                ]
            });
        }

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            response_format: { type: 'json_object' }
        });

        const result = JSON.parse(completion.choices[0].message.content);
        res.json(result);
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Analysis failed. Please try again.' });
    }
});

app.listen(PORT, () => {
    console.log(`DART server running on http://localhost:${PORT}`);
});