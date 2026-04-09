// Julsona.js - Main Application Logic

// --- CHATBOT CONFIGURATION ---
const GEMINI_API_KEY = 'AIzaSyCjW6natRsJe-uTagaQHCGFllQ6xD2p5VU';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const HOTEL_CONTEXT = `
You are Terfa, the AI assistant for Julsona Hotels & Suites Ltd in Makurdi.
Your goal is to assist guests with information, booking guidance, and general inquiries.
Be polite, professional, and welcoming.

HOTEL INFORMATION:
- Name: Julsona Hotels & Suites Ltd
- Location: Makurdi, Benue State
- Check-in: 2:00 PM | Check-out: 12:00 PM (Noon)
- Power: 24/7 Uninterrupted Power Supply
- Internet: Free High-Speed WiFi
- Parking: Secure on-site parking

ROOMS & RATES:
1. Deluxe Room (₦15,000/night): AC, WiFi, Street/Garden View. (Rooms 202, 205)
2. Executive Deluxe (₦20,000/night): Spacious suite, Work desk, Premium view. (Rooms 201, 203, 204)
3. Royal Deluxe (₦25,000/night): Jacuzzi, Penthouse options, Luxury furnishings. (Rooms 206, 207, 208)

FACILITIES:
- VIP Lounge: Exclusive indoor lounge with premium drinks.
- Bush Bar: Open-air bar with grilled delicacies.
- Restaurant: Local and continental dishes.
- Laundry Service: Available.

CONTACT:
- Guests can book via the "Book Now" page (booking.html).
- For support, visit the Contact page or Front Desk.
`;



// --- AUTH MODAL FUNCTIONS ---

function openAuthModal(tab = 'login') {
    document.getElementById('authModal').style.display = 'flex';
    switchAuthTab(tab);
    // Check for password reset token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('reset');
    if (resetToken) {
        window._resetToken = resetToken;
        switchAuthTab('reset');
        document.getElementById('reset-step1').style.display = 'none';
        document.getElementById('reset-step2').style.display = 'block';
    }
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
    // Reset signup to step 1
    const step1 = document.getElementById('signup-step1-form');
    const otpStep = document.getElementById('otp-step');
    if (step1) step1.style.display = 'block';
    if (otpStep) otpStep.style.display = 'none';
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));

    if (tab === 'login') {
        document.getElementById('login-form').classList.add('active');
        const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
        if (loginTab) loginTab.classList.add('active');
    } else if (tab === 'signup') {
        document.getElementById('signup-form').classList.add('active');
        const signupTab = document.querySelector('.auth-tab[data-tab="signup"]');
        if (signupTab) signupTab.classList.add('active');
    } else if (tab === 'reset') {
        document.getElementById('reset-form').classList.add('active');
    }
}

// Toggle show/hide password
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁';
    }
}

// SIGN UP - Step 1: Send OTP
async function sendSignupOTP(resend = false) {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const pw = document.getElementById('signup-password').value;
    const cpw = document.getElementById('signup-confirm').value;

    if (!resend) {
        if (!name || !email || !pw) { showMessage('Please fill in all fields.', 'error'); return; }
        if (pw !== cpw) { showMessage('Passwords do not match!', 'error'); return; }
        if (pw.length < 6) { showMessage('Password must be at least 6 characters.', 'error'); return; }
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        if (users.find(u => u.email === email)) { showMessage('An account already exists with this email.', 'error'); return; }
    }

    const btn = document.getElementById('send-otp-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const res = await fetch('/api/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Show OTP step
        document.getElementById('signup-step1-form').style.display = 'none';
        document.getElementById('otp-step').style.display = 'block';
        document.getElementById('otp-email-display').textContent = email;
        showMessage('Verification code sent! Check your email inbox.', 'success');
    } catch (err) {
        showMessage(err.message || 'Failed to send code. Try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Verification Code';
    }
}

// SIGN UP - Step 2: Verify OTP and create account
async function verifyOTPAndCreateAccount() {
    const email = document.getElementById('signup-email').value.trim();
    const name = document.getElementById('signup-name').value.trim();
    const password = document.getElementById('signup-password').value;
    const code = document.getElementById('otp-input').value.trim();

    if (!code || code.length !== 6) { showMessage('Please enter the 6-digit code.', 'error'); return; }

    try {
        const res = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, fullName: name, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Save user to localStorage and log them in
        const user = { fullName: name, firstName: name.split(' ')[0], email, password };
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        users.push(user);
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(user));

        showMessage('Account created! Welcome, ' + user.firstName + '! 🎉', 'success');
        closeAuthModal();
        updateAuthUI();
    } catch (err) {
        showMessage(err.message || 'Verification failed. Try again.', 'error');
    }
}

function handleLogin(form) {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        showMessage('Welcome back, ' + user.firstName + '!', 'success');
        closeAuthModal();
        updateAuthUI();
    } else {
        showMessage('Invalid email or password!', 'error');
    }
}

// PASSWORD RESET - Step 1: Request email link
async function requestPasswordReset() {
    const email = document.getElementById('reset-email').value.trim();
    if (!email) { showMessage('Please enter your email.', 'error'); return; }

    try {
        const res = await fetch('/api/auth/request-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showMessage('Reset link sent! Check your email inbox.', 'success');
    } catch (err) {
        showMessage(err.message || 'Failed to send reset link.', 'error');
    }
}

// PASSWORD RESET - Step 2: Submit new password
async function submitNewPassword() {
    const pw = document.getElementById('new-password').value;
    const cpw = document.getElementById('confirm-new-password').value;
    const token = window._resetToken;

    if (!pw || pw.length < 6) { showMessage('Password must be at least 6 characters.', 'error'); return; }
    if (pw !== cpw) { showMessage('Passwords do not match!', 'error'); return; }
    if (!token) { showMessage('Invalid reset session. Please request a new link.', 'error'); return; }

    try {
        const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password: pw })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Update password in localStorage
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const idx = users.findIndex(u => u.email === data.email);
        if (idx !== -1) { users[idx].password = pw; localStorage.setItem('users', JSON.stringify(users)); }

        showMessage('Password reset successfully! You can now log in.', 'success');
        window._resetToken = null;
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        switchAuthTab('login');
        document.getElementById('reset-step1').style.display = 'block';
        document.getElementById('reset-step2').style.display = 'none';
    } catch (err) {
        showMessage(err.message || 'Reset failed. Please request a new link.', 'error');
    }
}

function checkLoginStatus() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser) { updateAuthUI(); }
    // Auto-open reset modal if URL has reset token
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset')) { openAuthModal('reset'); }
}

function updateAuthUI() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const authButtons = document.querySelector('.auth-buttons');

    if (currentUser) {
        authButtons.innerHTML = `
            <div class="user-info">
                <span class="user-name">Welcome, ${currentUser.firstName}!</span>
                <button class="logout-btn" onclick="logout()">Logout</button>
            </div>
        `;
    } else {
        authButtons.innerHTML = `
            <button class="login-btn" onclick="openAuthModal('login')">Sign In / Sign Up</button>
        `;
    }
}

function logout() {
    localStorage.removeItem('currentUser');
    updateAuthUI();
    showMessage('Logged out successfully!', 'success');
}

function showMessage(message, type) {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) existingMessage.remove();

    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    document.body.appendChild(messageElement);

    setTimeout(() => {
        messageElement.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => messageElement.remove(), 300);
    }, 4000);
}

// Initialize auth functionality after header loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait for header to load
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder) {
        if (headerPlaceholder.children.length > 0) {
            initAuth();
            initChatbot();
            highlightActiveLink();
            initStickyHeader();
            initScrollTopButton();
            initMobileMenu();
            initTheme();
            initLoader();
        } else {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        // Header loaded, initialize auth and chatbot
                        initAuth();
                        initChatbot();
                        highlightActiveLink();
                        initStickyHeader();
                        initScrollTopButton();
                        initMobileMenu();
                        initTheme();
                        initLoader();
                        observer.disconnect();
                    }
                });
            });
            observer.observe(headerPlaceholder, { childList: true });
        }
    } else {
        // Header already loaded
        initAuth();
        initChatbot();
        highlightActiveLink();
        initStickyHeader();
        initScrollTopButton();
        initMobileMenu();
        initTheme();
        initLoader();
    }
});

function initChatbot() {
    console.log('Initializing chatbot...');
    const chatToggle = document.querySelector('.chatbot-toggle');
    const chatWidget = document.getElementById('chatbot-widget');

    if (chatToggle && chatWidget) {
        console.log('Chatbot initialized successfully.');
    } else {
        console.error('Chatbot elements not found.');
    }
}

function initAuth() {
    checkLoginStatus();

    // Handle signup form
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleSignup(e.target);
        });
    }

    // Handle login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleLogin(e.target);
        });
    }

    // Handle password reset form
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handlePasswordReset(e.target);
        });
    }

    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('authModal');
        if (modal && event.target == modal) closeAuthModal();
    }
}

function highlightActiveLink() {
    const path = window.location.pathname;
    const currentPage = path.substring(path.lastIndexOf('/') + 1);
    const page = currentPage === '' ? 'index.html' : currentPage;

    const navLinks = document.querySelectorAll('.header ul a:not(.book-btn)');

    navLinks.forEach(link => {
        link.classList.remove('active');
        const linkHref = link.getAttribute('href');
        const linkPage = linkHref.substring(linkHref.lastIndexOf('/') + 1);

        let isActive = false;

        if (linkPage === page) {
            isActive = true;
        } else if (page.startsWith('rooms-') && linkPage === 'rooms.html') {
            isActive = true;
        } else if ((page === 'vip-lounge.html' || page === 'bush-bar.html') && linkPage === 'lounge&Bar.html') {
            isActive = true;
        }

        if (isActive) {
            link.classList.add('active');
        }
    });
}

function initStickyHeader() {
    const header = document.querySelector('.header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('shrink');
            } else {
                header.classList.remove('shrink');
            }
        });
    }
}

// --- CHATBOT LOGIC ---

function toggleChat() {
    const widget = document.getElementById('chatbot-widget');
    if (widget) {
        widget.classList.toggle('active');
        if (widget.classList.contains('active')) {
            const input = document.getElementById('chat-input');
            if (input) input.focus();
        }
    }
}

function handleChatInput(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    // Add user message
    addMessage(message, 'user');
    input.value = '';

    // Show typing indicator
    const typingId = addMessage('Typing...', 'bot', true);

    try {
        const response = await getBotResponse(message);
        
        // Remove typing indicator
        const typingElement = document.getElementById(typingId);
        if (typingElement) typingElement.remove();
        
        addMessage(response, 'bot');
    } catch (error) {
        console.error('Chatbot Error:', error);
        const typingElement = document.getElementById(typingId);
        if (typingElement) typingElement.remove();
        addMessage("I'm having trouble connecting right now. Please try again later.", 'bot');
    }
}

function addMessage(text, sender, isTyping = false) {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}-message`;
    msgDiv.textContent = text;
    
    if (isTyping) {
        msgDiv.id = 'typing-' + Date.now();
        msgDiv.style.fontStyle = 'italic';
        msgDiv.style.opacity = '0.7';
    }
    
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msgDiv.id;
}

// Comprehensive knowledge base organized by category
const HOTEL_KNOWLEDGE_BASE = {
    pricing: {
        keywords: ['price', 'rate', 'cost', 'charge', 'how much', 'expensive', 'afford', 'payment', 'rates', 'tariff'],
        response: 'Our rates are: Deluxe ₦15,000/night, Executive Deluxe ₦20,000/night, Royal Deluxe ₦25,000/night. Royal Deluxe Service Apartment is ₦45,000/night. All prices include complimentary WiFi and 24/7 power.'
    },
    deluxe_rooms: {
        keywords: ['deluxe room', 'deluxe ', '15000', '₦15,000', 'budget', 'basic room', 'affordable'],
        response: 'Our Deluxe rooms (₦15,000/night) are spacious, comfortable, and perfect for travelers seeking great value. Features include: air conditioning, private bathroom, comfortable bedding, complimentary WiFi, and beautiful views. Available rooms: 202 (Street View) and 205 (Garden View).'
    },
    executive_rooms: {
        keywords: ['executive deluxe', 'executive', 'suite', '20000', '₦20,000', 'business', 'premium'],
        response: 'Executive Deluxe suites (₦20,000/night) are spacious with premium bedding, luxurious bathroom, executive desk, climate control, high-speed internet, and modern amenities. Perfect for business travelers and leisure guests. Available rooms: 201 (Premium View), 203 (Executive Suite), 204 (Garden Suite).'
    },
    royal_rooms: {
        keywords: ['royal deluxe', 'royal ', '25000', '₦25,000', 'luxury', 'penthouse', '45000', '₦45,000', 'service apartment'],
        response: 'Royal Deluxe rooms (₦25,000/night) represent our pinnacle of luxury. Can be booked as Service Apartments (₦45,000/night) with full kitchen, enhanced housekeeping, and premium amenities. Features: fully equipped kitchen, refrigerator, HD TV, powerful AC, luxurious bathroom, reading table, spacious wardrobe, and elegant POP ceiling design. Rooms: 206 (Royal Suite), 207 (Penthouse), 208 (Deluxe Palace).'
    },
    booking: {
        keywords: ['book', 'booking', 'reserve', 'reservation', 'how to book', 'book now'],
        response: 'Booking is easy! Click the "Book Now" button, select your room type, enter your dates, and provide guest details. You can also call our front desk at any time. We offer flexible check-in and check-out.'
    },
    checkin_checkout: {
        keywords: ['checkin', 'check in', 'checkout', 'check out', 'time', 'arrival', 'departure'],
        response: 'Check-in is at 2:00 PM and Check-out is at 12:00 PM (Noon). Early check-in or late check-out may be available upon request. Please contact our front desk for special arrangements.'
    },
    facilities: {
        keywords: ['facilities', 'amenities', 'what do you offer', 'services', 'available'],
        response: 'Our facilities include: 24/7 High-Speed WiFi, Uninterrupted 24/7 Power Supply, Secure On-site Parking, Laundry Service, Full-Service Restaurant, VIP Lounge, Bush Bar with grilled delicacies, and Room Service.'
    },
    wifi: {
        keywords: ['wifi', 'internet', 'connection', 'wi-fi', 'online'],
        response: 'We offer complimentary high-speed WiFi throughout the hotel. WiFi access is included in all room rates.'
    },
    power: {
        keywords: ['power', 'electricity', 'backup', 'outage', 'generator'],
        response: 'We provide 24/7 uninterrupted power supply with backup generators. You\'ll never experience power interruptions at Julsona Hotels & Suites Ltd.'
    },
    parking: {
        keywords: ['parking', 'car', 'vehicle', 'garage', 'lot'],
        response: 'We offer secure on-site parking for all guests. Parking is complimentary with your room reservation.'
    },
    restaurant: {
        keywords: ['restaurant', 'food', 'meal', 'eat', 'cuisine', 'breakfast', 'lunch', 'dinner', 'dish'],
        response: 'Our restaurant serves delicious local and continental dishes. We offer flexible dining with room service available 24/7.'
    },
    lounge: {
        keywords: ['lounge', 'vip lounge', 'exclusive'],
        response: 'Our VIP Lounge is an exclusive indoor space with premium drinks and a comfortable atmosphere - perfect for relaxation and business meetings.'
    },
    bar: {
        keywords: ['bar', 'bush bar', 'drink', 'beverage', 'alcohol'],
        response: 'Our Bush Bar is an open-air venue featuring grilled delicacies and a great selection of drinks. It\'s perfect for evening relaxation and entertainment.'
    },
    location: {
        keywords: ['location', 'where', 'address', 'makurdi', 'direction', 'access', 'how to find'],
        response: 'Julsona Hotels & Suites Ltd is conveniently located in Makurdi, Benue State. We\'re easily accessible with secure parking. Our central location makes it easy to explore the city.'
    },
    contact: {
        keywords: ['contact', 'phone', 'call', 'email', 'reach', 'support', 'help', 'assistance'],
        response: 'You can reach us through our Contact page, call our front desk, or visit in person. We\'re available 24/7 to assist with your inquiries and special requests.'
    },
    policies: {
        keywords: ['policy', 'policies', 'rules', 'cancellation', 'refund', 'terms', 'condition'],
        response: 'For our cancellation policy, refund terms, and other booking conditions, please visit our Contact page or speak with our front desk staff. We want to ensure transparency and flexibility for our guests.'
    },
    laundry: {
        keywords: ['laundry', 'wash', 'cleaning', 'iron'],
        response: 'We offer professional laundry service for all guests. Our staff will ensure your clothes are cleaned and ready when you need them.'
    },
    affirmative: {
        keywords: ['yes', 'yeah', 'sure', 'ok', 'okay', 'proceed', 'go ahead', 'sounds good', 'great', 'perfect', 'let\'s'],
        response: 'Excellent! You can proceed with booking using our "Book Now" button. Our team is here to help if you need any assistance.'
    },
    greeting: {
        keywords: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'],
        response: 'Hello! Welcome to Julsona Hotels & Suites Ltd. I\'m Terfa, your AI assistant. How can I help you today? You can ask about our rooms, rates, facilities, booking process, or anything else about the hotel.'
    },
    gratitude: {
        keywords: ['thanks', 'thank you', 'appreciate', 'grateful', 'thanks so much', 'thank you so much'],
        response: 'You\'re welcome! We\'re happy to help. If you need anything else or have more questions about your stay, feel free to ask. We look forward to welcoming you to Julsona Hotels & Suites Ltd!'
    }
};

function getFallbackResponse(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
    // Check each category for keyword matches
    for (const [category, data] of Object.entries(HOTEL_KNOWLEDGE_BASE)) {
        for (const keyword of data.keywords) {
            if (message.includes(keyword.toLowerCase())) {
                return data.response;
            }
        }
    }
    
    // Default response if no match found
    return 'I\'m Terfa, your AI assistant. I can help with room information, pricing, booking, facilities, check-in/out times, and more. What can I help you with today?';
}

async function getBotResponse(userMessage) {
    const prompt = {
        contents: [
            {
                role: "user",
                parts: [
                    { text: HOTEL_CONTEXT },
                    { text: "User: " + userMessage },
                    { text: "Terfa:" }
                ]
            }
        ]
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(prompt),
            timeout: 10000
        });

        if (!response.ok) {
            console.warn(`Gemini API returned status ${response.status}. Using fallback response.`);
            return getFallbackResponse(userMessage);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
             return data.candidates[0].content.parts[0].text;
        } else {
            console.warn('No valid response from Gemini API. Using fallback response.');
            return getFallbackResponse(userMessage);
        }

    } catch (error) {
        console.error('Gemini API Error:', error);
        console.log('Using fallback response system instead.');
        return getFallbackResponse(userMessage);
    }
}

function initScrollTopButton() {
    if (document.querySelector('.scroll-top-btn')) return;
    
    const btn = document.createElement('button');
    btn.className = 'scroll-top-btn';
    btn.innerHTML = '↑';
    btn.title = 'Scroll to Top';
    document.body.appendChild(btn);

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function initMobileMenu() {
    // Add overlay if not exists
    if (!document.querySelector('.menu-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'menu-overlay';
        document.body.appendChild(overlay);
        
        const header = document.querySelector('.header');
        const ul = header ? header.querySelector('ul') : null;
        
        if (ul) {
            // Observe class changes on UL to toggle overlay
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'class') {
                        if (ul.classList.contains('active')) {
                            overlay.classList.add('active');
                            document.body.style.overflow = 'hidden';
                        } else {
                            overlay.classList.remove('active');
                            document.body.style.overflow = '';
                        }
                    }
                });
            });
            observer.observe(ul, { attributes: true });
            
            // Close on overlay click
            overlay.addEventListener('click', () => {
                const toggleBtn = document.querySelector('.menu-toggle');
                if (toggleBtn) toggleBtn.click();
                else ul.classList.remove('active');
            });
        }
    }
}

function initLoader() {
    if (document.getElementById('loading-overlay')) return;

    const loader = document.createElement('div');
    loader.id = 'loading-overlay';
    loader.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loader);

    const hideLoader = () => {
        setTimeout(() => {
            loader.classList.add('hidden');
            setTimeout(() => {
                if (loader.parentNode) loader.parentNode.removeChild(loader);
            }, 500);
        }, 500);
    };

    if (document.readyState === 'complete') {
        hideLoader();
    } else {
        window.addEventListener('load', hideLoader);
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);

    const header = document.querySelector('.header');
    if (header && !document.querySelector('.theme-toggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'theme-toggle';
        toggleBtn.innerHTML = savedTheme === 'dark' ? '☀️' : '🌙';
        toggleBtn.title = 'Toggle Dark Mode';
        
        const authButtons = header.querySelector('.auth-buttons');
        if (authButtons) {
            header.insertBefore(toggleBtn, authButtons);
        } else {
            header.appendChild(toggleBtn);
        }

        toggleBtn.addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            toggleBtn.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
        });
    }
}

// FAQ Accordion Logic
document.addEventListener('DOMContentLoaded', () => {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                // Close all other items
                faqItems.forEach(i => i.classList.remove('active'));
                
                // Toggle current item
                if (!isActive) {
                    item.classList.add('active');
                }
            });
        }
    });
});
