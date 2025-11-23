// ---------------------------------------------------------------------
// <copyright file="eventController.js" company="Gravit InfoSystem">
// Copyright (c) Gravit InfoSystem. All rights reserved.
// </copyright>
// ---------------------------------------------------------------------

const db = require('../config/db');

exports.getAllEvents = async (req, res) => {
    try {
        const [events] = await db.query('SELECT * FROM events ORDER BY date ASC');
        // Transform to camelCase for frontend
        const transformedEvents = events.map(event => ({
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            date: event.date,
            totalSeats: event.total_seats,
            availableSeats: event.available_seats,
            price: event.price,
            status: event.status || 'upcoming',
            image: event.img
        }));
        res.json(transformedEvents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getEventById = async (req, res) => {
    const { id } = req.params;
    try {
        const [events] = await db.query('SELECT * FROM events WHERE id = ?', [id]);
        if (events.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        const event = events[0];
        // Transform to camelCase
        res.json({
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            date: event.date,
            totalSeats: event.total_seats,
            availableSeats: event.available_seats,
            price: event.price,
            status: event.status || 'upcoming',
            image: event.img
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createEvent = async (req, res) => {
    // Support both camelCase (frontend) and snake_case
    const { title, description, location, date, totalSeats, total_seats, price, image, img, status } = req.body;
    const total_seats_val = totalSeats || total_seats;
    const img_val = image || img;

    // Validation
    if (!title || !date || !total_seats_val || !price) {
        return res.status(400).json({ message: 'Please fill all required fields' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO events (title, description, location, date, total_seats, available_seats, price, img, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [title, description, location, date, total_seats_val, total_seats_val, price, img_val, status || 'upcoming']
        );
        const [newEvent] = await db.query('SELECT * FROM events WHERE id = ?', [result.insertId]);
        const event = newEvent[0];
        res.status(201).json({
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            date: event.date,
            totalSeats: event.total_seats,
            availableSeats: event.available_seats,
            price: event.price,
            status: event.status || 'upcoming',
            image: event.img
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateEvent = async (req, res) => {
    const { id } = req.params;
    // Support both camelCase and snake_case
    const { title, description, location, date, totalSeats, total_seats, price, status, image, img } = req.body;
    const total_seats_val = totalSeats || total_seats;
    const img_val = image || img;

    try {
        await db.query(
            'UPDATE events SET title = ?, description = ?, location = ?, date = ?, total_seats = ?, price = ?, status = ?, img = ? WHERE id = ?',
            [title, description, location, date, total_seats_val, price, status, img_val, id]
        );
        const [updated] = await db.query('SELECT * FROM events WHERE id = ?', [id]);
        const event = updated[0];
        res.json({
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            date: event.date,
            totalSeats: event.total_seats,
            availableSeats: event.available_seats,
            price: event.price,
            status: event.status || 'upcoming',
            image: event.img
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteEvent = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM events WHERE id = ?', [id]);
        res.json({ message: 'Event deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
