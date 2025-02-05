const { sql, poolPromise } = require('../config/db');
require('dotenv').config();

exports.GetMasterInvoice = async (req, res) => {
    try {
        const pool = await poolPromise;

        const query = `
            SELECT *
            FROM master_invoice `

        const result = await pool
            .request()
            .query(query);

        res.status(200).json(result.recordset);

    } catch (error) {
        console.error('Error fetching invoice data:', error);
        res.status(500).send('Server Error'); 
    }
}
