const API_URL = '/api';

// --- Login Page Logic ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginForm.username.value;
        const password = loginForm.password.value;
        const errorMsg = document.getElementById('error-msg');

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                sessionStorage.setItem('admin_token', data.token);
                window.location.href = 'dashboard.html';
            } else {
                errorMsg.textContent = data.message || 'Login failed';
                errorMsg.style.display = 'block';
            }
        } catch (err) {
            console.error(err);
            errorMsg.textContent = 'Server connection error';
            errorMsg.style.display = 'block';
        }
    });
}

// --- Dashboard Logic ---
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('admin_token');
        window.location.href = 'login.html';
    });
}

async function loadAdminData() {
    const tableBody = document.querySelector('#bookings-table tbody');
    const statsTotal = document.getElementById('stats-total');
    const statsRevenue = document.getElementById('stats-revenue');
    const statsCheckins = document.getElementById('stats-checkins');

    try {
        const res = await fetch(`${API_URL}/bookings`);
        if (!res.ok) throw new Error('Failed to fetch');

        const bookings = await res.json();

        // 1. Update Stats
        statsTotal.textContent = bookings.length;

        const revenue = bookings.reduce((acc, b) => {
            // Estimate price based on room type
            let price = 0;
            if (b.type === "Deluxe") price = 15000;
            if (b.type === "Executive Deluxe") price = 20000;
            if (b.type === "Royal Deluxe") price = 25000;
            return acc + (price * b.qty * (b.nights || 1));
        }, 0);
        statsRevenue.textContent = '₦' + revenue.toLocaleString();

        const today = new Date().toISOString().split('T')[0];
        const checkins = bookings.filter(b => b.checkIn === today).length;
        statsCheckins.textContent = checkins;

        // 2. Populate Table
        if (bookings.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No bookings found</td></tr>';
            return;
        }

        bookings.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); // Sort newest first

        tableBody.innerHTML = bookings.map(b => {
            // Estimate price logic again for display
            let price = 0;
            if (b.type === "Deluxe") price = 15000;
            if (b.type === "Executive Deluxe") price = 20000;
            if (b.type === "Royal Deluxe") price = 25000;
            const total = (price * b.qty * (b.nights || 1)).toLocaleString();

            const badgeClass = b.status === 'confirmed' || b.paid ? 'status-confirmed' : 'status-pending';
            const statusText = b.paid ? 'Paid' : (b.status || 'Pending');

            return `
            <tr>
                <td>${new Date(b.createdAt).toLocaleDateString()}</td>
                <td>
                    <strong>${b.customer?.name || 'Unknown'}</strong><br>
                    <small>${b.customer?.email || ''}</small>
                </td>
                <td>
                    ${b.qty} x ${b.type}<br>
                    <small>Room ${b.number}</small>
                </td>
                <td>${b.checkIn} <br>to ${b.checkOut}</td>
                <td>₦${total}</td>
                <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
                <td>
                    <button class="btn-admin" style="font-size:0.8rem; padding: 4px 8px;" onclick="viewBooking('${b.id}')">View</button>
                </td>
            </tr>
            `;
        }).join('');

    } catch (err) {
        console.error(err);
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Failed to load data. Is server running?</td></tr>';
    }
}

function viewBooking(id) {
    alert('Details view coming soon! ID: ' + id);
}
