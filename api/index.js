const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
require('dotenv').config();

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

// For local testing
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
// For Vercel Serverless Function
module.exports = app;
