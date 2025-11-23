// ---------------------------------------------------------------------
// <copyright file="bookingMiddleware.js" company="Gravit InfoSystem">
// Copyright (c) Gravit InfoSystem. All rights reserved.
// </copyright>
// ---------------------------------------------------------------------

const db = require('../config/db');

// Middleware to check if user is admin (admins cannot book tickets)
exports.checkUserRole = async (req, res, next) => {
    try {
        const { userId, user_id } = req.body;
        const user_id_val = userId || user_id;

        if (!user_id_val) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Get user role from database
        const [users] = await db.query('SELECT role FROM users WHERE id = ?', [user_id_val]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userRole = users[0].role;

        // Admins cannot book tickets
        if (userRole === 'admin') {
            return res.status(403).json({ 
                message: 'Admins cannot book tickets. Please sign in as a user to make bookings.' 
            });
        }

        // Attach user role to request for later use
        req.userRole = userRole;
        next();
    } catch (error) {
        console.error('Error checking user role:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Middleware to check if event is closed
exports.checkEventStatus = async (req, res, next) => {
    try {
        const { eventId, event_id } = req.body;
        const event_id_val = eventId || event_id;

        if (!event_id_val) {
            return res.status(400).json({ message: 'Event ID is required' });
        }

        // Get event status from database
        const [events] = await db.query('SELECT status FROM events WHERE id = ?', [event_id_val]);
        
        if (events.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const eventStatus = events[0].status;

        // Closed events cannot be booked
        if (eventStatus === 'closed') {
            return res.status(403).json({ 
                message: 'This event is closed. Bookings are no longer available.' 
            });
        }

        // Attach event status to request for later use
        req.eventStatus = eventStatus;
        next();
    } catch (error) {
        console.error('Error checking event status:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

