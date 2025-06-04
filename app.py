from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import openai
import os
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from functools import wraps
import nltk
import numpy as np
from sentence_transformers import SentenceTransformer

app = Flask(__name__)
app.secret_key = os.urandom(24)
<<<<<<< HEAD
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'ALPHA1234')
=======
app.config['SECRET_KEY'] = 'ALPHA1234'
>>>>>>> b0f12607b503fcf1975894c143700f6a89574927
CORS(app)

# Initialize NLP models
nltk.download('punkt')
model = SentenceTransformer('all-MiniLM-L6-v2')

# Database setup
def init_db():
    conn = sqlite3.connect('chatbot.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 username TEXT UNIQUE,
                 password TEXT,
                 email TEXT UNIQUE,
                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS conversations
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 user_id INTEGER,
                 title TEXT,
                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                 FOREIGN KEY(user_id) REFERENCES users(id))''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS messages
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 conversation_id INTEGER,
                 content TEXT,
                 is_user BOOLEAN,
                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                 FOREIGN KEY(conversation_id) REFERENCES conversations(id))''')
    conn.commit()
    conn.close()

init_db()

# JWT authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        try:
            data = jwt.decode(token.split()[1], app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data['username']
        except:
            return jsonify({'message': 'Token is invalid'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# OpenAI setup
openai.api_key = os.getenv("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")

class SmartFeatures:
    @staticmethod
    def get_contextual_response(prompt, conversation_history):
        """Generate responses with conversation context"""
        messages = [{"role": "system", "content": "You are a helpful AI assistant."}]
        for msg in conversation_history[-5:]:
            role = "user" if msg['is_user'] else "assistant"
            messages.append({"role": role, "content": msg['content']})
        messages.append({"role": "user", "content": prompt})
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )
        return response.choices[0].message.content

    @staticmethod
    def calculate_similarity(text1, text2):
        """Python implementation of text similarity"""
        embeddings = model.encode([text1, text2])
        return np.dot(embeddings[0], embeddings[1]) / (
            np.linalg.norm(embeddings[0]) * np.linalg.norm(embeddings[1])
        )

    @staticmethod
    def extract_keywords(text):
        """Python implementation of keyword extraction"""
        words = nltk.word_tokenize(text)
        words = [word.lower() for word in words if word.isalpha() and len(word) > 3]
        freq_dist = nltk.FreqDist(words)
        return [word for word, _ in freq_dist.most_common(5)]

# API Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
@token_required
def chat(current_user):
    data = request.get_json()
    prompt = data.get('prompt')
    conversation_id = data.get('conversation_id')
    
    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400
    
    conn = sqlite3.connect('chatbot.db')
    c = conn.cursor()
    conversation_history = []
    if conversation_id:
        c.execute("SELECT content, is_user FROM messages WHERE conversation_id = ? ORDER BY created_at", (conversation_id,))
        conversation_history = [{'content': row[0], 'is_user': bool(row[1])} for row in c.fetchall()]
    
    response = SmartFeatures.get_contextual_response(prompt, conversation_history)
    
    if not conversation_id:
        c.execute("INSERT INTO conversations (user_id, title) VALUES (?, ?)", 
                  (current_user, prompt[:30] + "..."))
        conversation_id = c.lastrowid
    
    c.execute("INSERT INTO messages (conversation_id, content, is_user) VALUES (?, ?, ?)",
              (conversation_id, prompt, True))
    c.execute("INSERT INTO messages (conversation_id, content, is_user) VALUES (?, ?, ?)",
              (conversation_id, response, False))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'response': response,
        'conversation_id': conversation_id
    })

@app.route('/api/similarity', methods=['POST'])
def similarity():
    data = request.get_json()
    return jsonify({
        'similarity': SmartFeatures.calculate_similarity(data['text1'], data['text2'])
    })

@app.route('/api/keywords', methods=['POST'])
def keywords():
    data = request.get_json()
    return jsonify({
        'keywords': SmartFeatures.extract_keywords(data['text'])
    })

if __name__ == '__main__':
    app.run(debug=True)