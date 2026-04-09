const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const nodemailer = require('nodemailer');
require('dotenv').config();

// In-memory stores for OTP and reset tokens (resets on server restart — acceptable for serverless)
const otpStore = {};    // { email: { code, expires } }
const resetStore = {};  // { token: { email, expires } }

// Email transporter (uses Gmail App Password stored in env vars)
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

// POST /api/auth/send-otp  — sends a 6-digit code to the guest's email
app.post('/api/auth/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const code = generateOTP();
    otpStore[email] = { code, expires: Date.now() + 10 * 60 * 1000 }; // 10 min

    try {
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
        console.error('Email error:', err);
        res.status(500).json({ error: 'Failed to send email. Please check your email address.' });
    }
});

// POST /api/auth/verify-otp  — verifies the code and creates the account
app.post('/api/auth/verify-otp', async (req, res) => {
    const { email, code, fullName, password } = req.body;
    const record = otpStore[email];

    if (!record) return res.status(400).json({ error: 'No OTP found for this email. Please request a new code.' });
    if (Date.now() > record.expires) { delete otpStore[email]; return res.status(400).json({ error: 'OTP has expired. Please request a new code.' }); }
    if (record.code !== code) return res.status(400).json({ error: 'Invalid verification code. Please try again.' });

    delete otpStore[email]; // consume the token
    res.json({ success: true, user: { email, fullName, firstName: fullName.split(' ')[0] } });
});

// POST /api/auth/request-reset  — sends a password reset link via email
app.post('/api/auth/request-reset', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const token = generateToken();
    resetStore[token] = { email, expires: Date.now() + 30 * 60 * 1000 }; // 30 min

    // Determine origin dynamically
    const origin = req.headers.origin || `https://julsona-hotel-app1.vercel.app`;
    const resetLink = `${origin}/index.html?reset=${token}`;

    try {
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
        console.error('Email error:', err);
        res.status(500).json({ error: 'Failed to send reset email.' });
    }
});

// POST /api/auth/reset-password  — validates token and updates password
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    const record = resetStore[token];

    if (!record) return res.status(400).json({ error: 'Invalid or expired reset link.' });
    if (Date.now() > record.expires) { delete resetStore[token]; return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' }); }

    delete resetStore[token];
    res.json({ success: true, email: record.email });
});

// For local testing
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
// For Vercel Serverless Function
module.exports = app;
