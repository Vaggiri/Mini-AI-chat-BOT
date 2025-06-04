# app.py
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
import openai
import os
import datetime
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from functools import wraps
import subprocess
import threading

app = Flask(__name__)
app.secret_key = os.urandom(24)
app.config['SECRET_KEY'] = 'ALPHA1234'
CORS(app)

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
    
    c.execute('''CREATE TABLE IF NOT EXISTS documents
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 user_id INTEGER,
                 filename TEXT,
                 content TEXT,
                 vector_embedding BLOB,
                 uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                 FOREIGN KEY(user_id) REFERENCES users(id))''')
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

# Smart features implementation
class SmartFeatures:
    @staticmethod
    def get_contextual_response(prompt, conversation_history):
        """Generate responses with conversation context"""
        messages = [{"role": "system", "content": "You are a helpful AI assistant."}]
        for msg in conversation_history[-5:]:  # Use last 5 messages as context
            role = "user" if msg['is_user'] else "assistant"
            messages.append({"role": role, "content": msg['content']})
        messages.append({"role": "user", "content": prompt})
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )
        return response.choices[0].message.content

    @staticmethod
    def analyze_sentiment(text):
        """Sentiment analysis using OpenAI"""
        response = openai.Completion.create(
            engine="text-davinci-003",
            prompt=f"Analyze the sentiment of this text: {text}\nSentiment:",
            temperature=0.3,
            max_tokens=60
        )
        return response.choices[0].text.strip()

    @staticmethod
    def summarize_text(text):
        """Text summarization"""
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "Summarize the following text concisely."},
                {"role": "user", "content": text}
            ],
            temperature=0.5,
            max_tokens=150
        )
        return response.choices[0].message.content

# API Routes
@app.route('/api/chat', methods=['POST'])
@token_required
def chat(current_user):
    data = request.get_json()
    prompt = data.get('prompt')
    conversation_id = data.get('conversation_id')
    
    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400
    
    # Get conversation history
    conn = sqlite3.connect('chatbot.db')
    c = conn.cursor()
    conversation_history = []
    if conversation_id:
        c.execute("SELECT content, is_user FROM messages WHERE conversation_id = ? ORDER BY created_at", (conversation_id,))
        conversation_history = [{'content': row[0], 'is_user': bool(row[1])} for row in c.fetchall()]
    
    # Generate smart response
    response = SmartFeatures.get_contextual_response(prompt, conversation_history)
    
    # Store messages
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

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    conn = sqlite3.connect('chatbot.db')
    c = conn.cursor()
    c.execute("SELECT id, password FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    conn.close()
    
    if not user or not check_password_hash(user[1], password):
        return jsonify({'message': 'Invalid credentials'}), 401
    
    token = jwt.encode({
        'username': username,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, app.config['SECRET_KEY'])
    
    return jsonify({'token': token})

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    
    if not username or not password or not email:
        return jsonify({'message': 'Missing required fields'}), 400
    
    hashed_password = generate_password_hash(password)
    
    conn = sqlite3.connect('chatbot.db')
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
                  (username, hashed_password, email))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'message': 'Username or email already exists'}), 400
    conn.close()
    
    return jsonify({'message': 'User created successfully'}), 201

if __name__ == '__main__':
    app.run(debug=True)
