// Local Storage Keys
const USERS_KEY = 'investpro_users';
const CURRENT_USER_KEY = 'investpro_current_user';
const TRANSACTIONS_KEY = 'investpro_transactions';
const REFERRALS_KEY = 'investpro_referrals';

// Initialize local storage data
function initializeLocalStorage() {
    if (!localStorage.getItem(USERS_KEY)) {
        localStorage.setItem(USERS_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(TRANSACTIONS_KEY)) {
        localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(REFERRALS_KEY)) {
        localStorage.setItem(REFERRALS_KEY, JSON.stringify([]));
    }
    
    // Ensure we have valid data in localStorage
    try {
        JSON.parse(localStorage.getItem(USERS_KEY));
        JSON.parse(localStorage.getItem(TRANSACTIONS_KEY));
        JSON.parse(localStorage.getItem(REFERRALS_KEY));
    } catch (e) {
        // Reset corrupted data
        localStorage.setItem(USERS_KEY, JSON.stringify([]));
        localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([]));
        localStorage.setItem(REFERRALS_KEY, JSON.stringify([]));
    }
}

// User Authentication Functions
function registerUser(name, email, password, referralCode = null) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    
    // Check if user already exists
    if (users.find(user => user.email === email)) {
        return { success: false, message: 'Email already registered' };
    }
    
    // Create new user
    const newUser = {
        id: Date.now().toString(),
        name,
        email,
        password, // In a real app, this should be hashed
        balance: 0,
        referralCode: generateReferralCode(name),
        referredBy: referralCode || null,
        referralEarnings: 0,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    
    // If user was referred, record the referral
    if (referralCode) {
        recordReferral(referralCode, newUser.id);
    }
    
    return { success: true, message: 'Registration successful' };
}

// Generate a unique referral code for a user
function generateReferralCode(name) {
    // Create a code based on name and random string
    const namePart = name.replace(/\s+/g, '').substring(0, 5).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${namePart}${randomPart}`;
}

// Record a new referral
function recordReferral(referrerCode, referredUserId) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    const referrals = JSON.parse(localStorage.getItem(REFERRALS_KEY));
    
    // Find the referrer user
    const referrer = users.find(user => user.referralCode === referrerCode);
    if (!referrer) return false;
    
    // Create a new referral record
    const newReferral = {
        id: Date.now().toString(),
        referrerId: referrer.id,
        referredUserId: referredUserId,
        commissionRate: 0.15, // 15% commission
        earnings: 0, // Will be updated when referred user makes deposits
        createdAt: new Date().toISOString()
    };
    
    referrals.push(newReferral);
    localStorage.setItem(REFERRALS_KEY, JSON.stringify(referrals));
    
    return true;
}

function loginUser(email, password) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    const user = users.find(user => user.email === email && user.password === password);
    
    if (user) {
        // Store current user without password
        const { password, ...userWithoutPassword } = user;
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));
        return { success: true, message: 'Login successful' };
    } else {
        return { success: false, message: 'Invalid email or password' };
    }
}

function logoutUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
    // Update UI before redirecting
    updateAuthUI();
    // Redirect to home page
    window.location.href = 'index.html';
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
}

function isLoggedIn() {
    const currentUser = localStorage.getItem(CURRENT_USER_KEY);
    if (!currentUser) return false;
    
    try {
        // Verify we have a valid user object
        const userObj = JSON.parse(currentUser);
        return userObj && userObj.id && userObj.email;
    } catch (e) {
        // If there's an error parsing the JSON, clear the invalid data
        localStorage.removeItem(CURRENT_USER_KEY);
        return false;
    }
}

// Transaction Functions
function createTransaction(type, amount, plan = null, paymentMethod = null, transactionId = null) {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: false, message: 'User not logged in' };
    
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY));
    
    // Create transaction object
    const transaction = {
        id: Date.now().toString(),
        userId: currentUser.id,
        type, // 'deposit' or 'withdraw'
        amount: parseFloat(amount),
        plan,
        paymentMethod,
        // Make transactionId optional
        transactionId: transactionId || 'Screenshot provided',
        status: type === 'deposit' ? 'pending' : 'processing', // Deposits start as pending, withdrawals as processing
        createdAt: new Date().toISOString()
    };
    
    // Add transaction to storage
    transactions.push(transaction);
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
    
    // For demo purposes, automatically approve deposits after 2 seconds
    if (type === 'deposit') {
        setTimeout(() => {
            approveDeposit(transaction.id);
        }, 2000);
    }
    
    return { success: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} submitted successfully` };
}

function approveDeposit(transactionId) {
    const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY));
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    const referrals = JSON.parse(localStorage.getItem(REFERRALS_KEY));
    
    const transactionIndex = transactions.findIndex(t => t.id === transactionId);
    if (transactionIndex === -1) return;
    
    const transaction = transactions[transactionIndex];
    transaction.status = 'completed';
    
    // Update user balance
    const userIndex = users.findIndex(u => u.id === transaction.userId);
    if (userIndex !== -1) {
        users[userIndex].balance += transaction.amount;
        
        // If current user is the one making the deposit, update current user in storage
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.id === transaction.userId) {
            currentUser.balance = users[userIndex].balance;
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
        }
        
        // Process referral commission if this user was referred
        processReferralCommission(users[userIndex], transaction.amount);
    }
    
    // Save changes
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    
    // Refresh page if on history page
    if (window.location.pathname.includes('history.html')) {
        loadTransactionHistory();
    }
}

// Process referral commission when a referred user makes a deposit
function processReferralCommission(user, depositAmount) {
    if (!user.referredBy) return; // User wasn't referred
    
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    const referrals = JSON.parse(localStorage.getItem(REFERRALS_KEY));
    
    // Find the referrer
    const referrer = users.find(u => u.referralCode === user.referredBy);
    if (!referrer) return;
    
    // Find the referral record
    const referralIndex = referrals.findIndex(r => 
        r.referrerId === referrer.id && r.referredUserId === user.id);
    
    if (referralIndex === -1) return;
    
    // Calculate commission (15% of deposit)
    const commission = depositAmount * 0.15;
    
    // Update referral record
    referrals[referralIndex].earnings += commission;
    
    // Update referrer's earnings and balance
    const referrerIndex = users.findIndex(u => u.id === referrer.id);
    if (referrerIndex !== -1) {
        users[referrerIndex].referralEarnings = (users[referrerIndex].referralEarnings || 0) + commission;
        users[referrerIndex].balance += commission;
        
        // If the referrer is the current user, update current user in storage
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.id === referrer.id) {
            currentUser.referralEarnings = users[referrerIndex].referralEarnings;
            currentUser.balance = users[referrerIndex].balance;
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
        }
    }
    
    // Save changes
    localStorage.setItem(REFERRALS_KEY, JSON.stringify(referrals));
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function processWithdrawal(transactionId) {
    const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY));
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    
    const transactionIndex = transactions.findIndex(t => t.id === transactionId);
    if (transactionIndex === -1) return;
    
    const transaction = transactions[transactionIndex];
    transaction.status = 'completed';
    
    // Update user balance (already deducted when withdrawal was created)
    
    // Save changes
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
    
    // Refresh page if on history page
    if (window.location.pathname.includes('history.html')) {
        loadTransactionHistory();
    }
}

function getUserTransactions() {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];
    
    const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY));
    return transactions.filter(t => t.userId === currentUser.id);
}

// Investment Plans
const investmentPlans = [
    { id: 1, name: 'Plan 1', amount: 10, returnRate: 0.05 },
    { id: 2, name: 'Plan 2', amount: 15, returnRate: 0.06 },
    { id: 3, name: 'Plan 3', amount: 20, returnRate: 0.07 },
    { id: 4, name: 'Plan 4', amount: 30, returnRate: 0.08 },
    { id: 5, name: 'Plan 5', amount: 50, returnRate: 0.09 },
    { id: 6, name: 'Plan 6', amount: 100, returnRate: 0.10 },
    { id: 7, name: 'Plan 7', amount: 200, returnRate: 0.12 },
    { id: 8, name: 'Plan 8', amount: 500, returnRate: 0.15 },
    { id: 9, name: 'Plan 9', amount: 1000, returnRate: 0.18 },
    { id: 10, name: 'Plan 10', amount: 5000, returnRate: 0.25 }
];

// UI Update Functions
function updateAuthUI() {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Get all protected navigation items
    const depositLink = document.querySelector('a[href="deposit.html"]');
    const withdrawLink = document.querySelector('a[href="withdraw.html"]');
    const historyLink = document.querySelector('a[href="history.html"]');
    const referLink = document.querySelector('a[href="refer.html"]');
    
    if (isLoggedIn()) {
        // Hide login/signup buttons and show logout
        if (loginBtn) {
            const loginLi = loginBtn.parentElement;
            if (loginLi) loginLi.style.display = 'none';
        }
        if (signupBtn) {
            const signupLi = signupBtn.parentElement;
            if (signupLi) signupLi.style.display = 'none';
        }
        if (logoutBtn) {
            const logoutLi = logoutBtn.parentElement;
            if (logoutLi) logoutLi.style.display = 'inline-block';
        }
        
        // Show protected navigation items
        if (depositLink) {
            const depositLi = depositLink.parentElement;
            if (depositLi) depositLi.style.display = 'inline-block';
        }
        if (withdrawLink) {
            const withdrawLi = withdrawLink.parentElement;
            if (withdrawLi) withdrawLi.style.display = 'inline-block';
        }
        if (historyLink) {
            const historyLi = historyLink.parentElement;
            if (historyLi) historyLi.style.display = 'inline-block';
        }
        if (referLink) {
            const referLi = referLink.parentElement;
            if (referLi) referLi.style.display = 'inline-block';
        }
        
        // Update any user-specific elements
        const currentUser = getCurrentUser();
        if (currentUser) {
            // Update balance displays if they exist
            const balanceDisplays = document.querySelectorAll('.value#currentBalance');
            balanceDisplays.forEach(display => {
                if (display) {
                    display.textContent = `$${currentUser.balance.toFixed(2)}`;
                }
            });
        }
    } else {
        // Show login/signup buttons and hide logout
        if (loginBtn) {
            const loginLi = loginBtn.parentElement;
            if (loginLi) loginLi.style.display = 'inline-block';
        }
        if (signupBtn) {
            const signupLi = signupBtn.parentElement;
            if (signupLi) signupLi.style.display = 'inline-block';
        }
        if (logoutBtn) {
            const logoutLi = logoutBtn.parentElement;
            if (logoutLi) logoutLi.style.display = 'none';
        }
        
        // Hide protected navigation items
        if (depositLink) {
            const depositLi = depositLink.parentElement;
            if (depositLi) depositLi.style.display = 'none';
        }
        if (withdrawLink) {
            const withdrawLi = withdrawLink.parentElement;
            if (withdrawLi) withdrawLi.style.display = 'none';
        }
        if (historyLink) {
            const historyLi = historyLink.parentElement;
            if (historyLi) historyLi.style.display = 'none';
        }
        if (referLink) {
            const referLi = referLink.parentElement;
            if (referLi) referLi.style.display = 'none';
        }
    }
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    // Insert at the top of the main content
    const main = document.querySelector('main');
    if (main) {
        main.insertBefore(alertDiv, main.firstChild);
        
        // Remove after 5 seconds
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
}

// Page-specific functions
function setupHomePage() {
    // Initialize local storage first
    initializeLocalStorage();
    
    // Update auth UI
    updateAuthUI();
    
    const investButtons = document.querySelectorAll('.invest-btn');
    investButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (!isLoggedIn()) {
                window.location.href = 'login.html';
                return;
            }
            
            const planId = button.getAttribute('data-plan');
            const amount = button.getAttribute('data-amount');
            window.location.href = `deposit.html?plan=${planId}&amount=${amount}`;
        });
    });
}

function setupDepositPage() {
    // Check if user is logged in
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    
    // Get plan from URL if available
    const urlParams = new URLSearchParams(window.location.search);
    const planId = urlParams.get('plan');
    const amount = urlParams.get('amount');
    
    if (planId && amount) {
        const planSelect = document.getElementById('plan');
        if (planSelect) {
            planSelect.value = planId;
        }
        
        const amountInput = document.getElementById('amount');
        if (amountInput) {
            amountInput.value = amount;
            amountInput.disabled = true; // Lock the amount if coming from a plan
        }
    }
    
    // Handle deposit form submission
    const depositForm = document.getElementById('depositForm');
    if (depositForm) {
        depositForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const planId = document.getElementById('plan').value;
            const amount = document.getElementById('amount').value;
            const paymentMethod = document.getElementById('paymentMethod').value;
            const screenshot = document.getElementById('screenshot');
            
            if (!amount || !paymentMethod || !screenshot.files.length) {
                showAlert('Please fill all fields and upload a payment screenshot', 'danger');
                return;
            }
            
            const result = createTransaction('deposit', amount, planId, paymentMethod);
            
            if (result.success) {
                showAlert(result.message, 'success');
                depositForm.reset();
                
                // Redirect to history page after 2 seconds
                setTimeout(() => {
                    window.location.href = 'history.html';
                }, 2000);
            } else {
                showAlert(result.message, 'danger');
            }
        });
    }
}

function setupWithdrawPage() {
    // Check if user is logged in
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    
    const currentUser = getCurrentUser();
    const balanceDisplay = document.getElementById('currentBalance');
    if (balanceDisplay) {
        balanceDisplay.textContent = `$${currentUser.balance.toFixed(2)}`;
    }
    
    // Handle withdraw form submission
    const withdrawForm = document.getElementById('withdrawForm');
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const amount = parseFloat(document.getElementById('amount').value);
            const withdrawalMethod = document.getElementById('withdrawalMethod').value;
            const withdrawalAddress = document.getElementById('withdrawalAddress').value;
            
            if (!amount || !withdrawalMethod || !withdrawalAddress) {
                showAlert('Please fill all fields', 'danger');
                return;
            }
            
            // Check minimum withdrawal amount
            if (amount < 20) {
                showAlert('Minimum withdrawal amount is $20', 'danger');
                return;
            }
            
            // Check if user has enough balance
            if (amount > currentUser.balance) {
                showAlert('Insufficient balance', 'danger');
                return;
            }
            
            // Update user balance immediately
            const users = JSON.parse(localStorage.getItem(USERS_KEY));
            const userIndex = users.findIndex(u => u.id === currentUser.id);
            
            if (userIndex !== -1) {
                users[userIndex].balance -= amount;
                currentUser.balance -= amount;
                
                localStorage.setItem(USERS_KEY, JSON.stringify(users));
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
            }
            
            // Create withdrawal transaction
            const result = createTransaction('withdraw', amount, null, withdrawalMethod, withdrawalAddress);
            
            if (result.success) {
                showAlert(result.message, 'success');
                withdrawForm.reset();
                
                // Update balance display
                balanceDisplay.textContent = `$${currentUser.balance.toFixed(2)}`;
                
                // Redirect to history page after 2 seconds
                setTimeout(() => {
                    window.location.href = 'history.html';
                }, 2000);
            } else {
                showAlert(result.message, 'danger');
            }
        });
    }
}

function loadTransactionHistory() {
    // Initialize local storage first
    initializeLocalStorage();
    
    // Check if user is logged in
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    
    const transactions = getUserTransactions();
    const tableBody = document.getElementById('transactionTableBody');
    
    if (tableBody) {
        tableBody.innerHTML = '';
        
        if (transactions.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="6" style="text-align: center;">No transactions found</td>';
            tableBody.appendChild(row);
            return;
        }
        
        // Sort transactions by date (newest first)
        transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        transactions.forEach(transaction => {
            const row = document.createElement('tr');
            
            const date = new Date(transaction.createdAt).toLocaleDateString();
            const time = new Date(transaction.createdAt).toLocaleTimeString();
            
            let statusClass = '';
            if (transaction.status === 'completed') statusClass = 'text-success';
            if (transaction.status === 'pending') statusClass = 'text-warning';
            if (transaction.status === 'processing') statusClass = 'text-info';
            if (transaction.status === 'rejected') statusClass = 'text-danger';
            
            row.innerHTML = `
                <td>${date} ${time}</td>
                <td>${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}</td>
                <td>$${transaction.amount.toFixed(2)}</td>
                <td>${transaction.paymentMethod || '-'}</td>
                <td>${transaction.transactionId || '-'}</td>
                <td class="${statusClass}">${transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
}

function setupLoginPage() {
    // Initialize local storage
    initializeLocalStorage();
    
    // Redirect if already logged in
    if (isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                showAlert('Please fill all fields', 'danger');
                return;
            }
            
            const result = loginUser(email, password);
            
            if (result.success) {
                // Update UI before redirecting
                updateAuthUI();
                // Redirect to home page immediately
                window.location.href = 'index.html';
            } else {
                showAlert(result.message, 'danger');
            }
        });
    }
}

function setupSignupPage() {
    // Initialize local storage
    initializeLocalStorage();
    
    // Redirect if already logged in
    if (isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }
    
    // Check for referral code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    
    // If referral code exists, fill the referral code field
    if (referralCode) {
        const referralCodeInput = document.getElementById('referralCode');
        if (referralCodeInput) {
            referralCodeInput.value = referralCode;
        }
    }
    
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const referralCode = document.getElementById('referralCode').value;
            
            if (!name || !email || !password || !confirmPassword) {
                showAlert('Please fill all fields', 'danger');
                return;
            }
            
            if (password !== confirmPassword) {
                showAlert('Passwords do not match', 'danger');
                return;
            }
            
            const result = registerUser(name, email, password, referralCode);
            
            if (result.success) {
                // Automatically log in the user
                const loginResult = loginUser(email, password);
                if (loginResult.success) {
                    // Update UI before redirecting
                    updateAuthUI();
                    window.location.href = 'index.html';
                }
            } else {
                showAlert(result.message, 'danger');
            }
        });
    }
}

function setupReferPage() {
    // Check if user is logged in
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    
    const currentUser = getCurrentUser();
    
    // Update referral link with user's referral code
    const referralLinkEl = document.getElementById('referralLink');
    if (referralLinkEl && currentUser) {
        referralLinkEl.textContent = `https://invest.com/ref=${currentUser.referralCode}`;
    }
    
    // Get referral statistics
    const referrals = JSON.parse(localStorage.getItem(REFERRALS_KEY)) || [];
    const userReferrals = referrals.filter(r => r.referrerId === currentUser.id);
    
    // Update referral stats
    const totalReferralsEl = document.getElementById('totalReferrals');
    if (totalReferralsEl) {
        totalReferralsEl.textContent = userReferrals.length;
    }
    
    const totalEarningsEl = document.getElementById('totalEarnings');
    if (totalEarningsEl) {
        const earnings = userReferrals.reduce((total, ref) => total + (ref.earnings || 0), 0);
        totalEarningsEl.textContent = `$${earnings.toFixed(2)}`;
    }
    
    // Setup copy button functionality
    const copyBtn = document.getElementById('copyReferralBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const link = document.getElementById('referralLink');
            const range = document.createRange();
            range.selectNode(link);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
            window.getSelection().removeAllRanges();
            showAlert('Referral link copied to clipboard!', 'success');
        });
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize local storage
    initializeLocalStorage();
    
    // Update auth UI based on login status
    updateAuthUI();
    
    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutUser();
        });
    }
    
    // Get current page filename
    const path = window.location.pathname;
    const page = path.split('/').pop();
    
    // Setup page-specific functionality based on the current page
    if (page === '' || page === 'index.html' || path.endsWith('/')) {
        setupHomePage();
    } else if (page === 'deposit.html') {
        setupDepositPage();
    } else if (page === 'withdraw.html') {
        setupWithdrawPage();
    } else if (page === 'history.html') {
        loadTransactionHistory();
    } else if (page === 'login.html') {
        setupLoginPage();
    } else if (page === 'signup.html') {
        setupSignupPage();
    } else if (page === 'refer.html') {
        setupReferPage();
    }
});