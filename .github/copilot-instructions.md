# Julsona Hotels & Suites – AI Coding Agent Instructions

## Project Overview
Julsona Hotels & Suites is a hotel management web application for Makurdi, Nigeria featuring: guest-facing booking system, AI chatbot assistant, admin dashboard for revenue tracking, and backend booking API.

**Tech Stack:** Node.js + Express backend, vanilla JavaScript frontend, no build tool (direct HTML/CSS/JS)

---

## Architecture Overview

### Three-Tier Application Structure
1. **Frontend** (root HTML files + js/): Guest-facing booking & information pages
2. **Admin Portal** (`admin/`): Restricted dashboard for staff (sessionStorage token-based auth)
3. **Backend** (`server/`): Express API serving JSON bookings data

### Data Flow Pattern
- **Bookings**: Flow from `booking.html` form → `booking.js` (validation) → `POST /api/bookings` → `server.js` (save to `bookings.json`)
- **Admin Access**: `admin/login.html` → authenticate via `POST /api/login` → store token in `sessionStorage` → redirect to `dashboard.html`
- **Chatbot**: `Julsona.js` sends guest queries to Google Gemini API with hotel context, streams responses

### Critical Files by Component
- **Booking System**: `booking.html`, `booking.js` – room availability, conflict detection, multi-room reservations
- **Chatbot**: `Julsona.js` – Gemini API integration with `HOTEL_CONTEXT` system prompt
- **Admin Dashboard**: `admin/dashboard.html`, `js/admin.js` – stats calculation & booking table
- **Backend**: `server/server.js` – Express endpoints, file-based data persistence
- **Layout**: `header.html`, `footer.html` – shared via `#header-placeholder` / `#footer-placeholder` injection

---

## Project-Specific Patterns & Conventions

### 1. Dynamic Content Injection
- **Pattern**: HTML files load `header.html` and `footer.html` dynamically into placeholder divs
- **Implementation**: `Julsona.js` contains `loadHeader()` and `loadFooter()` functions that fetch & inject content
- **Key**: Always preserve existing header/footer injection logic when modifying pages

### 2. Room Data Model
```javascript
// Defined in booking.js
const roomMap = { "Deluxe": ["202", "205"], "Executive Deluxe": ["201", "203", "204"], "Royal Deluxe": ["206", "207", "208"] };
const priceMap = { "Deluxe": 15000, "Executive Deluxe": 20000, "Royal Deluxe": 25000 };
```
- **Royal Deluxe Special**: When `isServiceApartment` flag is true, price jumps to 45000 and becomes "Royal Deluxe Service Apartment"
- **When Modifying**: Update both maps together; always sync room numbers with actual availability logic

### 3. Booking Confirmation Flow
- Bookings are created in *pending* status, displayed to admin with "Confirmed/Pending" badge
- `booking.js` has `showConfirmationModal()` (client-side preview) → user clicks "confirm" → `saveBooking()` sends to API
- **Key Logic**: Calculate nights from dates using date overlap function, multiply by room quantity & price

### 4. Admin Authentication
- **No User Database**: Mock credentials hardcoded in `server/server.js` – `username: admin, password: julsona123`
- **Storage**: Token stored in `sessionStorage` (not persistent across browser closes)
- **Pattern**: Check for token on admin page load; redirect to login if missing
- **Security Note**: Current implementation is **not production-ready** – credentials should move to environment variables

### 5. Chatbot Context System
- `Julsona.js` defines `HOTEL_CONTEXT` string containing all hotel info (facilities, rates, contact)
- Sent to Gemini 1.5 Flash model with each guest query
- **When Updating Hotel Info**: Modify `HOTEL_CONTEXT` string to keep chatbot synchronized
- **Voice Features**: Speech Synthesis & Web Speech API integrated for voice input/output (check `voiceInput()`, `voiceOutput()`)

---

## Developer Workflows

### Running the Application
```bash
# Backend Server (from server/ directory)
npm install  # Only needed first time
npm start    # Runs on http://localhost:3000
npm run dev  # Watch mode with --watch flag

# Frontend
- Open any .html file directly in browser OR
- Serve from local server to avoid CORS issues with API calls
```

### Testing Bookings Flow
1. Navigate to `booking.html`
2. Fill form with room type, dates, customer info
3. Click "Confirm Booking" → modal shows total price
4. Click confirm → API call saved to `bookings.json`
5. Check admin dashboard (`admin/dashboard.html`) to see booking appear

### Debugging API Issues
- Ensure Node server is running (`npm start` in `server/` folder)
- Check browser console for CORS errors (Express has `cors` middleware enabled)
- Verify API_URL in frontend files points to `http://localhost:3000/api` (hardcoded, not configurable)

---

## Key Integration Points & Dependencies

### External Services
- **Google Gemini API**: Used in `Julsona.js` with hardcoded API key – **SECURITY ISSUE**: key exposed in client-side code
- **API Key Location**: `const GEMINI_API_KEY = 'AIzaSyCjW6natRsJe-uTagaQHCGFllQ6xD2p5VU'` (should move to backend proxy)

### Internal API Contracts
- **GET `/api/bookings`**: Returns array of all bookings (admin only in real app – currently unprotected)
- **POST `/api/bookings`**: Creates booking; expects `{ roomType, checkIn, checkOut, customer: { name, email }, ... }`
- **POST `/api/login`**: Expects `{ username, password }`; returns `{ success: true, token: '...' }`

### File Persistence
- **bookings.json**: Stores all bookings as JSON array; located in `server/` directory
- **Format**: Each booking has `id` (timestamp), `createdAt`, `status`, `customer`, `entries` (array of room reservations)

---

## Important Implementation Notes

1. **No Database**: Project uses file-based JSON storage; data does not persist between application restarts unless manually saved
2. **Hard Dependencies**: All client files assume `Julsona.js` loads first (contains shared functions like `loadHeader()`)
3. **Currency**: All prices in Nigerian Naira (₦); format with `.toLocaleString()` for display
4. **Overlap Detection**: `booking.js` has `overlaps()` function for date conflict checking – reuse instead of reimplementing
5. **Style Consistency**: Main styles in `Julsona.css`; admin styles separate in `css/admin.css`

---

## Known Limitations & Future Work
See `TODO.md` for completed tasks. Current focus: voice features for chatbot already implemented.
