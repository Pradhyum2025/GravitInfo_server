// ---------------------------------------------------------------------
// <copyright file="bookingController.js" company="Gravit InfoSystem">
// Copyright (c) Gravit InfoSystem. All rights reserved.
// </copyright>
// ---------------------------------------------------------------------

const db = require('../config/db');

exports.createBooking = async (req, res) => {
    // Support both camelCase (frontend) and snake_case
    const { eventId, event_id, userId, user_id, seats, quantity, totalAmount, total_amount, name, email, mobile } = req.body;
    const event_id_val = eventId || event_id;
    const user_id_val = userId || user_id;
    const seatsArray = Array.isArray(seats) ? seats : (seats ? [seats] : []);
    const quantity_val = quantity || seatsArray.length;
    const total_amount_val = totalAmount || total_amount || 0;

    if (!event_id_val || !user_id_val || !quantity_val || seatsArray.length === 0) {
        return res.status(400).json({ message: 'Missing required fields: eventId, userId, and seats are required' });
    }

    if (!total_amount_val || total_amount_val <= 0) {
        return res.status(400).json({ message: 'Total amount is required and must be greater than 0' });
    }

    // Additional security check: Verify user is not admin (backup check)
    try {
        const [users] = await db.query('SELECT role FROM users WHERE id = ?', [user_id_val]);
        if (users.length > 0 && users[0].role === 'admin') {
            return res.status(403).json({ 
                message: 'Admins cannot book tickets. Please sign in as a user to make bookings.' 
            });
        }
    } catch (userCheckError) {
        console.error('Error checking user role in controller:', userCheckError);
        // Continue with booking if check fails (middleware should have caught it)
    }

    let connection;
    try {
        connection = await db.getConnection();
        if (!connection) {
            return res.status(500).json({ message: 'Database connection failed' });
        }
        await connection.beginTransaction();

        // Check if seats column exists
        let hasSeatsColumn = false;
        try {
            await connection.execute('SELECT seats FROM bookings LIMIT 1');
            hasSeatsColumn = true;
        } catch (err) {
            if (err.code === 'ER_BAD_FIELD_ERROR') {
                hasSeatsColumn = false;
            } else {
                throw err;
            }
        }

        // Check if user already has a booking for this event (prevent duplicate bookings)
        const query = hasSeatsColumn 
            ? 'SELECT id, seats FROM bookings WHERE event_id = ? AND user_id = ?'
            : 'SELECT id FROM bookings WHERE event_id = ? AND user_id = ?';
        
        const [existingUserBookings] = await connection.execute(query, [event_id_val, user_id_val]);

        if (existingUserBookings.length > 0 && hasSeatsColumn) {
            // Check if user is trying to book the same seats
            const existingSeats = new Set();
            existingUserBookings.forEach(booking => {
                try {
                    const bookedSeats = booking.seats ? (typeof booking.seats === 'string' ? JSON.parse(booking.seats) : booking.seats) : [];
                    if (Array.isArray(bookedSeats)) {
                        bookedSeats.forEach(seat => existingSeats.add(Number(seat)));
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
            });

            const duplicateSeats = seatsArray.filter(seat => existingSeats.has(Number(seat)));
            if (duplicateSeats.length > 0) {
                await connection.rollback();
                return res.status(400).json({ 
                    message: `You have already booked seats ${duplicateSeats.join(', ')} for this event.` 
                });
            }
        }

        // Check availability and get event (FOR UPDATE locks the row)
        const [events] = await connection.execute('SELECT * FROM events WHERE id = ? FOR UPDATE', [event_id_val]);
        if (events.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Event not found' });
        }
        const event = events[0];

        // Additional security check: Verify event is not closed (backup check)
        if (event.status === 'closed') {
            await connection.rollback();
            return res.status(403).json({ 
                message: 'This event is closed. Bookings are no longer available.' 
            });
        }

        // Check if event is closed (all seats booked)
        if (event.available_seats <= 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Event is fully booked. Registration is closed.' });
        }

        // Validate seats are still available (BACKEND VALIDATION - Only backend modifies seat count)
        let allBookedSeats = new Set();
        if (hasSeatsColumn) {
            try {
                const [existingBookings] = await connection.execute(
                    'SELECT seats FROM bookings WHERE event_id = ? AND seats IS NOT NULL',
                    [event_id_val]
                );

                existingBookings.forEach(booking => {
                    try {
                        const bookedSeats = booking.seats ? (typeof booking.seats === 'string' ? JSON.parse(booking.seats) : booking.seats) : [];
                        if (Array.isArray(bookedSeats)) {
                            bookedSeats.forEach(seat => allBookedSeats.add(Number(seat)));
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                });
            } catch (err) {
                // If seats column doesn't exist, skip seat conflict check
                if (err.code !== 'ER_BAD_FIELD_ERROR') {
                    throw err;
                }
            }
        }

        // Check if any requested seat is already booked
        if (allBookedSeats.size > 0) {
            const conflictingSeats = seatsArray.filter(seat => allBookedSeats.has(Number(seat)));
            if (conflictingSeats.length > 0) {
                await connection.rollback();
                return res.status(400).json({ 
                    message: `Seats ${conflictingSeats.join(', ')} are already booked. Please select different seats.` 
                });
            }
        }

        // Validate seat numbers are within range
        const totalSeats = event.total_seats || event.totalSeats || 50;
        const invalidSeats = seatsArray.filter(seat => Number(seat) < 1 || Number(seat) > totalSeats);
        if (invalidSeats.length > 0) {
            await connection.rollback();
            return res.status(400).json({ 
                message: `Invalid seat numbers: ${invalidSeats.join(', ')}. Seats must be between 1 and ${totalSeats}.` 
            });
        }

        // Check if enough seats are available (BACKEND ONLY MODIFIES SEAT COUNT)
        if (event.available_seats < quantity_val) {
            await connection.rollback();
            return res.status(400).json({ message: 'Not enough seats available' });
        }

        // BACKEND MODIFIES SEAT COUNT - Update available seats atomically
        await connection.execute('UPDATE events SET available_seats = available_seats - ? WHERE id = ?', [quantity_val, event_id_val]);

        // Verify the update was successful
        const [updatedEvent] = await connection.execute('SELECT available_seats FROM events WHERE id = ?', [event_id_val]);
        if (updatedEvent[0].available_seats < 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Seat count validation failed. Please try again.' });
        }

        // Create booking - store seats as JSON string
        const seatsJson = JSON.stringify(seatsArray);
        
        // Get user info first to fill in missing fields
        let user = {};
        try {
            const [users] = await connection.execute('SELECT name, email FROM users WHERE id = ?', [user_id_val]);
            user = users && users.length > 0 ? users[0] : {};
        } catch (userError) {
            console.error('Error fetching user info:', userError);
            // Continue without user info - use provided values or null
        }
        
        // Ensure no undefined values (convert to null)
        const name_val = name || user.name || null;
        const email_val = email || user.email || null;
        const mobile_val = mobile || null;
        
        let result;
        try {
            // Try to insert with seats column first
            [result] = await connection.execute(
                'INSERT INTO bookings (event_id, user_id, name, email, mobile, quantity, total_amount, seats) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [event_id_val, user_id_val, name_val, email_val, mobile_val, quantity_val, total_amount_val, seatsJson]
            );
        } catch (err) {
            // If seats column doesn't exist, insert without it
            if (err.code === 'ER_BAD_FIELD_ERROR' || err.message.includes('seats')) {
                [result] = await connection.execute(
                    'INSERT INTO bookings (event_id, user_id, name, email, mobile, quantity, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [event_id_val, user_id_val, name_val, email_val, mobile_val, quantity_val, total_amount_val]
                );
            } else {
                throw err; // Re-throw if it's a different error
            }
        }

        await connection.commit();

        // Return booking in camelCase
        const booking = {
            id: result.insertId,
            eventId: event_id_val,
            userId: user_id_val,
            seats: seatsArray,
            quantity: quantity_val,
            totalAmount: total_amount_val,
            status: 'confirmed',
            createdAt: new Date().toISOString(),
            name: name_val,
            email: email_val
        };

        res.status(201).json(booking);
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
        }
        console.error('Booking error:', error);
        console.error('Error stack:', error.stack);
        
        // Don't expose internal errors to client
        const errorMessage = process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'An error occurred while processing your booking. Please try again.';
        
        res.status(500).json({ 
            message: 'Server error', 
            error: errorMessage 
        });
    } finally {
        if (connection) {
            try {
                connection.release();
            } catch (releaseError) {
                console.error('Error releasing connection:', releaseError);
            }
        }
    }
};

exports.getAllBookings = async (req, res) => {
    try {
        const { userId, eventId } = req.query;
        
        // Check if seats column exists first
        let hasSeatsColumn = true;
        try {
            await db.query('SELECT seats FROM bookings LIMIT 1');
        } catch (err) {
            if (err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'ER_NO_SUCH_TABLE') {
                hasSeatsColumn = false;
            } else {
                console.error('Error checking seats column:', err);
                // Continue anyway, assume column doesn't exist
                hasSeatsColumn = false;
            }
        }
        
        // Build query - include seats column only if it exists
        let query = hasSeatsColumn 
            ? 'SELECT b.*, e.title, e.date, e.location, e.img FROM bookings b JOIN events e ON b.event_id = e.id'
            : 'SELECT b.id, b.event_id, b.user_id, b.quantity, b.total_amount, b.status, b.booking_date, b.name, b.email, b.mobile, e.title, e.date, e.location, e.img FROM bookings b JOIN events e ON b.event_id = e.id';
        
        const params = [];
        const conditions = [];
        
        if (userId) {
            conditions.push('b.user_id = ?');
            params.push(userId);
        }
        
        if (eventId) {
            conditions.push('b.event_id = ?');
            params.push(eventId);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY b.booking_date DESC';
        
        let bookings = [];
        try {
            const [results] = await db.query(query, params);
            bookings = results || [];
        } catch (queryError) {
            console.error('Database query error:', queryError);
            console.error('Query:', query);
            console.error('Params:', params);
            throw queryError;
        }
        
        // Transform to camelCase
        const transformed = bookings.map(booking => {
            let seatsArray = [];
            try {
                // Only try to parse seats if column exists and has value
                if (hasSeatsColumn && booking.seats !== undefined && booking.seats !== null && booking.seats !== '') {
                    if (typeof booking.seats === 'string') {
                        try {
                            seatsArray = JSON.parse(booking.seats);
                        } catch (parseError) {
                            // Try comma-separated format
                            seatsArray = booking.seats.split(',').map(s => s.trim()).filter(Boolean);
                        }
                    } else if (Array.isArray(booking.seats)) {
                        seatsArray = booking.seats;
                    }
                    // Convert to numbers and filter valid seats
                    seatsArray = seatsArray.map(seat => Number(seat)).filter(seat => !isNaN(seat) && seat > 0);
                }
            } catch (e) {
                console.error('Error parsing seats for booking', booking.id, ':', e.message);
                seatsArray = [];
            }
            return {
                id: booking.id,
                eventId: Number(booking.event_id),
                userId: Number(booking.user_id),
                seats: seatsArray,
                quantity: booking.quantity,
                totalAmount: booking.total_amount,
                status: booking.status || 'pending',
                createdAt: booking.booking_date || booking.created_at,
                name: booking.name,
                email: booking.email,
                mobile: booking.mobile
            };
        });
        
        res.json(transformed);
    } catch (error) {
        console.error('Get bookings error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

exports.getUserBookings = async (req, res) => {
    const { userId } = req.params;
    try {
        let hasSeatsColumn = true;
        try {
            await db.query('SELECT seats FROM bookings LIMIT 1');
        } catch (err) {
            if (err.code === 'ER_BAD_FIELD_ERROR') hasSeatsColumn = false;
            else throw err;
        }
        
        const query = hasSeatsColumn
            ? 'SELECT b.*, e.title, e.date, e.location, e.img FROM bookings b JOIN events e ON b.event_id = e.id WHERE b.user_id = ? ORDER BY b.booking_date DESC'
            : 'SELECT b.id, b.event_id, b.user_id, b.quantity, b.total_amount, b.status, b.booking_date, b.name, b.email, b.mobile, e.title, e.date, e.location, e.img FROM bookings b JOIN events e ON b.event_id = e.id WHERE b.user_id = ? ORDER BY b.booking_date DESC';
        
        const [bookings] = await db.query(query, [userId]);
        
        const transformed = bookings.map(booking => {
            let seatsArray = [];
            try {
                if (hasSeatsColumn && booking.seats !== undefined && booking.seats !== null && booking.seats !== '') {
                    if (typeof booking.seats === 'string') {
                        try {
                            seatsArray = JSON.parse(booking.seats);
                        } catch (parseError) {
                            seatsArray = booking.seats.split(',').map(s => s.trim()).filter(Boolean);
                        }
                    } else if (Array.isArray(booking.seats)) {
                        seatsArray = booking.seats;
                    }
                    seatsArray = seatsArray.map(seat => Number(seat)).filter(seat => !isNaN(seat) && seat > 0);
                }
            } catch (e) {
                seatsArray = [];
            }
            return {
                id: booking.id,
                eventId: Number(booking.event_id),
                userId: Number(booking.user_id),
                seats: seatsArray,
                quantity: booking.quantity,
                totalAmount: booking.total_amount,
                status: booking.status || 'pending',
                createdAt: booking.booking_date || booking.created_at,
                name: booking.name,
                email: booking.email,
                mobile: booking.mobile
            };
        });
        
        res.json(transformed);
    } catch (error) {
        console.error('Get user bookings error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getBookingById = async (req, res) => {
    const { id } = req.params;
    try {
        const [bookings] = await db.query(
            'SELECT b.*, e.title, e.date, e.location, e.img FROM bookings b JOIN events e ON b.event_id = e.id WHERE b.id = ?',
            [id]
        );
        
        if (bookings.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        
        const booking = bookings[0];
        let seatsArray = [];
        try {
            if (booking.seats !== undefined && booking.seats !== null) {
                seatsArray = typeof booking.seats === 'string' ? JSON.parse(booking.seats) : booking.seats;
                if (!Array.isArray(seatsArray)) {
                    seatsArray = [];
                }
            }
        } catch (e) {
            seatsArray = [];
        }
        res.json({
            id: booking.id,
            eventId: booking.event_id,
            userId: booking.user_id,
            seats: seatsArray,
            quantity: booking.quantity,
            totalAmount: booking.total_amount,
            status: booking.status || 'pending',
            createdAt: booking.booking_date || booking.created_at,
            name: booking.name,
            email: booking.email,
            mobile: booking.mobile
        });
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateBooking = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        await db.query('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);
        const [bookings] = await db.query('SELECT b.*, e.title, e.date, e.location, e.img FROM bookings b JOIN events e ON b.event_id = e.id WHERE b.id = ?', [id]);
        
        if (bookings.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        
        const booking = bookings[0];
        let seatsArray = [];
        try {
            if (booking.seats !== undefined && booking.seats !== null) {
                seatsArray = typeof booking.seats === 'string' ? JSON.parse(booking.seats) : booking.seats;
                if (!Array.isArray(seatsArray)) {
                    seatsArray = [];
                }
            }
        } catch (e) {
            seatsArray = [];
        }
        res.json({
            id: booking.id,
            eventId: booking.event_id,
            userId: booking.user_id,
            seats: seatsArray,
            quantity: booking.quantity,
            totalAmount: booking.total_amount,
            status: booking.status || 'pending',
            createdAt: booking.booking_date || booking.created_at,
            name: booking.name,
            email: booking.email,
            mobile: booking.mobile
        });
    } catch (error) {
        console.error('Update booking error:', error);
        res.status(500).json({ message: 'Server error' });
    }
}
