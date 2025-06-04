// app.js
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessages = document.getElementById('chat-messages');
    const welcomeMessage = document.getElementById('welcome-message');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const closeSidebar = document.getElementById('close-sidebar');
    const sidebarContent = document.getElementById('sidebar-content');
    const authModal = document.getElementById('auth-modal');
    const closeAuthModal = document.getElementById('close-auth-modal');
    const authTabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const examplePrompts = document.querySelectorAll('.example-prompt');
    const newChatBtn = document.getElementById('new-chat');
    const newChatMobileBtn = document.getElementById('new-chat-mobile');
    const voiceInputBtn = document.getElementById('voice-input');
    
    // State variables
    let currentConversationId = null;
    let isTyping = false;
    let recognition = null;
    
    // Initialize the app
    init();
    
    function init() {
        // Check authentication
        const token = localStorage.getItem('token');
        if (!token) {
            showAuthModal('login');
        } else {
            loadConversations();
        }
        
        // Setup event listeners
        setupEventListeners();
    }
    
    function setupEventListeners() {
        // Chat form submission
        chatForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const message = messageInput.value.trim();
            if (message && !isTyping) {
                await sendMessage(message);
                messageInput.value = '';
                adjustTextareaHeight();
            }
        });
        
        // Dynamic textarea height adjustment
        messageInput.addEventListener('input', adjustTextareaHeight);
        
        // Sidebar toggle for mobile
        sidebarToggle.addEventListener('click', function() {
            mobileSidebar.classList.remove('hidden');
            setTimeout(() => {
                sidebarContent.classList.remove('-translate-x-full');
            }, 10);
        });
        
        // Close mobile sidebar
        closeSidebar.addEventListener('click', function() {
            sidebarContent.classList.add('-translate-x-full');
            setTimeout(() => {
                mobileSidebar.classList.add('hidden');
            }, 300);
        });
        
        // Close auth modal
        closeAuthModal.addEventListener('click', function() {
            authModal.classList.add('hidden');
        });
        
        // Auth tab switching
        authTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.getAttribute('data-tab');
                showAuthModal(tabName);
            });
        });
        
        // Login form submission
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('token', data.token);
                    authModal.classList.add('hidden');
                    loadConversations();
                } else {
                    const error = await response.json();
                    alert(error.message || 'Login failed');
                }
            } catch (err) {
                console.error('Login error:', err);
                alert('An error occurred during login');
            }
        });
        
        // Register form submission
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            
            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, email, password })
                });
                
                if (response.ok) {
                    alert('Registration successful! Please login.');
                    showAuthModal('login');
                } else {
                    const error = await response.json();
                    alert(error.message || 'Registration failed');
                }
            } catch (err) {
                console.error('Registration error:', err);
                alert('An error occurred during registration');
            }
        });
        
        // Example prompts
        examplePrompts.forEach(prompt => {
            prompt.addEventListener('click', function() {
                messageInput.value = this.textContent.trim();
                messageInput.focus();
                adjustTextareaHeight();
            });
        });
        
        // New chat buttons
        newChatBtn.addEventListener('click', startNewConversation);
        newChatMobileBtn.addEventListener('click', function() {
            startNewConversation();
            sidebarContent.classList.add('-translate-x-full');
            setTimeout(() => {
                mobileSidebar.classList.add('hidden');
            }, 300);
        });
        
        // Voice input
        voiceInputBtn.addEventListener('click', toggleVoiceInput);
    }
    
    function showAuthModal(tab) {
        authModal.classList.remove('hidden');
        if (tab === 'login') {
            document.getElementById('auth-modal-title').textContent = 'Login';
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            authTabs[0].classList.add('border-blue-500', 'text-blue-600');
            authTabs[0].classList.remove('text-gray-500', 'hover:text-gray-700');
            authTabs[1].classList.remove('border-blue-500', 'text-blue-600');
            authTabs[1].classList.add('text-gray-500', 'hover:text-gray-700');
        } else {
            document.getElementById('auth-modal-title').textContent = 'Register';
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            authTabs[1].classList.add('border-blue-500', 'text-blue-600');
            authTabs[1].classList.remove('text-gray-500', 'hover:text-gray-700');
            authTabs[0].classList.remove('border-blue-500', 'text-blue-600');
            authTabs[0].classList.add('text-gray-500', 'hover:text-gray-700');
        }
    }
    
    function adjustTextareaHeight() {
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    }
    
    async function sendMessage(message) {
        // Add user message to chat
        addMessageToChat(message, true);
        
        // Show typing indicator
        showTypingIndicator();
        
        try {
            // Get JWT token from localStorage
            const token = localStorage.getItem('token');
            
            // Send message to backend
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    prompt: message,
                    conversation_id: currentConversationId
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                currentConversationId = data.conversation_id;
                
                // Remove typing indicator and add AI response
                removeTypingIndicator();
                addMessageToChat(data.response, false);
                
                // Update conversations list
                loadConversations();
            } else {
                const error = await response.json();
                removeTypingIndicator();
                addMessageToChat("Sorry, there was an error processing your request.", false);
                console.error('Chat error:', error);
                
                // Handle unauthorized error
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    showAuthModal('login');
                }
            }
        } catch (err) {
            removeTypingIndicator();
            addMessageToChat("Sorry, I'm having trouble connecting to the server.", false);
            console.error('Network error:', err);
        }
    }
    
    function addMessageToChat(message, isUser) {
        // Hide welcome message if it's the first message
        if (welcomeMessage && welcomeMessage.style.display !== 'none') {
            welcomeMessage.style.display = 'none';
        }
        
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `mb-4 message-animation ${isUser ? 'text-right' : 'text-left'}`;
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = `inline-block max-w-xs md:max-w-md lg:max-w-xl xl:max-w-2xl rounded-lg px-4 py-2 ${isUser ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`;
        
        // Process message content (support Markdown, code blocks, etc.)
        const processedMessage = processMessageContent(message);
        bubbleDiv.innerHTML = processedMessage;
        
        messageDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function processMessageContent(message) {
        // Simple Markdown processing
        let processed = message
            .replace(/```(\w*)([\s\S]*?)```/g, '<pre><code class="$1">$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_([^_]+)_/g, '<em>$1</em>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-blue-500 hover:underline">$1</a>')
            .replace(/\n/g, '<br>');
        
        return processed;
    }
    
    function showTypingIndicator() {
        isTyping = true;
        const typingDiv = document.createElement('div');
        typingDiv.className = 'mb-4 text-left message-animation';
        typingDiv.id = 'typing-indicator';
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'inline-block bg-gray-200 text-gray-800 rounded-lg px-4 py-2';
        bubbleDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        
        typingDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function removeTypingIndicator() {
        isTyping = false;
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    async function loadConversations() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/conversations', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const conversations = await response.json();
                renderConversationsList(conversations);
            } else if (response.status === 401) {
                localStorage.removeItem('token');
                showAuthModal('login');
            }
        } catch (err) {
            console.error('Error loading conversations:', err);
        }
    }
    
    function renderConversationsList(conversations) {
        const desktopList = document.getElementById('conversations-list');
        const mobileList = document.getElementById('conversations-list-mobile');
        
        // Clear existing lists
        desktopList.innerHTML = '';
        mobileList.innerHTML = '';
        
        if (conversations.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'text-gray-500 text-center p-4';
            emptyMessage.textContent = 'No conversations yet';
            desktopList.appendChild(emptyMessage.cloneNode(true));
            mobileList.appendChild(emptyMessage.cloneNode(true));
            return;
        }
        
        conversations.forEach(conv => {
            const conversationItem = document.createElement('div');
            conversationItem.className = `p-3 border-b cursor-pointer hover:bg-gray-100 ${currentConversationId === conv.id ? 'bg-blue-50' : ''}`;
            conversationItem.textContent = conv.title;
            conversationItem.addEventListener('click', () => loadConversation(conv.id));
            
            desktopList.appendChild(conversationItem.cloneNode(true));
            mobileList.appendChild(conversationItem.cloneNode(true));
        });
    }
    
    async function loadConversation(conversationId) {
        currentConversationId = conversationId;
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/conversations/${conversationId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const messages = await response.json();
                renderConversation(messages);
            }
        } catch (err) {
            console.error('Error loading conversation:', err);
        }
        
        // Close mobile sidebar if open
        if (!mobileSidebar.classList.contains('hidden')) {
            sidebarContent.classList.add('-translate-x-full');
            setTimeout(() => {
                mobileSidebar.classList.add('hidden');
            }, 300);
        }
    }
    
    function renderConversation(messages) {
        // Clear chat
        chatMessages.innerHTML = '';
        
        if (messages.length === 0) {
            welcomeMessage.style.display = 'block';
            return;
        }
        
        // Hide welcome message
        welcomeMessage.style.display = 'none';
        
        // Add messages to chat
        messages.forEach(msg => {
            addMessageToChat(msg.content, msg.is_user);
        });
    }
    
    function startNewConversation() {
        currentConversationId = null;
        chatMessages.innerHTML = '';
        welcomeMessage.style.display = 'block';
    }
    
    function toggleVoiceInput() {
        if (!('webkitSpeechRecognition' in window)) {
            alert('Speech recognition is not supported in your browser');
            return;
        }
        
        if (recognition) {
            // Stop existing recognition
            recognition.stop();
            recognition = null;
            voiceInputBtn.innerHTML = '<i class="bi bi-mic"></i>';
            return;
        }
        
        // Initialize speech recognition
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onstart = function() {
            voiceInputBtn.innerHTML = '<i class="bi bi-mic-fill text-red-500"></i>';
            messageInput.placeholder = "Listening...";
        };
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            messageInput.value = transcript;
            adjustTextareaHeight();
            messageInput.focus();
        };
        
        recognition.onerror = function(event) {
            console.error('Speech recognition error', event.error);
            voiceInputBtn.innerHTML = '<i class="bi bi-mic"></i>';
            messageInput.placeholder = "Message AI Assistant...";
        };
        
        recognition.onend = function() {
            voiceInputBtn.innerHTML = '<i class="bi bi-mic"></i>';
            messageInput.placeholder = "Message AI Assistant...";
            recognition = null;
        };
        
        recognition.start();
    }
});
