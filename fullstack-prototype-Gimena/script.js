const STORAGE_KEY = 'ipt_demo_v1';
let currentUser = null;
let editingAccountId = null;
let editingEmployeeId = null;

// Main in-memory data object used by the app.
window.db = window.db || {
    accounts: [],
    departments: [],
    employees: [],
    requests: []
};

// Small helper to create uniqueish ID for new records.
function createId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Creates/returns the top-right toast container.
function getToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '2000';
        document.body.appendChild(container);
    }
    return container;
}

// Generic toast helper used instead of alert().
function showToast(message, type = 'info') {
    const typeMap = {
        success: 'text-bg-success',
        danger: 'text-bg-danger',
        warning: 'text-bg-warning',
        info: 'text-bg-primary'
    };

    const toast = document.createElement('div');
    toast.className = `toast align-items-center border-0 ${typeMap[type] || typeMap.info}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');

    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    const container = getToastContainer();
    container.appendChild(toast);

    if (window.bootstrap && window.bootstrap.Toast) {
        const instance = new window.bootstrap.Toast(toast, { delay: 2500 });
        instance.show();
        toast.addEventListener('hidden.bs.toast', () => toast.remove());
    } else {
        setTimeout(() => toast.remove(), 2500);
    }
}

// Clears validation error styles for a given form.
function clearFormValidation(form) {
    if (!form) return;
    form.querySelectorAll('.is-invalid').forEach((el) => {
        el.classList.remove('is-invalid');
        el.setCustomValidity('');
    });
}

// Marks one field invalid and shows browser validation message.
function markInvalidField(field, message) {
    if (!field) return;
    field.classList.add('is-invalid');
    field.setCustomValidity(message);
    field.reportValidity();
}

// Saves the full DB object to localStorage.
function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
}

// Default seed data when localStorage is empty/corrupt.
function seedData() {
    window.db = {
        accounts: [
            {
                id: 'acc_admin',
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@example.com',
                password: 'Password123!',
                verified: true,
                role: 'admin'
            }
        ],
        departments: [
            { id: 'dept_eng', name: 'Engineering', description: 'Software team' },
            { id: 'dept_hr', name: 'HR', description: 'Human Resources' }
        ],
        employees: [],
        requests: []
    };
    saveToStorage();
}

// Ensures all expected arrays exist even if old data shape is loaded.
function normalizeDb() {
    window.db.accounts = Array.isArray(window.db.accounts) ? window.db.accounts : [];
    window.db.departments = Array.isArray(window.db.departments) ? window.db.departments : [];
    window.db.employees = Array.isArray(window.db.employees) ? window.db.employees : [];
    window.db.requests = Array.isArray(window.db.requests) ? window.db.requests : [];
}

// Loads DB from localStorage and falls back to seed data if needed.
function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            seedData();
            return;
        }

        window.db = JSON.parse(raw);
        normalizeDb();

        if (!window.db.accounts.length || !window.db.departments.length) {
            seedData();
        }
    } catch (err) {
        seedData();
    }
}

// Central auth state updater:
// - updates currentUser
// - toggles body classes for role/visibility.
function setAuthState(isAuth, user = null) {
    currentUser = isAuth ? user : null;

    document.body.classList.toggle('authenticated', isAuth);
    document.body.classList.toggle('not-authenticated', !isAuth);
    document.body.classList.toggle('is-admin', Boolean(currentUser && currentUser.role === 'admin'));
}

// Hash navigation helper (single-page app navigation).
function navigateTo(hash) {
    window.location.hash = hash;
}

// Router map with per-route metadata and optional render callback.
const router = {
    routes: {
        '#/': { pageId: 'homePage' },
        '#/login': { pageId: 'loginPage', guestOnly: true },
        '#/register': { pageId: 'registerPage', guestOnly: true },
        '#/verify-email': { pageId: 'verifyEmailPage', guestOnly: true, render: renderVerifyMessage },
        '#/profile': { pageId: 'profilePage', authRequired: true, render: renderProfile },
        '#/accounts': { pageId: 'accountsPage', authRequired: true, adminOnly: true, render: renderAccountsList },
        '#/departments': { pageId: 'departmentsPage', authRequired: true, adminOnly: true, render: renderDepartmentsList },
        '#/employees': {
            pageId: 'employeesPage',
            authRequired: true,
            adminOnly: true,
            render: () => {
                renderEmployeeDeptOptions();
                renderEmployeesTable();
            }
        },
        '#/requests': {
            pageId: 'requestsPage',
            authRequired: true,
            render: () => {
                renderRequestsTable();
                closeRequestModal();
            }
        }
    },
    resolveRoute(requestedHash) {
        const normalized = requestedHash || '#/';
        const route = this.routes[normalized];
        if (!route) return '#/';
        if (route.authRequired && !currentUser) return '#/login';
        if (route.guestOnly && currentUser) return '#/profile';
        if (route.adminOnly && (!currentUser || currentUser.role !== 'admin')) return '#/profile';
        return normalized;
    }
};

// Shows only one page section at a time.
function renderActivePage(pageId) {
    document.querySelectorAll('.page').forEach((page) => {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active');
        page.style.display = 'block';
    }
}

// Main route handler:
// - resolve valid route
// - apply access guards
// - render correct page and page-specific data.
function handleRouting() {
    const resolvedHash = router.resolveRoute(window.location.hash);
    if (resolvedHash !== (window.location.hash || '#/')) {
        navigateTo(resolvedHash);
        return;
    }

    const route = router.routes[resolvedHash] || router.routes['#/'];
    renderActivePage(route.pageId);
    if (typeof route.render === 'function') route.render();
}

// Registration flow:
// validates inputs, checks duplicate email, saves unverified account.
function register(event) {
    event.preventDefault();
    const form = document.getElementById('registerForm');
    clearFormValidation(form);

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;

    if (!firstName || !lastName || !email || !password) {
        showToast('Complete all registration fields.', 'warning');
        if (!firstName) markInvalidField(document.getElementById('firstName'), 'First name is required.');
        if (!lastName) markInvalidField(document.getElementById('lastName'), 'Last name is required.');
        if (!email) markInvalidField(document.getElementById('regEmail'), 'Email is required.');
        if (!password) markInvalidField(document.getElementById('regPassword'), 'Password is required.');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters.', 'warning');
        markInvalidField(document.getElementById('regPassword'), 'Use at least 6 characters.');
        return;
    }

    const exists = window.db.accounts.some((acc) => acc.email === email);
    if (exists) {
        showToast('Email already registered.', 'danger');
        markInvalidField(document.getElementById('regEmail'), 'This email is already registered.');
        return;
    }

    window.db.accounts.push({
        id: createId('acc'),
        firstName,
        lastName,
        email,
        password,
        verified: false,
        role: 'user'
    });

    localStorage.setItem('unverified_email', email);
    saveToStorage();
    showToast('Registration complete. Please verify your email.', 'success');
    navigateTo('#/verify-email');
}

// Updates verify page message with pending email from localStorage.
function renderVerifyMessage() {
    const pendingEmail = localStorage.getItem('unverified_email');
    const messageEl = document.getElementById('verifyEmailMessage');
    messageEl.textContent = pendingEmail
        ? `Verification sent to ${pendingEmail}`
        : 'No pending verification email found.';
}

// Simulated email verification for demo purposes.
function simulateVerify() {
    const email = (localStorage.getItem('unverified_email') || '').toLowerCase();
    if (!email) {
        showToast('No pending verification.', 'warning');
        return;
    }

    const account = window.db.accounts.find((a) => a.email === email);
    if (!account) {
        showToast('User not found.', 'danger');
        return;
    }

    account.verified = true;
    saveToStorage();
    localStorage.removeItem('unverified_email');
    showToast('Email verified. You can now login.', 'success');
    navigateTo('#/login');
}

// Login flow (requires verified account).
function login(event) {
    event.preventDefault();
    const form = document.getElementById('loginForm');
    clearFormValidation(form);

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    const user = window.db.accounts.find(
        (acc) => acc.email === email && acc.password === password && acc.verified === true
    );

    if (!user) {
        showToast('Invalid credentials or account not verified.', 'danger');
        markInvalidField(document.getElementById('loginEmail'), 'Check your email and verification status.');
        markInvalidField(document.getElementById('loginPassword'), 'Check your password.');
        return;
    }

    localStorage.setItem('auth_token', user.email);
    setAuthState(true, user);
    showToast(`Welcome ${user.firstName}.`, 'success');
    navigateTo('#/profile');
}

// Logout flow.
function logout(event) {
    if (event) event.preventDefault();
    localStorage.removeItem('auth_token');
    setAuthState(false, null);
    showToast('Logged out successfully.', 'info');
    navigateTo('#/');
}

// Renders currently logged-in user profile data.
function renderProfile() {
    if (!currentUser) return;

    document.getElementById('profileName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('profileRole').textContent = currentUser.role;
}

// Opens account form and pre-fills if editing.
function showAccountForm(account = null) {
    const card = document.getElementById('accountFormCard');
    card.classList.remove('hidden');

    editingAccountId = account ? account.id : null;
    document.getElementById('accountRecordId').value = editingAccountId || '';
    document.getElementById('accFirstName').value = account ? account.firstName : '';
    document.getElementById('accLastName').value = account ? account.lastName : '';
    document.getElementById('accEmail').value = account ? account.email : '';
    document.getElementById('accPassword').value = account ? account.password : '';
    document.getElementById('accRole').value = account ? account.role : 'user';
    document.getElementById('accVerified').checked = Boolean(account && account.verified);
}

// Hides/resets account form.
function hideAccountForm() {
    document.getElementById('accountFormCard').classList.add('hidden');
    document.getElementById('accountForm').reset();
    editingAccountId = null;
}

// Renders accounts table from window.db.accounts.
function renderAccountsList() {
    const body = document.getElementById('accountsTableBody');
    if (!body) return;

    if (!window.db.accounts.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No accounts.</td></tr>';
        return;
    }

    body.innerHTML = window.db.accounts
        .map((acc) => {
            const verifiedDisplay = acc.verified ? 'yes' : '-';
            return `
                <tr>
                    <td>${acc.firstName} ${acc.lastName}</td>
                    <td>${acc.email}</td>
                    <td>${acc.role}</td>
                    <td>${verifiedDisplay}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" data-account-action="edit" data-account-id="${acc.id}">Edit</button>
                        <button class="btn btn-sm btn-outline-warning" data-account-action="reset" data-account-id="${acc.id}">Reset PW</button>
                        <button class="btn btn-sm btn-outline-danger" data-account-action="delete" data-account-id="${acc.id}">Delete</button>
                    </td>
                </tr>
            `;
        })
        .join('');
}

// Handles add/edit account form submit.
function handleAccountSubmit(event) {
    event.preventDefault();

    const firstName = document.getElementById('accFirstName').value.trim();
    const lastName = document.getElementById('accLastName').value.trim();
    const email = document.getElementById('accEmail').value.trim().toLowerCase();
    const password = document.getElementById('accPassword').value;
    const role = document.getElementById('accRole').value;
    const verified = document.getElementById('accVerified').checked;

    if (password.length < 6) {
        showToast('Password must be at least 6 characters.', 'warning');
        return;
    }

    const duplicate = window.db.accounts.find(
        (acc) => acc.email === email && acc.id !== editingAccountId
    );

    if (duplicate) {
        showToast('Email already exists.', 'danger');
        return;
    }

    if (editingAccountId) {
        const acc = window.db.accounts.find((a) => a.id === editingAccountId);
        if (!acc) return;

        const oldEmail = acc.email;
        acc.firstName = firstName;
        acc.lastName = lastName;
        acc.email = email;
        acc.password = password;
        acc.role = role;
        acc.verified = verified;

        window.db.employees.forEach((emp) => {
            if (emp.userId === acc.id) emp.userEmail = email;
        });
        window.db.requests.forEach((req) => {
            if (req.employeeEmail === oldEmail) req.employeeEmail = email;
        });

        if (currentUser && currentUser.id === acc.id) {
            currentUser = acc;
            localStorage.setItem('auth_token', acc.email);
            setAuthState(true, acc);
        }
    } else {
        window.db.accounts.push({
            id: createId('acc'),
            firstName,
            lastName,
            email,
            password,
            role,
            verified
        });
    }

    saveToStorage();
    hideAccountForm();
    renderAccountsList();
}

// Handles accounts table actions: edit / reset password / delete.
function handleAccountsTableClick(event) {
    const button = event.target.closest('button[data-account-action]');
    if (!button) return;

    const action = button.getAttribute('data-account-action');
    const id = button.getAttribute('data-account-id');
    const account = window.db.accounts.find((acc) => acc.id === id);
    if (!account) return;

    if (action === 'edit') {
        showAccountForm(account);
        return;
    }

    if (action === 'reset') {
        const newPassword = prompt('Enter new password (min 6 chars):', '');
        if (!newPassword) return;
        if (newPassword.length < 6) {
            showToast('Password must be at least 6 characters.', 'warning');
            return;
        }
        account.password = newPassword;
        saveToStorage();
        showToast('Password reset successfully.', 'success');
        return;
    }

    if (action === 'delete') {
        if (currentUser && currentUser.id === account.id) {
            showToast('You cannot delete your own account.', 'warning');
            return;
        }

        const confirmDelete = confirm(`Delete account ${account.email}?`);
        if (!confirmDelete) return;

        window.db.accounts = window.db.accounts.filter((acc) => acc.id !== id);
        window.db.employees = window.db.employees.filter((emp) => emp.userId !== id);
        window.db.requests = window.db.requests.filter((req) => req.employeeEmail !== account.email);
        saveToStorage();
        renderAccountsList();
    }
}

// Renders departments table.
function renderDepartmentsList() {
    const body = document.getElementById('departmentsTableBody');
    if (!body) return;

    if (!window.db.departments.length) {
        body.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No departments.</td></tr>';
        return;
    }

    body.innerHTML = window.db.departments
        .map(
            (dept) => `
            <tr>
                <td>${dept.name}</td>
                <td>${dept.description}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline-secondary" disabled>Edit</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-department-action="delete" data-department-id="${dept.id}">Delete</button>
                </td>
            </tr>
        `
        )
        .join('');
}

// Handles department delete action.
function handleDepartmentsTableClick(event) {
    const button = event.target.closest('button[data-department-action]');
    if (!button) return;

    const action = button.getAttribute('data-department-action');
    const departmentId = button.getAttribute('data-department-id');
    if (action !== 'delete' || !departmentId) return;

    const department = window.db.departments.find((dept) => dept.id === departmentId);
    if (!department) return;

    const hasLinkedEmployees = window.db.employees.some((emp) => emp.departmentId === departmentId);
    if (hasLinkedEmployees) {
        showToast('Cannot delete a department that is assigned to employees.', 'warning');
        return;
    }

    const confirmed = confirm(`Delete department ${department.name}?`);
    if (!confirmed) return;

    window.db.departments = window.db.departments.filter((dept) => dept.id !== departmentId);
    saveToStorage();
    renderDepartmentsList();
    renderEmployeeDeptOptions();
}

// Populates department dropdown in employee form.
function renderEmployeeDeptOptions() {
    const select = document.getElementById('employeeDepartment');
    if (!select) return;

    select.innerHTML = window.db.departments
        .map((dept) => `<option value="${dept.id}">${dept.name}</option>`)
        .join('');
}

// Renders employees table.
function renderEmployeesTable() {
    const body = document.getElementById('employeesTableBody');
    if (!body) return;

    if (!window.db.employees.length) {
        body.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No employees.</td></tr>';
        return;
    }

    body.innerHTML = window.db.employees
        .map((emp) => {
            const dept = window.db.departments.find((d) => d.id === emp.departmentId);
            return `
                <tr>
                    <td>${emp.employeeCode}</td>
                    <td>${emp.userEmail}</td>
                    <td>${emp.position}</td>
                    <td>${dept ? dept.name : '-'}</td>
                    <td>${emp.hireDate}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" data-employee-action="edit" data-employee-id="${emp.id}">Edit</button>
                        <button class="btn btn-sm btn-outline-danger" data-employee-action="delete" data-employee-id="${emp.id}">Delete</button>
                    </td>
                </tr>
            `;
        })
        .join('');
}

// Opens employee form and pre-fills if editing.
function showEmployeeForm(employee = null) {
    const card = document.getElementById('employeeFormCard');
    card.classList.remove('hidden');

    editingEmployeeId = employee ? employee.id : null;
    document.getElementById('employeeRecordId').value = editingEmployeeId || '';
    document.getElementById('employeeCode').value = employee ? employee.employeeCode : '';
    document.getElementById('employeeUserEmail').value = employee ? employee.userEmail : '';
    document.getElementById('employeePosition').value = employee ? employee.position : '';
    document.getElementById('employeeHireDate').value = employee ? employee.hireDate : '';

    renderEmployeeDeptOptions();
    if (employee) {
        document.getElementById('employeeDepartment').value = employee.departmentId;
    }
}

// Hides/resets employee form.
function hideEmployeeForm() {
    document.getElementById('employeeFormCard').classList.add('hidden');
    document.getElementById('employeeForm').reset();
    editingEmployeeId = null;
}

// Handles add/edit employee submit.
function handleEmployeeSubmit(event) {
    event.preventDefault();

    const employeeCode = document.getElementById('employeeCode').value.trim();
    const userEmail = document.getElementById('employeeUserEmail').value.trim().toLowerCase();
    const position = document.getElementById('employeePosition').value.trim();
    const departmentId = document.getElementById('employeeDepartment').value;
    const hireDate = document.getElementById('employeeHireDate').value;

    const account = window.db.accounts.find((acc) => acc.email === userEmail);
    if (!account) {
        showToast('User email must match an existing account.', 'warning');
        return;
    }

    const department = window.db.departments.find((d) => d.id === departmentId);
    if (!department) {
        showToast('Please choose a valid department.', 'warning');
        return;
    }

    if (editingEmployeeId) {
        const emp = window.db.employees.find((e) => e.id === editingEmployeeId);
        if (!emp) return;

        emp.employeeCode = employeeCode;
        emp.userId = account.id;
        emp.userEmail = account.email;
        emp.position = position;
        emp.departmentId = departmentId;
        emp.hireDate = hireDate;
    } else {
        window.db.employees.push({
            id: createId('emp'),
            employeeCode,
            userId: account.id,
            userEmail: account.email,
            position,
            departmentId,
            hireDate
        });
    }

    saveToStorage();
    hideEmployeeForm();
    renderEmployeesTable();
}

// Handles employees table actions: edit / delete.
function handleEmployeesTableClick(event) {
    const button = event.target.closest('button[data-employee-action]');
    if (!button) return;

    const action = button.getAttribute('data-employee-action');
    const id = button.getAttribute('data-employee-id');
    const employee = window.db.employees.find((emp) => emp.id === id);
    if (!employee) return;

    if (action === 'edit') {
        showEmployeeForm(employee);
        return;
    }

    if (action === 'delete') {
        if (!confirm('Delete employee record?')) return;
        window.db.employees = window.db.employees.filter((emp) => emp.id !== id);
        saveToStorage();
        renderEmployeesTable();
    }
}

// Maps request status to bootstrap badge classes.
function getRequestBadgeClass(status) {
    if (status === 'Approved') return 'bg-success';
    if (status === 'Rejected') return 'bg-danger';
    return 'bg-warning text-dark';
}

// Renders current user's requests only.
function renderRequestsTable() {
    const body = document.getElementById('requestsTableBody');
    if (!body || !currentUser) return;

    const mine = window.db.requests.filter((req) => req.employeeEmail === currentUser.email);

    if (!mine.length) {
        body.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No requests yet.</td></tr>';
        return;
    }

    body.innerHTML = mine
        .map((req) => {
            const date = new Date(req.date).toLocaleDateString();
            const itemsText = req.items.map((i) => `${i.name} x${i.qty}`).join(', ');
            return `
                <tr>
                    <td>${date}</td>
                    <td>${req.type}</td>
                    <td>${itemsText}</td>
                    <td><span class="badge ${getRequestBadgeClass(req.status)}">${req.status}</span></td>
                </tr>
            `;
        })
        .join('');
}

// Returns HTML for one dynamic request item row.
function createRequestItemRow(name = '', qty = 1) {
    return `
        <div class="item-row">
            <input type="text" class="request-item-name" placeholder="Item name" value="${name}">
            <input type="number" class="request-item-qty" min="1" value="${qty}">
            <button type="button" class="item-remove">x</button>
        </div>
    `;
}

// Resets request modal form to initial state.
function resetRequestForm() {
    document.getElementById('requestType').value = 'Equipment';
    document.getElementById('requestItems').innerHTML = createRequestItemRow();
}

// Opens request modal.
function openRequestModal() {
    resetRequestForm();
    document.getElementById('requestModal').classList.add('open');
}

// Closes request modal.
function closeRequestModal() {
    document.getElementById('requestModal').classList.remove('open');
}

// Handles add/remove item buttons inside request modal.
function handleRequestItemsClick(event) {
    if (event.target.id === 'addRequestItemBtn') {
        const items = document.getElementById('requestItems');
        items.insertAdjacentHTML('beforeend', createRequestItemRow());
        return;
    }

    if (event.target.classList.contains('item-remove')) {
        const rows = document.querySelectorAll('#requestItems .item-row');
        if (rows.length === 1) {
            showToast('At least one item is required.', 'warning');
            return;
        }
        event.target.closest('.item-row').remove();
    }
}

// Handles request submit and saves request as Pending.
function handleRequestSubmit(event) {
    event.preventDefault();

    if (!currentUser) return;

    const type = document.getElementById('requestType').value;
    const rows = Array.from(document.querySelectorAll('#requestItems .item-row'));

    const items = rows
        .map((row) => {
            const name = row.querySelector('.request-item-name').value.trim();
            const qty = Number(row.querySelector('.request-item-qty').value);
            return { name, qty };
        })
        .filter((item) => item.name && item.qty > 0);

    if (!items.length) {
        showToast('Add at least one valid item.', 'warning');
        return;
    }

    window.db.requests.push({
        id: createId('req'),
        type,
        items,
        status: 'Pending',
        date: new Date().toISOString(),
        employeeEmail: currentUser.email
    });

    saveToStorage();
    closeRequestModal();
    renderRequestsTable();
    showToast('Request submitted.', 'success');
}

// Central event binding function (all addEventListener setup).
function initEvents() {
    document.getElementById('registerForm').addEventListener('submit', register);
    document.getElementById('loginForm').addEventListener('submit', login);
    document.getElementById('simulateVerifyBtn').addEventListener('click', simulateVerify);
    document.getElementById('logoutLink').addEventListener('click', logout);
    document.getElementById('loginCancelBtn').addEventListener('click', () => navigateTo('#/'));
    document.getElementById('registerCancelBtn').addEventListener('click', () => navigateTo('#/'));
    document.getElementById('verifyGoLoginBtn').addEventListener('click', () => navigateTo('#/login'));

    document.getElementById('editProfileBtn').addEventListener('click', () => {
        showToast('Edit Profile is not implemented yet.', 'info');
    });

    document.getElementById('addAccountBtn').addEventListener('click', () => showAccountForm());
    document.getElementById('cancelAccountBtn').addEventListener('click', hideAccountForm);
    document.getElementById('accountForm').addEventListener('submit', handleAccountSubmit);
    document.getElementById('accountsTableBody').addEventListener('click', handleAccountsTableClick);

    document.getElementById('addDepartmentBtn').addEventListener('click', () => {
        showToast('Add Department is not implemented yet.', 'info');
    });
    document.getElementById('departmentsTableBody').addEventListener('click', handleDepartmentsTableClick);

    document.getElementById('addEmployeeBtn').addEventListener('click', () => showEmployeeForm());
    document.getElementById('cancelEmployeeBtn').addEventListener('click', hideEmployeeForm);
    document.getElementById('employeeForm').addEventListener('submit', handleEmployeeSubmit);
    document.getElementById('employeesTableBody').addEventListener('click', handleEmployeesTableClick);

    document.getElementById('newRequestBtn').addEventListener('click', openRequestModal);
    document.getElementById('closeRequestModal').addEventListener('click', closeRequestModal);
    document.getElementById('requestForm').addEventListener('submit', handleRequestSubmit);

    document.addEventListener('click', handleRequestItemsClick);
    document.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
        if (target.classList.contains('is-invalid')) {
            target.classList.remove('is-invalid');
            target.setCustomValidity('');
        }
    });
}

// Re-run routing when hash changes.
window.addEventListener('hashchange', handleRouting);

// App bootstrap on page load.
window.addEventListener('load', () => {
    loadFromStorage();
    initEvents();

    const token = (localStorage.getItem('auth_token') || '').toLowerCase();
    const found = window.db.accounts.find((acc) => acc.email === token && acc.verified);
    if (found) setAuthState(true, found);
    else setAuthState(false, null);

    if (!window.location.hash) {
        navigateTo('#/');
    } else {
        handleRouting();
    }
});

