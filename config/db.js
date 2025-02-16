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
    requestTimeout: 30000
};

const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('Connected to MSSQL');
        return pool;
    })
    .catch(err => console.error('Database Connection Failed! Bad Config: ', err));

module.exports = { sql, poolPromise };
