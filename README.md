# Event Booking System - Backend Server

A Node.js/Express backend API for the Event Booking System with real-time seat locking via Socket.IO.

## Features

- 🔐 JWT Authentication
- 👥 User & Admin role management
- 🎫 Event CRUD operations
- 📅 Booking management
- 🔒 Real-time seat locking with Socket.IO
- 🛡️ Role-based access control
- 🔄 Consistent API response format

## Tech Stack

- **Node.js** with Express 5
- **MySQL** with mysql2
- **Socket.IO** for real-time features
- **JWT** for authentication
- **BcryptJS** for password hashing
- **ES6 Modules** (type: "module")

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```env
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
MYSQLHOST=localhost
MYSQLUSER=root
MYSQLPASSWORD=your-password
MYSQL_DATABASE=event_booking
MYSQLPORT=3306
```

3. Start the development server:
```bash
npm run dev
```

The server will be available at `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Events
- `GET /api/events` - Get all events (public)
- `GET /api/events/:id` - Get event by ID (public)
- `POST /api/events` - Create event (admin only)
- `PUT /api/events/:id` - Update event (admin only)
- `DELETE /api/events/:id` - Delete event (admin only)

### Bookings
- `POST /api/bookings` - Create booking (authenticated user)
- `GET /api/bookings` - Get bookings (filtered by eventId/userId)
- `GET /api/bookings/user/:userId` - Get user bookings
- `GET /api/bookings/:id` - Get booking by ID
- `PUT /api/bookings/:id` - Update booking status (admin only)

## Response Format

All API responses follow this format:
```json
{
  "success": boolean,
  "message": "string",
  "data": {}
}
```

## Socket.IO Events

### Client to Server:
- `joinEvent` - Join an event room
- `lockSeat` - Lock a seat
- `unlockSeat` - Unlock a seat

### Server to Client:
- `lockedSeats` - Current locked seats for an event
- `seatLocked` - Seat has been locked
- `seatUnlocked` - Seat has been unlocked
- `seatLockFailed` - Failed to lock seat

## Middleware

- **authMiddleware** - JWT token authentication
- **roleMiddleware** - Role-based authorization
- **bookingMiddleware** - Booking validation (admin check, event status)

## Database

Tables are automatically created on server start via `createTablesAuto.js`:
- `users` - User accounts
- `events` - Event listings
- `bookings` - Booking records

## Project Structure

```
Gravit_server/
├── config/
│   ├── db.js              # Database connection
│   └── createTablesAuto.js # Auto table creation
├── controllers/
│   ├── authController.js
│   ├── eventController.js
│   └── bookingController.js
├── middleware/
│   ├── authMiddleware.js
│   ├── roleMiddleware.js
│   └── bookingMiddleware.js
├── routes/
│   ├── authRoutes.js
│   ├── eventRoutes.js
│   └── bookingRoutes.js
├── server.js
└── package.json
```

## CORS Configuration

Currently configured for:
- `https://gravit-info-client.vercel.app`
- `https://gravit-info-client-git-main-pradhyum2025s-projects.vercel.app`

Update `server.js` to add more allowed origins for production.

## Security

- Passwords are hashed with bcryptjs
- JWT tokens expire after 1 day
- Admin routes protected with role middleware
- CORS configured for specific origins
- SQL injection protection via parameterized queries

## Production Deployment

1. Set all environment variables
2. Ensure database is configured
3. Update CORS origins in `server.js`
4. Set strong JWT_SECRET
5. Run: `npm start`

