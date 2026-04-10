const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function generateToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// DB-backed OTP helpers (stored in Neon so serverless instances share state)
async function saveOTP(pool, email, code) {
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await pool.query(
        `INSERT INTO otp_tokens (email, code, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET code=$2, expires_at=$3`,
        [email, code, expires]
    );
}
async function getOTP(pool, email) {
    const res = await pool.query('SELECT * FROM otp_tokens WHERE email=$1', [email]);
    return res.rows[0] || null;
}
async function deleteOTP(pool, email) {
    await pool.query('DELETE FROM otp_tokens WHERE email=$1', [email]);
}

// DB-backed reset token helpers
async function saveResetToken(pool, token, email) {
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await pool.query(
        `INSERT INTO reset_tokens (token, email, expires_at) VALUES ($1, $2, $3)`,
        [token, email, expires]
    );
}
async function getResetToken(pool, token) {
    const res = await pool.query('SELECT * FROM reset_tokens WHERE token=$1', [token]);
    return res.rows[0] || null;
}
async function deleteResetToken(pool, token) {
    await pool.query('DELETE FROM reset_tokens WHERE token=$1', [token]);
}


// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer for processing file uploads into memory
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Postgres connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Helper: Read Bookings
async function readBookings() {
    const res = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC');
    return res.rows.map(row => ({
        id: row.id,
        type: row.room_type,
        number: row.room_number,
        checkIn: row.check_in,
        checkOut: row.check_out,
        qty: row.quantity,
        nights: row.nights,
        customer: {
            name: row.customer_name,
            email: row.customer_email
        },
        paid: row.paid,
        provider: row.provider,
        txref: row.txref,
        status: row.status,
        createdAt: row.created_at
    }));
}

// 1. GET /api/bookings
app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await readBookings();
        res.json(bookings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to read bookings' });
    }
});

// 2. POST /api/bookings (Create new booking)
app.post('/api/bookings', async (req, res) => {
    try {
        const newBooking = req.body;
        if (!newBooking.type || !newBooking.checkIn || !newBooking.checkOut) {
            return res.status(400).json({ error: 'Missing required booking fields' });
        }
        
        const id = Date.now().toString();
        const createdAt = new Date().toISOString();
        const status = newBooking.status || 'pending';
        
        await pool.query(
            `INSERT INTO bookings (
                id, room_type, room_number, check_in, check_out, 
                quantity, nights, customer_name, customer_email, 
                paid, provider, txref, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
                id,
                newBooking.type,
                newBooking.number || '',
                newBooking.checkIn,
                newBooking.checkOut,
                newBooking.qty || 1,
                newBooking.nights || 1,
                newBooking.customer?.name || '',
                newBooking.customer?.email || '',
                newBooking.paid || false,
                newBooking.provider || '',
                newBooking.txref || '',
                status,
                createdAt
            ]
        );

        res.status(201).json({ message: 'Booking created', booking: { ...newBooking, id, status, createdAt } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save booking' });
    }
});

// 3. POST /api/login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'julsona123';
    
    if (username === adminUser && password === adminPass) {
        res.json({ success: true, token: 'mock-admin-token-12345' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// 4. POST /api/bookings/:id/status
app.post('/api/bookings/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const result = await pool.query(
            'UPDATE bookings SET status = $1 WHERE id = $2 OR txref = $2 RETURNING *',
            [status, id]
        );
        
        if (result.rowCount > 0) {
            res.json({ success: true, booking: result.rows[0] });
        } else {
            res.status(404).json({ error: 'Booking not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Update failed' });
    }
});

// 5. POST /api/upload (Upload to Cloudinary)
app.post('/api/upload', upload.single('media'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Convert file buffer to Base64 to send to Cloudinary safely from memory
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        
        // Ensure accurate resource type detection (video vs image)
        const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
        
        const result = await cloudinary.uploader.upload(dataURI, {
            resource_type: resourceType,
            folder: 'julsona-hotel'
        });
        
        res.json({ success: true, url: result.secure_url });
    } catch (error) {
        console.error('Cloudinary error:', error);
        res.status(500).json({ error: 'Failed to upload media' });
    }
});

// --- GUEST AUTH ENDPOINTS ---

// Ensure all auth tables exist on first request
async function ensureAuthTables(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS otp_tokens (
            email TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reset_tokens (
            token TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL
        );
    `);
}

// POST /api/auth/send-otp
app.post('/api/auth/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('Missing EMAIL_USER or EMAIL_PASS environment variables.');
        return res.status(500).json({ error: 'Server configuration error: Email credentials are not set.' });
    }

    try {
        await ensureAuthTables(pool);

        // Check if user already exists
        const existing = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email.trim()]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
        }

        const code = generateOTP();
        await saveOTP(pool, email.trim(), code);

        await transporter.sendMail({
            from: `"Julsona Hotels & Suites" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your Julsona Hotels Verification Code',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
                    <div style="background:#0a2a43;padding:20px;text-align:center;">
                        <h2 style="color:#b8860b;margin:0;">Julsona Hotels & Suites</h2>
                    </div>
                    <div style="padding:30px;">
                        <p style="font-size:16px;">Your email verification code is:</p>
                        <div style="font-size:40px;font-weight:bold;letter-spacing:10px;color:#0a2a43;text-align:center;padding:20px;background:#f8f8f8;border-radius:8px;">${code}</div>
                        <p style="color:#888;font-size:13px;margin-top:20px;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
                    </div>
                </div>`
        });
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (err) {
        console.error('Send OTP error:', err);
        res.status(500).json({ error: 'Failed to send email. Error: ' + err.message });
    }
});

// POST /api/auth/verify-otp  — verify code THEN create account in DB
app.post('/api/auth/verify-otp', async (req, res) => {
    const { email, code, fullName, password } = req.body;
    try {
        await ensureAuthTables(pool);
        const record = await getOTP(pool, email.trim());

        if (!record) return res.status(400).json({ error: 'No OTP found for this email. Please request a new code.' });
        if (new Date() > new Date(record.expires_at)) {
            await deleteOTP(pool, email.trim());
            return res.status(400).json({ error: 'OTP has expired. Please request a new code.' });
        }
        if (record.code !== code) return res.status(400).json({ error: 'Invalid verification code. Please try again.' });

        // Check if user already exists
        const existing = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email.trim()]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
        }

        // Create user in Neon DB
        await pool.query(
            'INSERT INTO users (full_name, email, password) VALUES ($1, $2, $3)',
            [fullName, email.trim(), password]
        );

        await deleteOTP(pool, email.trim());
        const firstName = fullName.split(' ')[0];
        res.json({ success: true, user: { email: email.trim(), fullName, firstName } });
    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).json({ error: 'Verification failed. Please try again.' });
    }
});

// POST /api/auth/login  — validate credentials against Neon DB
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    try {
        await ensureAuthTables(pool);
        // Case-insensitive email lookup
        const result = await pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [email.trim()]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'No account found with this email. Please sign up.' });
        const user = result.rows[0];
        if (user.password !== password) return res.status(401).json({ error: 'Incorrect password. Please try again.' });
        res.json({ success: true, user: { email: user.email, fullName: user.full_name, firstName: user.full_name.split(' ')[0] } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// POST /api/auth/update-password  — update password in DB after reset
app.post('/api/auth/update-password', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields.' });
    try {
        await pool.query('UPDATE users SET password=$1 WHERE LOWER(email)=LOWER($2)', [password, email.trim()]);
        res.json({ success: true });
    } catch (err) {
        console.error('Update password error:', err);
        res.status(500).json({ error: 'Failed to update password.' });
    }
});

// POST /api/auth/request-reset
app.post('/api/auth/request-reset', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('Missing EMAIL_USER or EMAIL_PASS environment variables.');
        return res.status(500).json({ error: 'Server configuration error: Email credentials are not set.' });
    }

    try {
        await ensureAuthTables(pool);

        // Check if email is registered in DB
        const userCheck = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email.trim()]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'No account found with this email address. Please sign up first.' });
        }

        const token = generateToken();
        await saveResetToken(pool, token, email.trim());

        const origin = req.headers.origin || `https://julsona-hotel-app1.vercel.app`;
        const resetLink = `${origin}/index.html?reset=${token}`;

        await transporter.sendMail({
            from: `"Julsona Hotels & Suites" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Reset Your Julsona Hotels Password',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
                    <div style="background:#0a2a43;padding:20px;text-align:center;">
                        <h2 style="color:#b8860b;margin:0;">Julsona Hotels & Suites</h2>
                    </div>
                    <div style="padding:30px;">
                        <p style="font-size:16px;">You requested a password reset. Click the button below to set a new password:</p>
                        <div style="text-align:center;margin:30px 0;">
                            <a href="${resetLink}" style="background:#b8860b;color:#000;padding:14px 30px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;">Reset My Password</a>
                        </div>
                        <p style="color:#888;font-size:13px;">This link expires in 30 minutes. If you did not request this, please ignore this email.</p>
                    </div>
                </div>`
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Reset request error:', err);
        res.status(500).json({ error: 'Failed to send reset email. Error: ' + err.message });
    }
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    try {
        await ensureAuthTables(pool);
        const record = await getResetToken(pool, token);

        if (!record) return res.status(400).json({ error: 'Invalid or expired reset link.' });
        if (new Date() > new Date(record.expires_at)) {
            await deleteResetToken(pool, token);
            return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
        }

        // Update the password in Neon DB
        await pool.query('UPDATE users SET password=$1 WHERE LOWER(email)=LOWER($2)', [password, record.email.trim()]);
        await deleteResetToken(pool, token);
        res.json({ success: true, email: record.email.trim() });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Reset failed. Please try again.' });
    }
});

// For local testing
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
// For Vercel Serverless Function
module.exports = app;
