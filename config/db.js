const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    server: process.env.DB_SERVER, 
    database: process.env.DB_DATABASE, 
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
    pool: {
        max: 10,  
        min: 1,   
        idleTimeoutMillis: 30000 
    },
    requestTimeout: 60000 
};

// Create a pool promise
const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('✅ Connected to SQL Server');
        pool.on('error', err => {
            console.error("⚠️ Connection Pool Error: ", err);
        });
        return pool;
    })
    .catch(err => {
        console.error('❌ Database connection failed!', err);
        process.exit(1); 
    });

module.exports = { sql, poolPromise };
