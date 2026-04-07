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

// --- Media Upload Logic ---
const uploadForm = document.getElementById('media-upload-form');
if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('media-file');
        const uploadBtn = document.getElementById('upload-btn');
        const statusDiv = document.getElementById('upload-status');
        const resultDiv = document.getElementById('upload-result');
        
        if (!fileInput.files[0]) return;

        const fileInfo = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', fileInfo);

        // UI Reset
        uploadBtn.textContent = 'Uploading...';
        uploadBtn.disabled = true;
        statusDiv.style.display = 'block';
        statusDiv.style.color = '#ff9800';
        statusDiv.textContent = `Uploading ${fileInfo.name} (${(fileInfo.size / (1024 * 1024)).toFixed(2)} MB)... This might take a minute for large videos!`;
        resultDiv.innerHTML = '';

        try {
            // Because the frontend is static but we are hosted on Vercel, the API lives correctly at /api/...
            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData // Note: Do NOT set Content-Type header when using FormData
            });

            const data = await res.json();

            if (res.ok && data.success) {
                statusDiv.style.color = '#4caf50';
                statusDiv.textContent = 'Upload Successful!';
                
                const isVideo = fileInfo.type.startsWith('video');
                const previewHtml = isVideo 
                    ? `<video controls style="max-width: 300px; border-radius: 8px; margin-top: 10px;"><source src="${data.url}" type="${fileInfo.type}"></video>`
                    : `<img src="${data.url}" alt="Uploaded Media" style="max-width: 300px; border-radius: 8px; margin-top: 10px;">`;

                resultDiv.innerHTML = `
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; border: 1px solid #c8e6c9;">
                        <strong>Secure Cloudinary URL saved:</strong> <br>
                        <a href="${data.url}" target="_blank" style="color: #2e7d32; word-break: break-all;">${data.url}</a>
                        <br>
                        ${previewHtml}
                    </div>
                `;
                uploadForm.reset();
            } else {
                throw new Error(data.message || 'Upload failed');
            }
        } catch (err) {
            console.error(err);
            statusDiv.style.color = '#f44336';
            statusDiv.textContent = `Error: ${err.message}`;
        } finally {
            uploadBtn.textContent = 'Upload File';
            uploadBtn.disabled = false;
        }
    });
}
