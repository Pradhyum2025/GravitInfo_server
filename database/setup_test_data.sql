-- Update admin user role
UPDATE users SET role = 'admin' WHERE email = 'admin@eventbook.com';

-- Insert a sample event
INSERT INTO events (title, description, location, date, total_seats, available_seats, price, status, img) 
VALUES (
  'Tech Conference 2025',
  'Join us for the biggest tech conference of the year featuring keynote speakers, workshops, and networking opportunities.',
  'Mumbai Convention Center',
  '2025-06-15 09:00:00',
  500,
  500,
  99.99,
  'upcoming',
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzY2NjZmZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjQ4IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+VGVjaCBDb25mZXJlbmNlIDIwMjU8L3RleHQ+PC9zdmc+'
);
