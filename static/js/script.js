document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessages = document.getElementById('chat-messages');
    const welcomeMessage = document.getElementById('welcome-message');
    const examplePrompts = document.querySelectorAll('.prompt-card');
    const newChatBtn = document.getElementById('new-chat');
    const mobileSidebarBtn = document.getElementById('mobile-sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const chatHistoryList = document.getElementById('chat-history-list');
    
    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    // Add message to chat
    function addMessage(content, isUser) {
        if (welcomeMessage && welcomeMessage.style.display !== 'none') {
            welcomeMessage.style.display = 'none';
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'message-user' : 'message-assistant'}`;
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        
        // Process message content (simple Markdown support)
        const processedContent = content
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
        
        bubbleDiv.innerHTML = processedContent;
        messageDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Show typing indicator
    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message message-assistant';
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble typing-indicator';
        bubbleDiv.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;
        
        typingDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return typingDiv;
    }
    
    // Example prompt handler
    examplePrompts.forEach(prompt => {
        prompt.addEventListener('click', function() {
            const text = this.textContent.trim().replace(/^"|"$/g, '');
            messageInput.value = text;
            messageInput.focus();
            messageInput.dispatchEvent(new Event('input'));
        });
    });
    
    // New chat handler
    newChatBtn.addEventListener('click', function() {
        chatMessages.innerHTML = '';
        if (welcomeMessage) {
            welcomeMessage.style.display = 'block';
        }
    });
    
    // Mobile sidebar toggle
    mobileSidebarBtn.addEventListener('click', function() {
        sidebar.classList.toggle('active');
    });
    
    // Form submission
    chatForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const message = messageInput.value.trim();
        
        if (message) {
            addMessage(message, true);
            messageInput.value = '';
            messageInput.style.height = 'auto';
            
            // Show typing indicator
            const typingIndicator = showTypingIndicator();
            
            try {
                // Send message to backend
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer YOUR_JWT_TOKEN' // Replace with actual token
                    },
                    body: JSON.stringify({ 
                        prompt: message,
                        conversation_id: null 
                    })
                });
                
                const data = await response.json();
                
                // Remove typing indicator
                typingIndicator.remove();
                
                // Add response message
                addMessage(data.response, false);
                
                // Update chat history
                updateChatHistory(data.conversation_id, message);
                
            } catch (error) {
                console.error('Error:', error);
                typingIndicator.remove();
                addMessage("Sorry, I'm having trouble connecting to the server.", false);
            }
        }
    });
    
    // Update chat history list
    function updateChatHistory(conversationId, message) {
        const chatItem = document.createElement('button');
        chatItem.className = 'history-item';
        chatItem.textContent = message.length > 30 ? message.substring(0, 30) + '...' : message;
        
        chatItem.addEventListener('click', () => {
            // Load conversation from history
            // You would implement this to fetch past messages
        });
        
        chatHistoryList.prepend(chatItem);
    }
    
    // Initialize with sample chat history
    function initSampleHistory() {
        const samples = [
            "Explain quantum computing",
            "Python Fibonacci function",
            "Weekend getaway ideas"
        ];
        
        samples.forEach(sample => {
            const chatItem = document.createElement('button');
            chatItem.className = 'history-item';
            chatItem.textContent = sample;
            chatHistoryList.appendChild(chatItem);
        });
    }
    
    initSampleHistory();
});
