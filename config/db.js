// ---------------------------------------------------------------------
// <copyright file="db.js" company="Gravit InfoSystem">
// Copyright (c) Gravit InfoSystem. All rights reserved.
// </copyright>
// ---------------------------------------------------------------------

const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

// Database configuration from environment variables
const dbHost = process.env.MYSQLHOST || 'localhost';
const dbUser = process.env.MYSQLUSER || 'root';
const dbPassword =  process.env.MYSQLPASSWORD || '';
const dbName = process.env.MYSQL_DATABASE || 'event_booking';
const dbPort = parseInt(process.env.MYSQLPORT || 3306, 10);

// Check if connecting to Railway (not localhost)
const isRailway = !dbHost.includes('localhost') && !dbHost.includes('127.0.0.1');

const dbConfig = {
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    port: dbPort,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

// Enable SSL for Railway connections
if (isRailway) {
    dbConfig.ssl = {
        rejectUnauthorized: false
    };
}

console.log('Database Configuration:');
// console.log(`  Host: ${dbConfig.host}`);
// console.log(`  User: ${dbConfig.user}`);
// console.log(`  Database: ${dbConfig.database}`);
// console.log(`  Port: ${dbConfig.port}`);
// console.log(`  SSL: ${dbConfig.ssl ? 'Enabled' : 'Disabled'}`);

const pool = mysql.createPool(dbConfig);

module.exports = pool.promise();
