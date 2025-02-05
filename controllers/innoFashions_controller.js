const { sql, poolPromise } = require('../config/db');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const NodeCache = require('node-cache'); 
const crypto = require('crypto')
require('dotenv').config();

// Initialize cache (set TTL to 600 seconds or 10 minutes)
const otpCache = new NodeCache({ stdTTL: 600, checkperiod: 60 });

// Function to send OTP
const sendOTP = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        host: process.env.MAIL_SERVICE,
        port: 587,
        secure: false,
        auth: {
            user: 'info@thebusstand.com',
            pass: 'bxdmbylxzlgcnbcn',
        },
    });

    await transporter.sendMail({
        from: 'info@thebusstand.com',
        to: email,
        subject: 'Password Reset OTP',
        text: `Your OTP is: ${otp}`,
    });
};

// Login Function
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: 'Email and Password are required' });

    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('email', sql.VarChar, email)
            .query('SELECT * FROM inno_fashion_tbl WHERE emailid = @email');

        if (result.recordset.length === 0) return res.status(404).json({ message: 'User not found' });

        const user = result.recordset[0];

        if (password !== user.password) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Login successful', token, user_email: user.emailid, user_name: user.user_name, userId: user.user_id });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Forgot Password Function (sending OTP)
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('email', sql.VarChar, email)
            .query('SELECT * FROM inno_fashion_tbl WHERE emailid = @email');

        if (result.recordset.length === 0) return res.status(201).json({ message: 'User not found' });

        const otp = Math.floor(100000 + Math.random() * 900000); 
        await sendOTP(email, otp);

        otpCache.set(email, otp);

        res.status(200).json({ message: 'OTP sent to your email' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Reset Password Function
exports.resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'All fields are required' });

    try {
        const cachedOTP = otpCache.get(email);

        if (!cachedOTP) return res.status(400).json({ message: 'OTP expired or not generated' });

        if (otp !== cachedOTP) return res.status(400).json({ message: 'Invalid OTP' });

        otpCache.del(email);

        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('email', sql.VarChar, email)
            .query('SELECT * FROM inno_fashion_tbl WHERE emailid = @email');

        if (result.recordset.length === 0) return res.status(201).json({ message: 'User not found' });

        await pool
            .request()
            .input('email', sql.VarChar, email)
            .input('newPassword', sql.VarChar, newPassword)
            .query('UPDATE inno_fashion_tbl SET password = @newPassword WHERE emailid = @email');

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

//innofashion invoice list api function
exports.InnofashionInvoiceList = async (req, res) => {
    try {
        const pool = await poolPromise;

        const query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(voi_invoice_no) AS voi_invoice_no,  
                    TRIM(in_invoice_no) AS in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id,
                    payment_status,
                    credit_period,
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount)+SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY in_invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM innofashion_invoice_list
                GROUP BY 
                    voi_invoice_no,
                    in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id,
                    payment_status,
                    credit_period
            )
            SELECT 
                voi_invoice_no,
                in_invoice_no,
                voi_branch_name,
                party_branch_name,
                invoice_date,
                advance_amount,
                in_advance_request_id,
                in_advance_request,
                advance_percentage,
                balance_amount,
                payment_status_id,
                payment_status,
                credit_period,
                total_amount, net_amount,
                CASE
                    WHEN net_amount >= 10000 THEN 0
                    ELSE 6
                END AS voi_advance_request_id,
                CASE
                    WHEN net_amount >= 10000 THEN 'Request'
                    ELSE 'Not Eligible'
                END AS voi_advance_request
            FROM CTE_UniqueInvoices
            WHERE row_num = 1;`;

        const result = await pool.request().query(query);

        const updates = result.recordset
            .filter(record => record.voi_advance_request_id === 6)
            .map(record => record.invoice_no);

        if (updates.length > 0) {
            const updateQuery = `
                UPDATE innofashion_invoice_list
                SET voi_advance_request_id = 6, 
                    voi_advance_request = 'Not Eligible'
                WHERE TRIM(in_invoice_no) IN (${updates.map(invoice => `'${invoice}'`).join(', ')});
            `;

            await pool.request().query(updateQuery);
        }

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error processing invoice list:', error);
        res.status(500).send('Server Error');
    }
}

//get by in_advance_request_id
exports.getInvoicesByAdvanceRequestId = async (req, res) => {
    try {
        const { in_advance_request_id } = req.params;

        const pool = await poolPromise;

        let query;
        if (parseInt(in_advance_request_id) === 8) {
            query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(voi_invoice_no) AS voi_invoice_no,  
                    TRIM(in_invoice_no) AS in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, isRead,
                    payment_status, interest_amt, interest_days,
                    credit_period, closing_date,
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount)+SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY in_invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM innofashion_invoice_list 
                WHERE
                    voi_advance_request_id = 9 AND interest_amt IS NOT NULL AND interest_amt >= 0.1
                GROUP BY 
                    voi_invoice_no,
                    in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, isRead,
                    payment_status, interest_amt, interest_days,
                    credit_period, closing_date
            )
            SELECT 
                voi_invoice_no,
                in_invoice_no,
                voi_branch_name,
                party_branch_name,
                invoice_date,
                advance_amount, adv_paid_date, request_date, comment,
                voi_advance_request_id,
                voi_advance_request,
                in_advance_request_id,
                in_advance_request,
                advance_percentage,
                balance_amount,
                payment_status_id, isRead,
                payment_status, interest_amt, interest_days,
                credit_period, closing_date,
                total_amount, net_amount
            FROM CTE_UniqueInvoices
            WHERE row_num = 1
            ORDER BY request_date DESC;
            `;
        } else if (parseInt(in_advance_request_id) === 6) {
            query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(voi_invoice_no) AS voi_invoice_no,  
                    TRIM(in_invoice_no) AS in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, isRead,
                    payment_status, interest_amt, interest_days,
                    credit_period, closing_date,
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount)+SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY in_invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM innofashion_invoice_list WHERE in_advance_request_id IN (4, 3, 2)
                GROUP BY 
                    voi_invoice_no,
                    in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, isRead,
                    payment_status, interest_amt, interest_days,
                    credit_period, closing_date
            )
            SELECT 
                voi_invoice_no,
                in_invoice_no,
                voi_branch_name,
                party_branch_name,
                invoice_date,
                advance_amount, adv_paid_date, request_date, comment,
                voi_advance_request_id,
                voi_advance_request,
                in_advance_request_id,
                in_advance_request,
                advance_percentage,
                balance_amount,
                payment_status_id, isRead,
                payment_status, interest_amt, interest_days,
                credit_period,
                total_amount, net_amount
            FROM CTE_UniqueInvoices
            WHERE row_num = 1
            ORDER BY request_date DESC;
            `;
        } else if (parseInt(in_advance_request_id) === 4) {
            query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(voi_invoice_no) AS voi_invoice_no,  
                    TRIM(in_invoice_no) AS in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, isRead,
                    payment_status, interest_amt, interest_days,
                    credit_period, closing_date,
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount)+SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY in_invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM innofashion_invoice_list WHERE in_advance_request_id IN (4)
                GROUP BY 
                    voi_invoice_no,
                    in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, isRead,
                    payment_status, interest_amt, interest_days,
                    closing_date, credit_period
            )
            SELECT 
                voi_invoice_no,
                in_invoice_no,
                voi_branch_name,
                party_branch_name,
                invoice_date,
                advance_amount, adv_paid_date, request_date, comment,
                voi_advance_request_id,
                voi_advance_request,
                in_advance_request_id,
                in_advance_request,
                advance_percentage,
                balance_amount,
                payment_status_id, isRead,
                payment_status, interest_amt, interest_days,
                credit_period, closing_date,
                total_amount, net_amount
            FROM CTE_UniqueInvoices
            WHERE row_num = 1
            ORDER BY request_date DESC;
            `;
        } else if (parseInt(in_advance_request_id) === 5) {
            query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(voi_invoice_no) AS voi_invoice_no,  
                    TRIM(in_invoice_no) AS in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, isRead,
                    payment_status, interest_amt, interest_days,
                    credit_period, closing_date,
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount)+SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY in_invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM innofashion_invoice_list WHERE in_advance_request_id IN (0, 1)
                GROUP BY 
                    voi_invoice_no,
                    in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, isRead,
                    payment_status, interest_amt, interest_days,
                    closing_date, credit_period
            )
            SELECT 
                voi_invoice_no,
                in_invoice_no,
                voi_branch_name,
                party_branch_name,
                invoice_date,
                advance_amount, adv_paid_date, request_date, comment,
                voi_advance_request_id,
                voi_advance_request,
                in_advance_request_id,
                in_advance_request,
                advance_percentage,
                balance_amount,
                payment_status_id, isRead,
                payment_status, interest_amt, interest_days,
                credit_period, closing_date,
                total_amount, net_amount
            FROM CTE_UniqueInvoices
            WHERE row_num = 1
            ORDER BY request_date DESC;
            `;
        } else if (parseInt(in_advance_request_id) === 1) {
            query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(voi_invoice_no) AS voi_invoice_no,  
                    TRIM(in_invoice_no) AS in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, isRead,
                    payment_status, interest_amt, interest_days,
                    credit_period, closing_date,
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount)+SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY in_invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM innofashion_invoice_list
                WHERE voi_advance_request_id = 2 AND advance_amount IS NOT NULL
                GROUP BY 
                    voi_invoice_no,
                    in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, isRead,
                    payment_status, interest_amt, interest_days,
                    closing_date, credit_period
            )
            SELECT 
                voi_invoice_no,
                in_invoice_no,
                voi_branch_name,
                party_branch_name,
                invoice_date,
                advance_amount, adv_paid_date, request_date, comment,
                in_advance_request_id,
                in_advance_request,
                voi_advance_request_id,
                voi_advance_request,
                advance_percentage,
                balance_amount,
                payment_status_id, isRead,
                payment_status, interest_amt, interest_days,
                credit_period, closing_date,
                total_amount, net_amount
            FROM CTE_UniqueInvoices
            WHERE row_num = 1
            ORDER BY request_date DESC;
            `;
        } else if (parseInt(in_advance_request_id) === 9) {
            query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(voi_invoice_no) AS voi_invoice_no,  
                    TRIM(in_invoice_no) AS in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, isRead,
                    payment_status, interest_amt, interest_days,
                    credit_period, closing_date,
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount)+SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY in_invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM innofashion_invoice_list
                WHERE voi_advance_request_id = 9 --OR advance_amount IS NULL
                GROUP BY 
                    voi_invoice_no,
                    in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, isRead,
                    payment_status, interest_amt, interest_days,
                    closing_date, credit_period
            )
            SELECT 
                voi_invoice_no,
                in_invoice_no,
                voi_branch_name,
                party_branch_name,
                invoice_date,
                advance_amount, adv_paid_date, request_date, comment,
                in_advance_request_id,
                in_advance_request,
                voi_advance_request_id,
                voi_advance_request,
                advance_percentage,
                balance_amount,
                payment_status_id, isRead,
                payment_status, interest_amt, interest_days,
                credit_period, closing_date,
                total_amount, net_amount
            FROM CTE_UniqueInvoices
            WHERE row_num = 1
            ORDER BY closing_date DESC;
            `;
        } else {
            query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(voi_invoice_no) AS voi_invoice_no,  
                    TRIM(in_invoice_no) AS in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, 
                    adv_paid_date, 
                    request_date, 
                    comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, 
                    isRead,
                    payment_status, 
                    interest_amt, 
                    interest_days,
                    credit_period, 
                    closing_date, 
                    rerequest_percentage, 
                    rerequest_amount, 
                    in_request_status_id, 
                    in_request_status, 
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount) + SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY in_invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM innofashion_invoice_list
                WHERE in_advance_request_id = @in_advance_request_id
                GROUP BY 
                    voi_invoice_no,
                    in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request, 
                    rerequest_percentage, 
                    rerequest_amount, 
                    in_request_status_id, 
                    in_request_status, 
                    advance_amount, 
                    adv_paid_date, 
                    request_date, 
                    comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id, 
                    isRead,
                    payment_status, 
                    interest_amt, 
                    interest_days,
                    closing_date, 
                    credit_period
            ),
            CTE_VOIInvoices AS (
                SELECT 
                    invoice_no,
                    voi_request_status_id,
                    voi_request_status,
                    ROW_NUMBER() OVER (PARTITION BY invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM voi_jeans_invoice_list
            )
            SELECT 
                CTE.voi_invoice_no,
                CTE.in_invoice_no,
                CTE.voi_branch_name,
                CTE.party_branch_name,
                CTE.invoice_date,
                CTE.advance_amount, 
                CTE.adv_paid_date, 
                CTE.request_date, 
                CTE.comment,
                CTE.in_advance_request_id,
                CTE.in_advance_request,
                CTE.voi_advance_request_id,
                CTE.voi_advance_request, 
                CTE.rerequest_percentage, 
                CTE.rerequest_amount, 
                CTE.in_request_status_id, 
                CTE.in_request_status,  
                CTE.advance_percentage,
                CTE.balance_amount,
                CTE.payment_status_id, 
                CTE.isRead,
                CTE.payment_status, 
                CTE.interest_amt, 
                CTE.interest_days,
                CTE.credit_period, 
                CTE.closing_date,
                CTE.total_amount, 
                CTE.net_amount,
                VOI.voi_request_status_id,
                VOI.voi_request_status
            FROM CTE_UniqueInvoices CTE
            LEFT JOIN CTE_VOIInvoices VOI
                ON CTE.voi_invoice_no = VOI.invoice_no
            WHERE CTE.row_num = 1 AND VOI.row_num = 1
            ORDER BY CTE.request_date DESC;                         `;
        }        

        const result = await pool
            .request()
            .input('in_advance_request_id', sql.Int, in_advance_request_id)
            .query(query);

        if (result.recordset.length === 0) {
            return res.status(201).json({ message: 'No invoices found' });
        }

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching invoice data:', error);
        res.status(500).send('Server Error');
    }
}

//search innofashions invoice list
exports.SearchInnofashionInvoice = async (req, res) => {
    const { term, in_advance_request_id } = req.params;

    if (!term || term.trim() === '') {
        return res.status(200).json({ message: 'Search term is required.' });
    }

    try {
        const pool = await poolPromise;

        let query = `
            SELECT 
                TRIM(voi_invoice_no) AS voi_invoice_no,  
                TRIM(in_invoice_no) AS in_invoice_no,
                voi_branch_name,
                party_branch_name,
                invoice_date,
                voi_advance_request_id,
                voi_advance_request,
                advance_amount, adv_paid_date,
                in_advance_request_id,
                in_advance_request,
                advance_percentage,
                balance_amount,
                payment_status_id,
                payment_status, interest_amt, interest_days,
                credit_period,
                SUM(gross_amount) AS total_amount,
                (SUM(gross_amount)+SUM(igst_amount)) AS net_amount,
                ROW_NUMBER() OVER (PARTITION BY in_invoice_no ORDER BY invoice_date DESC) AS row_num
            FROM innofashion_invoice_list
            WHERE 
                (LOWER(voi_invoice_no) LIKE LOWER(@term) 
                OR LOWER(voi_branch_name) LIKE LOWER(@term))`;

        if (in_advance_request_id) {
            const parsedInAdvanceRequestId = parseInt(in_advance_request_id);

            if (parsedInAdvanceRequestId === 8) {
                query += ` AND voi_advance_request_id = 9 AND interest_amt IS NOT NULL AND interest_amt >= 0.1 `;
            } else if (parsedInAdvanceRequestId === 6) {
                query += ` AND in_advance_request_id IN (4, 3, 2) `;
            } else if (parsedInAdvanceRequestId === 5) {
                query += ` AND in_advance_request_id IN (0, 1) `;
            } else if (parsedInAdvanceRequestId === 1) {
                query += ` AND voi_advance_request_id = 2 AND advance_amount IS NOT NULL `;
            } else if (parsedInAdvanceRequestId === 0) {
                query += ` AND (voi_advance_request_id = 9 OR advance_amount IS NULL) `;
            } else {
                query += ` AND in_advance_request_id = ${parsedInAdvanceRequestId} `;
            }
        }

        query += ` GROUP BY 
                    voi_invoice_no,
                    in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id,
                    payment_status, interest_amt, interest_days,
                    credit_period `;

        const result = await pool
            .request()
            .input('in_advance_request_id', sql.Int, in_advance_request_id)
            .input('term', sql.NVarChar, `%${term.toLowerCase()}%`)
            .query(query);

        res.status(200).json(result.recordset);

    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}

//count
exports.InnofashioncountAPI = async (req, res) => {
    try {
      const pool = await poolPromise;
  
      const query = `
      SELECT 
        COUNT(DISTINCT CASE WHEN in_advance_request_id = 0 THEN voi_invoice_no END) AS zero_make_payment_count,
        COUNT(DISTINCT CASE WHEN in_advance_request_id = 1 THEN voi_invoice_no END) AS approve_count,
        COUNT(DISTINCT CASE WHEN in_advance_request_id = 2 THEN voi_invoice_no END) AS on_hold_count,
        COUNT(DISTINCT CASE WHEN in_advance_request_id = 3 THEN voi_invoice_no END) AS reject_count,
        COUNT(DISTINCT CASE WHEN in_advance_request_id = 4 THEN voi_invoice_no END) AS four_make_payment_count
      FROM innofashion_invoice_list;`;
  
      const result = await pool.request().query(query);
  
      res.status(200).json(result.recordset);
  
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Server error' });
    }
  };

  // count of credit periods 
  exports.CountCreditPeriods = async (req, res) => {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT
                COUNT(DISTINCT CASE WHEN credit_period = 30 THEN invoice_no END) AS "COUNT_30",
                COUNT(DISTINCT CASE WHEN credit_period = 45 THEN invoice_no END) AS "COUNT_45",
                COUNT(DISTINCT CASE WHEN credit_period = 60 THEN invoice_no END) AS "COUNT_60",
                COUNT(DISTINCT CASE WHEN credit_period = 90 THEN invoice_no END) AS "COUNT_90",
                SUM(CASE WHEN credit_period = 30 THEN gross_amount + igst_amount ELSE 0 END) AS "TOTAL_NET_AMOUNT_30",
                SUM(CASE WHEN credit_period = 45 THEN gross_amount + igst_amount ELSE 0 END) AS "TOTAL_NET_AMOUNT_45",
                SUM(CASE WHEN credit_period = 60 THEN gross_amount + igst_amount ELSE 0 END) AS "TOTAL_NET_AMOUNT_60",
                SUM(CASE WHEN credit_period = 90 THEN gross_amount + igst_amount ELSE 0 END) AS "TOTAL_NET_AMOUNT_90"
            FROM voi_jeans_invoice_list; `;

        const result = await pool.request().query(query);

        res.status(200).json(result.recordset[0]);

    } catch (err) {
        console.error('Error fetching credit period stats:', err);
        res.status(500).json({ error: 'An error occurred while fetching credit period stats.' });
    }
}

  //innofashion ouletbill invoice 
  exports.getInvoicesByPaymentId = async (req, res) => {
    try {
        const { payment_status_id } = req.params;

        const pool = await poolPromise;

        let query;
            query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(voi_invoice_no) AS voi_invoice_no,  
                    TRIM(in_invoice_no) AS in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id,
                    payment_status, interest_amt, interest_days,
                    credit_period,
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount)+SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY in_invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM innofashion_outlet_bill_invoice
                WHERE
                    payment_status_id = @payment_status_id
                GROUP BY 
                    voi_invoice_no,
                    in_invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id,
                    payment_status, interest_amt, interest_days,
                    credit_period
            )
            SELECT 
                voi_invoice_no,
                in_invoice_no,
                voi_branch_name,
                party_branch_name,
                invoice_date,
                advance_amount, adv_paid_date, request_date, comment,
                voi_advance_request_id,
                voi_advance_request,
                in_advance_request_id,
                in_advance_request,
                advance_percentage,
                balance_amount,
                payment_status_id,
                payment_status, interest_amt, interest_days,
                credit_period,
                total_amount, net_amount
            FROM CTE_UniqueInvoices
            WHERE row_num = 1
            ORDER BY adv_paid_date DESC;
            `;

        const result = await pool
            .request()
            .input('payment_status_id', sql.Int, payment_status_id)
            .query(query);

        if (result.recordset.length === 0) {
            return res.status(201).json({ message: 'No invoices found' });
        }

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching invoice data:', error);
        res.status(500).send('Server Error');
    }
}

//debit note get
exports.GetDebitNote = async (req, res) => {
    try {
        const pool = await poolPromise;

        let query;
            query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(voi_invoice_no) AS voi_invoice_no,  
                    TRIM(in_invoice_no) AS in_invoice_no,
                    TRIM(debit_no) AS debit_no,
                    debit_date,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id,
                    payment_status, interest_amt, interest_days,
                    credit_period,
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount)+SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY in_invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM debit_note_tbl 
                GROUP BY 
                    voi_invoice_no,
                    in_invoice_no,
                    debit_no,
                    debit_date,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    advance_amount, adv_paid_date, request_date, comment,
                    in_advance_request_id,
                    in_advance_request,
                    advance_percentage,
                    balance_amount,
                    payment_status_id,
                    payment_status, interest_amt, interest_days,
                    credit_period
            )
            SELECT 
                voi_invoice_no,
                in_invoice_no,
                debit_no,
                debit_date,
                
                voi_branch_name,
                party_branch_name,
                invoice_date,
                advance_amount, adv_paid_date, request_date, comment,
                voi_advance_request_id,
                voi_advance_request,
                in_advance_request_id,
                in_advance_request,
                advance_percentage,
                balance_amount,
                payment_status_id,
                payment_status, interest_amt, interest_days,
                credit_period,
                total_amount, net_amount
            FROM CTE_UniqueInvoices
            WHERE row_num = 1
            ORDER BY adv_paid_date DESC;
            `;

        const result = await pool
            .request()
            .query(query);

        if (result.recordset.length === 0) {
            return res.status(201).json({ message: 'No invoices found' });
        }

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching invoice data:', error);
        res.status(500).send('Server Error');
    }
}

//put for innofashion isRead
exports.updateInnoFashionIsRead = async (req, res) => {
    try {
        const { isRead } = req.body; 
        const { voi_invoice_no } = req.params;

        const pool = await poolPromise;

        const checkQuery = `
            SELECT voi_invoice_no FROM innofashion_invoice_list WHERE voi_invoice_no = @voi_invoice_no; `;
        const checkResult = await pool.request()
            .input('voi_invoice_no', sql.VarChar, voi_invoice_no)  
            .query(checkQuery);

        if (checkResult.recordset.length === 0) {
            return res.status(404).send('Invoice not found');
        }

        const updateQuery = `
            UPDATE innofashion_invoice_list
            SET isRead = @isRead
            WHERE voi_invoice_no = @voi_invoice_no; `;

        await pool.request()
            .input('voi_invoice_no', sql.VarChar, voi_invoice_no)  
            .input('isRead', sql.Bit, isRead)  
            .query(updateQuery);

        res.status(200).send('invoice status updated');
    } catch (error) {
        console.error('Error updating invoice status:', error);
        res.status(500).send('Server Error');
    }
}
