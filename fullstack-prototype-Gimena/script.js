// ======================================
// GLOBALS
// ======================================
const STORAGE_KEY = 'ipt_demo_v1';
window.db = window.db || { accounts: [] };
let currentUser = null;

// ======================================
// STORAGE
// ======================================
function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
}

function seedData() {
    window.db = {
        accounts: [
            {
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@example.com',
                password: 'Password123!',
                verified: true,
                role: 'admin'
            }
        ]
    };
    saveToStorage();
}

function loadFromStorage() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) window.db = JSON.parse(data);
    else seedData();
}

// ======================================
// AUTH STATE
// ======================================
function setAuthState(isAuth, user = null) {
    currentUser = isAuth ? user : null;

    if (isAuth) {
        document.body.classList.add('authenticated');
        document.body.classList.remove('not-authenticated');
    } else {
        document.body.classList.remove('authenticated');
        document.body.classList.add('not-authenticated');
    }
}

// ======================================
// ROUTING
// ======================================
function navigateTo(hash) {
    window.location.hash = hash;
    handleRouting();
}

function handleRouting() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    let hash = window.location.hash || '#/login';
    let pageId = null;

    if (hash === '#/login') pageId = 'loginPage';
    if (hash === '#/register') pageId = 'registerPage';
    if (hash === '#/verifyemail') pageId = 'verifyEmailPage';
    if (hash === '#/admin') pageId = 'adminPage';
    if (hash === '#/user') pageId = 'userPage';

    if (pageId) {
        document.getElementById(pageId).classList.add('active');
    }
}

// ======================================
// LOGIN
// ======================================
function login(event) {
    if (event) event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;

    const user = window.db.accounts.find(acc => acc.email === email);

    if (!user) return alert("Account not found.");
    if (!user.verified) return alert("Please verify your email first.");
    if (user.password !== password) return alert("Invalid password.");

    // Save login state (store email as token)
    localStorage.setItem("auth_token", user.email);

    // Set auth state
    setAuthState(true, user);

    // Redirect based on role
    if (user.role === 'admin') {
        window.location.href = "admin.html";
    } else {
        window.location.href = "user.html"; // normal user page
    }
}

// ======================================
// LOGOUT
// ======================================
function logout(event) {
    if (event) event.preventDefault();

    localStorage.removeItem("auth_token");
    setAuthState(false);

    // Redirect to index
    window.location.href = "index.html";
}

// ======================================
// REGISTRATION
// ======================================
function register(event) {
    if (event) event.preventDefault();

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;

    if (!firstName || !lastName || !email || !password)
        return alert("Complete all fields.");
    if (password.length < 6)
        return alert("Password must be at least 6 characters.");

    const exists = window.db.accounts.some(acc => acc.email === email);
    if (exists) return alert("Email already registered.");

    const newUser = {
        firstName,
        lastName,
        email,
        password,
        verified: false,
        role: email.includes("admin") ? "admin" : "user"
    };

    window.db.accounts.push(newUser);
    saveToStorage();

    localStorage.setItem("unverified_email", email);

    alert("Account created! Please verify your email.");
    window.location.href = "verifyemail.html";
}

// ======================================
// EMAIL VERIFICATION
// ======================================
function simulateVerify() {
    const email = localStorage.getItem('unverified_email');
    if (!email) return alert("No pending verification.");

    const account = window.db.accounts.find(a => a.email === email);
    if (!account) return alert("User not found.");

    account.verified = true;
    saveToStorage();
    localStorage.removeItem('unverified_email');

    alert("Email Verified! You can now log in.");
}

// ======================================
// INIT
// ======================================
window.addEventListener('load', () => {
    loadFromStorage();

    // ---------- AUTO-LOGIN ----------
    const token = localStorage.getItem('auth_token');
    if (token) {
        const acc = window.db.accounts.find(a => a.email === token);
        if (acc) {
            setAuthState(true, acc);
            if (acc.role === 'admin') navigateTo('#/admin');
            else navigateTo('#/user');
        }
    }

    // Attach buttons
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', login);

    const logoutBtns = document.querySelectorAll(".logout");
    logoutBtns.forEach(btn => btn.addEventListener('click', logout));

    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) registerBtn.addEventListener('click', register);

    const simulateVerifyBtn = document.getElementById('simulateVerifyBtn');
    if (simulateVerifyBtn) simulateVerifyBtn.addEventListener('click', simulateVerify);

    // ---------- AUTH PROTECTION ----------
    const isLoggedIn = localStorage.getItem("auth_token");
    const protectedPages = ["admin.html", "employees.html", "accounts.html", "departments.html", "requests.html"];
    const currentPage = window.location.pathname.split("/").pop();

    if (protectedPages.includes(currentPage) && !isLoggedIn) {
        window.location.href = "index.html";
    }

    // Default route
    if (!window.location.hash) navigateTo('#/login');

    handleRouting();
});

window.addEventListener('hashchange', handleRouting);
