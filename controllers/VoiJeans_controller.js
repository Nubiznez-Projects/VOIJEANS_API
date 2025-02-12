const { sql, poolPromise } = require('../config/db');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const NodeCache = require('node-cache'); 
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

    if (!email || !password) return res.status(400).json({ message: 'Email and Password are required' })

    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('email', sql.VarChar, email)
            .query('SELECT * FROM voi_jeans_tbl WHERE emailid = @email')

        if (result.recordset.length === 0) return res.status(404).json({ message: 'User not found' })

        const user = result.recordset[0]

        if (password !== user.password) return res.status(401).json({ message: 'Invalid credentials' })

        const token = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '1h' })
        res.status(200).json({ message: 'Login successful', token, user_email: user.emailid, user_name: user.user_name, userId: user.user_id })
    } catch (err) {
        res.status(500).json({ message: '\u274C Server error', error: err.message })
    }
}

// Forgot Password Function (sending OTP)
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('email', sql.VarChar, email)
            .query('SELECT * FROM voi_jeans_tbl WHERE emailid = @email');

        if (result.recordset.length === 0) return res.status(201).json({ message: 'User not found' })

        const otp = Math.floor(100000 + Math.random() * 900000); 
        await sendOTP(email, otp);

        otpCache.set(email, otp);

        res.status(200).json({ message: 'OTP sent to your email' });
    } catch (err) {
        res.status(500).json({ message: '\u274C Server error', error: err.message });
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
            .query('SELECT * FROM voi_jeans_tbl WHERE emailid = @email');

        if (result.recordset.length === 0) return res.status(201).json({ message: 'User not found' });

        await pool
            .request()
            .input('email', sql.VarChar, email)
            .input('newPassword', sql.VarChar, newPassword)
            .query('UPDATE voi_jeans_tbl SET password = @newPassword WHERE emailid = @email');

        res.status(200).json({ message: '\u2705 Password reset successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

//voijeans invoice list api function
exports.VoicejeansInvoiceList = async (req, res) => {
    try {
        const pool = await poolPromise;

        const query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(invoice_no) AS invoice_no,  -- Trim leading/trailing spaces
                    voi_branch_name,
                    invoice_date,
                    payment_status_id,
                    payment_status,
                    credit_period,
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount)+SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM voi_jeans_invoice_list
                GROUP BY 
                    invoice_no,
                    voi_branch_name,
                    invoice_date,
                    payment_status_id,
                    payment_status,
                    credit_period
            )
            SELECT 
                invoice_no,
                voi_branch_name,
                invoice_date,
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
                UPDATE voi_jeans_invoice_list
                SET voi_advance_request_id = 6, 
                    voi_advance_request = 'Not Eligible'
                WHERE TRIM(invoice_no) IN (${updates.map(invoice => `'${invoice}'`).join(', ')}); `;

            await pool.request().query(updateQuery);
        }

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error processing invoice list:', error);
        res.status(500).send('\u274C Server Error');
    }
}

//voijeans invoice list api function
exports.VoijeansInvoiceListByInvoiceNo = async (req, res) => {
    try {
        const { invoice_no } = req.params;

        const pool = await poolPromise;

        const invoiceQuery = `
            SELECT *
            FROM voi_jeans_invoice_list
            WHERE invoice_no = @invoice_no;`;

        const invoiceResult = await pool
            .request()
            .input('invoice_no', sql.VarChar, invoice_no)
            .query(invoiceQuery);

        if (invoiceResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        const invoice = invoiceResult.recordset[0];
        const products = invoiceResult.recordset;

        const rerequestQuery = `
            SELECT rerequest_amount, rerequest_percentage
            FROM innofashion_invoice_list
            WHERE voi_invoice_no = @invoice_no;`;

        const rerequestResult = await pool
            .request()
            .input('invoice_no', sql.VarChar, invoice_no)
            .query(rerequestQuery);

        const rerequest = rerequestResult.recordset[0] || {
            rerequest_amount: 0,
            rerequest_percentage: 0,
        };

        let totalAmount = 0;
        let totalQuantity = 0;
        let totalIgstAmount = 0;
        let totalNetAmount = 0;

        const groupedProducts = products.reduce((acc, item) => {
            const categoryKey = `${item.category}-${item.item_name}`;
            if (!acc[categoryKey]) {
                acc[categoryKey] = {
                    category_name: item.category || "",
                    item_name: item.item_name || "",
                    hsn_code: item.hsn_code || "",
                    fit: item.fit || "",
                    color: item.shade_name || "",
                    s_item_code: "",
                    m_item_code: "",
                    l_item_code: "",
                    xl_item_code: "",
                    xxl_item_code: "",
                    s_qty: 0,
                    m_qty: 0,
                    l_qty: 0,
                    xl_qty: 0,
                    xxl_qty: 0,
                    total_qty: 0,
                    total_amt: 0,
                    per_amt: item.mrp || 0,
                    igst_per: item.igst_percentage || 0,
                    igst_amt: 0,
                };
            }

            const sizeMap = {
                S: "s",
                M: "m",
                L: "l",
                XL: "xl",
                XXL: "xxl",
            };

            const sizeField = sizeMap[item.size] || "other";
            const existingEntry = acc[categoryKey];

            existingEntry[`${sizeField}_item_code`] = item.item_code || "";
            existingEntry[`${sizeField}_qty`] += item.sales_quantity || 0;
            existingEntry.total_qty += item.sales_quantity || 0;

            existingEntry.total_amt += item.gross_amount || 0;
            existingEntry.igst_amt += item.igst_amount || 0;

            totalAmount += item.gross_amount || 0;
            totalQuantity += item.sales_quantity || 0;
            totalIgstAmount += item.igst_amount || 0;
            totalNetAmount += (item.gross_amount || 0) + (item.igst_amount || 0);

            return acc;
        }, {});

        const productList = Object.values(groupedProducts).map(product => ({
            ...product,
            total_amt: parseFloat(product.total_amt.toFixed(2)),
        }));

        const response = {
            invoice_no: invoice.invoice_no || "",
            invoice_date: invoice.invoice_date || "",
            voi_branch_name: invoice.voi_branch_name || "",
            voi_gst_no: invoice.voi_gst_no || "",
            voi_address: invoice.voi_address || "",
            voi_state: invoice.voi_state || "",
            voi_email: invoice.voi_emailid || "",
            voi_phone: invoice.voi_phone || "",
            party_branch_name: invoice.party_branch_name || "",
            party_gst_no: invoice.party_gst_no || "",
            party_address: invoice.party_address || "",
            party_state: invoice.party_state || "",
            party_email: invoice.party_emailid || "",
            party_phone: invoice.party_phone || "",
            total_amount: parseFloat(totalAmount.toFixed(2)),
            total_quantity: totalQuantity,
            total_igst_amt: parseFloat(totalIgstAmount.toFixed(2)),
            net_amount: parseFloat(totalNetAmount.toFixed(2)),
            credit_period: invoice.credit_period,
            rerequest_amount: parseFloat((rerequest.rerequest_amount || 0).toFixed(2)),
            rerequest_percentage: parseFloat((rerequest.rerequest_percentage || 0).toFixed(2)),
            product_list: productList,
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching invoice list:', error);
        res.status(500).send('\u274C Server Error');
    }
};


//update function for updating invoice list
exports.updateInvoiceDetails = async (req, res) => {
    try {
        const { invoice_no } = req.params;
        const {
            voi_advance_request_id,
            voi_advance_request,
            advance_amount,
            in_advance_request_id,
            in_advance_request,
            advance_percentage,
            balance_amount,
            credit_period
        } = req.body;

        const pool = await poolPromise;

        const requestDate = new Date();

        const query = `
                UPDATE voi_jeans_invoice_list
                SET 
                    voi_advance_request_id = COALESCE(@voi_advance_request_id, voi_advance_request_id),
                    voi_advance_request = COALESCE(@voi_advance_request, voi_advance_request),
                    advance_amount = COALESCE(@advance_amount, advance_amount),
                    in_advance_request_id = COALESCE(@in_advance_request_id, in_advance_request_id),
                    in_advance_request = COALESCE(@in_advance_request, in_advance_request),
                    advance_percentage = COALESCE(@advance_percentage, advance_percentage),
                    balance_amount = COALESCE(@balance_amount, balance_amount),
                    credit_period = COALESCE(@credit_period, credit_period),
                    request_date = COALESCE(@requestDate, request_date)
                WHERE 
                    invoice_no = @invoice_no; `;

        const transaction = pool.transaction();
        await transaction.begin();

        const result1 = await transaction
            .request()
            .input('voi_advance_request_id', sql.Int, voi_advance_request_id)
            .input('voi_advance_request', sql.VarChar, voi_advance_request)
            .input('advance_amount', sql.Decimal, advance_amount)
            .input('in_advance_request_id', sql.Int, in_advance_request_id)
            .input('in_advance_request', sql.VarChar, in_advance_request)
            .input('advance_percentage', sql.Decimal, advance_percentage)
            .input('balance_amount', sql.Decimal, balance_amount)
            .input('credit_period', sql.Int, credit_period)
            .input('requestDate', sql.DateTime, requestDate)
            .input('invoice_no', sql.VarChar, invoice_no)
            .query(query);

        if (result1.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Invoice not found or no changes made' });
        }

        if (voi_advance_request_id === 1) {
            const notificationQuery = `
                INSERT INTO innofashion_notifications (invoice_no, notification_type, notification_date, message, is_read, created_at)
                VALUES (@invoice_no, 'Advance Request', @notificationDate, @message, 0, GETDATE());`;

            await transaction
                .request()
                .input('invoice_no', sql.VarChar, invoice_no)
                .input('notificationDate', sql.DateTime, requestDate)
                .input('message', sql.NVarChar, `${advance_percentage}% Advance requested for invoice ${invoice_no}`)
                .query(notificationQuery);
        }

        await transaction.commit();

        res.status(200).json({ message: '\u2705 Invoice details updated successfully' });
    } catch (error) {
        console.error('Error updating invoice details:', error);
        res.status(500).send('\u274C Server Error');
    }
}

//get by voi_advance_request_id
exports.getInvoicesByAdvanceRequestId = async (req, res) => {
    try {
        const { voi_advance_request_id } = req.params;
        const pool = await poolPromise;

        let query;

        if (parseInt(voi_advance_request_id) === 8) {
            query = `
                WITH CTE_UniqueInvoices AS (
                    SELECT TRIM(invoice_no) AS invoice_no, voi_branch_name, party_branch_name, invoice_date,
                           in_advance_request_id, in_advance_request, voi_advance_request_id,
                           voi_advance_request, isRead,
                           payment_status_id, payment_status, adv_paid_date, request_date, comment, interest_amt, interest_days, advance_amount,
                           advance_percentage, credit_period, balance_amount, SUM(gross_amount) AS total_amount, closing_date,
                           (SUM(gross_amount) + SUM(igst_amount)) AS net_amount,
                           ROW_NUMBER() OVER (PARTITION BY invoice_no ORDER BY invoice_date DESC) AS row_num
                    FROM voi_jeans_invoice_list
                    WHERE voi_advance_request_id = 9 AND interest_amt IS NOT NULL AND interest_amt >= 0.1
                    GROUP BY invoice_no, voi_branch_name, party_branch_name, invoice_date, in_advance_request_id, in_advance_request, payment_status_id, isRead,
                             payment_status, adv_paid_date, request_date, comment, interest_amt, interest_days, advance_amount, advance_percentage, closing_date,
                             credit_period, balance_amount, voi_advance_request, voi_advance_request_id
                )
                SELECT invoice_no, voi_branch_name, party_branch_name, invoice_date, in_advance_request_id, in_advance_request, voi_advance_request_id,
                voi_advance_request, payment_status_id, payment_status, isRead,
                       interest_amt, interest_days, advance_amount, adv_paid_date,  request_date, comment, advance_percentage, credit_period, closing_date,
                       balance_amount, total_amount, net_amount
                FROM CTE_UniqueInvoices WHERE row_num = 1
                ORDER BY request_date DESC;`; 
        } else if (parseInt(voi_advance_request_id) === 10) {
            query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(invoice_no) AS invoice_no,
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
                    voi_request_status_id, 
                    voi_request_status, 
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount) + SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM voi_jeans_invoice_list
                WHERE voi_request_status_id = 2
                GROUP BY 
                    invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request, 
                    voi_request_status_id, 
                    voi_request_status, 
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
            CTE_InnoFashionInvoices AS (
                SELECT 
                    voi_invoice_no,
                    rerequest_percentage, 
                    rerequest_amount, 
                    in_request_status_id,
                    in_request_status,
                    ROW_NUMBER() OVER (PARTITION BY voi_invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM innofashion_invoice_list
            )
            SELECT 
                CTE.invoice_no,
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
                CTE.voi_request_status_id, 
                CTE.voi_request_status,  
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
                INF.rerequest_percentage, 
                INF.rerequest_amount, 
                INF.in_request_status_id,
                INF.in_request_status
            FROM CTE_UniqueInvoices CTE
            LEFT JOIN CTE_InnoFashionInvoices INF
                ON CTE.invoice_no = INF.voi_invoice_no
            WHERE CTE.row_num = 1 AND INF.row_num = 1
            ORDER BY CTE.request_date DESC; `; 
            } else if (parseInt(voi_advance_request_id) === 9) {
            query = `
                WITH CTE_UniqueInvoices AS (
                    SELECT TRIM(invoice_no) AS invoice_no, voi_branch_name, party_branch_name, invoice_date,
                           in_advance_request_id, in_advance_request, voi_advance_request_id,
                           voi_advance_request, isRead,
                           payment_status_id, payment_status, adv_paid_date, request_date, comment, interest_amt, interest_days, advance_amount,
                           advance_percentage, credit_period, balance_amount, SUM(gross_amount) AS total_amount, closing_date,
                           (SUM(gross_amount) + SUM(igst_amount)) AS net_amount,
                           ROW_NUMBER() OVER (PARTITION BY invoice_no ORDER BY invoice_date DESC) AS row_num
                    FROM voi_jeans_invoice_list
                    WHERE voi_advance_request_id = 9
                    GROUP BY invoice_no, voi_branch_name, party_branch_name, invoice_date, in_advance_request_id, in_advance_request, payment_status_id, isRead,
                             payment_status, adv_paid_date, request_date, comment, interest_amt, interest_days, advance_amount, advance_percentage, closing_date,
                             credit_period, balance_amount, voi_advance_request, voi_advance_request_id
                )
                SELECT invoice_no, voi_branch_name, party_branch_name, invoice_date, in_advance_request_id, in_advance_request, voi_advance_request_id,
                voi_advance_request, payment_status_id, payment_status, isRead,
                       interest_amt, interest_days, advance_amount, adv_paid_date,  request_date, comment, advance_percentage, credit_period, closing_date,
                       balance_amount, total_amount, net_amount
                FROM CTE_UniqueInvoices WHERE row_num = 1
                ORDER BY request_date DESC;`; 
        } else if (parseInt(voi_advance_request_id) === 7) {
            query = `
                WITH CTE_UniqueInvoices AS (
                    SELECT TRIM(invoice_no) AS invoice_no, voi_branch_name, party_branch_name, invoice_date,
                           in_advance_request_id, in_advance_request, voi_advance_request_id,
                           voi_advance_request, isRead,
                           payment_status_id, payment_status, adv_paid_date,  request_date, comment, interest_amt, interest_days, advance_amount,
                           advance_percentage, credit_period, balance_amount, SUM(gross_amount) AS total_amount, closing_date,
                           (SUM(gross_amount) + SUM(igst_amount)) AS net_amount,
                           ROW_NUMBER() OVER (PARTITION BY invoice_no ORDER BY invoice_date DESC) AS row_num
                    FROM voi_jeans_invoice_list
                    WHERE voi_advance_request_id NOT IN (0, 6)
                    GROUP BY invoice_no, voi_branch_name, party_branch_name, invoice_date, in_advance_request_id, in_advance_request, payment_status_id, isRead,
                             payment_status, adv_paid_date,  request_date, comment, interest_amt, interest_days, advance_amount, advance_percentage, closing_date,
                             credit_period, balance_amount, voi_advance_request, voi_advance_request_id
                )
                SELECT invoice_no, voi_branch_name, party_branch_name, invoice_date, in_advance_request_id, in_advance_request, voi_advance_request_id,
                voi_advance_request, payment_status_id, payment_status, isRead,
                       interest_amt, interest_days, advance_amount, adv_paid_date,  request_date, comment, advance_percentage, credit_period, closing_date,
                       balance_amount, total_amount, net_amount
                FROM CTE_UniqueInvoices WHERE row_num = 1
                ORDER BY request_date DESC;`;
        } else if (parseInt(voi_advance_request_id) === 5) {
            query = `
            WITH CTE_UniqueInvoices AS (
                SELECT TRIM(invoice_no) AS invoice_no, voi_branch_name, party_branch_name, invoice_date,
                       in_advance_request_id, in_advance_request, voi_advance_request_id,
                       voi_advance_request, isRead, payment_status_id, payment_status, adv_paid_date,
                       request_date, comment, interest_amt, interest_days, advance_amount,
                       advance_percentage, credit_period, balance_amount, SUM(gross_amount) AS total_amount,
                       closing_date, (SUM(gross_amount) + SUM(igst_amount)) AS net_amount,
                       ROW_NUMBER() OVER (PARTITION BY invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM voi_jeans_invoice_list
                WHERE voi_advance_request_id NOT IN (1, 3)
                GROUP BY invoice_no, voi_branch_name, party_branch_name, invoice_date, in_advance_request_id,
                         in_advance_request, payment_status_id, isRead, payment_status, adv_paid_date,
                         request_date, comment, interest_amt, interest_days, advance_amount,
                         advance_percentage, closing_date, credit_period, balance_amount,
                         voi_advance_request, voi_advance_request_id
            )
            SELECT invoice_no, voi_branch_name, party_branch_name, invoice_date, in_advance_request_id,
                   in_advance_request, voi_advance_request_id, voi_advance_request, payment_status_id,
                   payment_status, isRead, interest_amt, interest_days, advance_amount, adv_paid_date,
                   request_date, comment, advance_percentage, credit_period, closing_date, balance_amount,
                   total_amount, net_amount,
                   CASE WHEN net_amount <= 10000 THEN 6 ELSE voi_advance_request_id END AS computed_voi_advance_request_id
            FROM CTE_UniqueInvoices
            WHERE row_num = 1
            ORDER BY request_date DESC;`; 
        } else if (parseInt(voi_advance_request_id) === 6) {
            query = `
                WITH CTE_UniqueInvoices AS (
                    SELECT TRIM(invoice_no) AS invoice_no, voi_branch_name, party_branch_name, invoice_date,
                           in_advance_request_id, in_advance_request, voi_advance_request_id,
                           voi_advance_request, isRead,
                           payment_status_id, payment_status, adv_paid_date,  request_date, comment, interest_amt, interest_days, advance_amount,
                           advance_percentage, credit_period, balance_amount, SUM(gross_amount) AS total_amount, closing_date,
                           (SUM(gross_amount) + SUM(igst_amount)) AS net_amount,
                           ROW_NUMBER() OVER (PARTITION BY invoice_no ORDER BY invoice_date DESC) AS row_num
                    FROM voi_jeans_invoice_list
                    WHERE voi_advance_request_id <> 0 AND advance_amount IS NULL
                    GROUP BY invoice_no, voi_branch_name, party_branch_name, invoice_date, in_advance_request_id, in_advance_request, payment_status_id, isRead,
                             payment_status, adv_paid_date,  request_date, comment, interest_amt, interest_days, advance_amount, advance_percentage, closing_date,
                             credit_period, balance_amount, voi_advance_request, voi_advance_request_id
                )
                SELECT invoice_no, voi_branch_name, party_branch_name, invoice_date, in_advance_request_id, in_advance_request, voi_advance_request_id,
                voi_advance_request, payment_status_id, payment_status, isRead,
                       interest_amt, interest_days, advance_amount, adv_paid_date,  request_date, comment, advance_percentage, credit_period,
                       balance_amount, total_amount, net_amount, closing_date,
                       CASE WHEN net_amount <= 10000 THEN 6 ELSE voi_advance_request_id END AS voi_advance_request_id
                FROM CTE_UniqueInvoices WHERE row_num = 1
                ORDER BY request_date DESC;`; 
        } else if (parseInt(voi_advance_request_id) === 3 || parseInt(voi_advance_request_id) === 4) {
            query = `
            WITH CTE_UniqueInvoices AS (
                SELECT 
                    TRIM(invoice_no) AS invoice_no,
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
                    voi_request_status_id, 
                    voi_request_status, 
                    SUM(gross_amount) AS total_amount,
                    (SUM(gross_amount) + SUM(igst_amount)) AS net_amount,
                    ROW_NUMBER() OVER (PARTITION BY invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM voi_jeans_invoice_list
                WHERE voi_advance_request_id = @voi_advance_request_id
                GROUP BY 
                    invoice_no,
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request, 
                    voi_request_status_id, 
                    voi_request_status, 
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
            CTE_InnoFashionInvoices AS (
                SELECT 
                    voi_invoice_no,
                    rerequest_percentage, 
                    rerequest_amount, 
                    in_request_status_id,
                    in_request_status,
                    ROW_NUMBER() OVER (PARTITION BY voi_invoice_no ORDER BY invoice_date DESC) AS row_num
                FROM innofashion_invoice_list
            )
            SELECT 
                CTE.invoice_no,
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
                CTE.voi_request_status_id, 
                CTE.voi_request_status,  
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
                INF.rerequest_percentage, 
                INF.rerequest_amount, 
                INF.in_request_status_id,
                INF.in_request_status
            FROM CTE_UniqueInvoices CTE
            LEFT JOIN CTE_InnoFashionInvoices INF
                ON CTE.invoice_no = INF.voi_invoice_no
            WHERE CTE.row_num = 1 AND INF.row_num = 1
            ORDER BY CTE.request_date DESC;            `; 
        }
        else {
            query = `
                WITH CTE_UniqueInvoices AS (
                    SELECT TRIM(invoice_no) AS invoice_no, voi_branch_name, party_branch_name, invoice_date,
                           in_advance_request_id, in_advance_request, voi_advance_request_id,
                           voi_advance_request, isRead,
                           payment_status_id, payment_status, adv_paid_date,  request_date, comment, interest_amt, interest_days, advance_amount,
                           advance_percentage, credit_period, balance_amount, SUM(gross_amount) AS total_amount, closing_date,
                           (SUM(gross_amount) + SUM(igst_amount)) AS net_amount,
                           ROW_NUMBER() OVER (PARTITION BY invoice_no ORDER BY invoice_date DESC) AS row_num
                    FROM voi_jeans_invoice_list
                    WHERE voi_advance_request_id = @voi_advance_request_id
                    GROUP BY invoice_no, voi_branch_name, party_branch_name, invoice_date, in_advance_request_id, in_advance_request, payment_status_id, isRead,
                             payment_status, adv_paid_date,  request_date, comment, interest_amt, interest_days, advance_amount, advance_percentage,
                             credit_period, closing_date, balance_amount, voi_advance_request, voi_advance_request_id
                )
                SELECT invoice_no, voi_branch_name, party_branch_name, invoice_date, in_advance_request_id, in_advance_request, voi_advance_request_id,
                voi_advance_request, payment_status_id, payment_status, isRead,
                       interest_amt, interest_days, advance_amount, adv_paid_date,  request_date, comment, advance_percentage, credit_period, closing_date,
                       balance_amount, total_amount, net_amount
                FROM CTE_UniqueInvoices WHERE row_num = 1
                ORDER BY request_date DESC;`; 
        }

        const result = await pool
            .request()
            .input('voi_advance_request_id', sql.Int, voi_advance_request_id)
            .query(query);

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("⚠️ Error fetching invoice data:", error);

        if (error.code === 'ECONNCLOSED') {
            console.log("�� Retrying query due to closed connection...");
            try {
                const pool = await poolPromise; 
                const result = await pool.request()
                    .input('voi_advance_request_id', sql.Int, req.params.voi_advance_request_id)
                    .query('SELECT * FROM voi_jeans_invoice_list WHERE voi_advance_request_id = @voi_advance_request_id');

                return res.status(200).json(result.recordset);
            } catch (retryError) {
                console.error("❌ Retried query failed:", retryError);
                return res.status(500).json({ message: "Database connection error", error: retryError });
            }
        }

        res.status(500).json({ message: "Internal server error", error });
    }
}

exports.getVoiInvoiceListByInvoiceNo = async (req, res) => {
    try {
        const { invoice_no } = req.params;

        if (!invoice_no) {
            return res.status(400).send({ message: "Invoice number is required" });
        }

        const pool = await poolPromise;

        const invoiceQuery = `
            SELECT 
                TRIM(invoice_no) AS invoice_no,
                invoice_date,
                voi_branch_name,
                party_gst_no,
                voi_address,
                voi_state,
                voi_emailid,
                voi_phone
            FROM voi_jeans_invoice_list
            WHERE TRIM(invoice_no) = @invoice_no; `;

        const productQuery = `
            SELECT 
                category AS category_name,
                item_name,
                item_code,
                hsn_code,
                fit,
                shade_name AS color,
                CAST(gross_amount AS DECIMAL(10, 2)) AS amt,  
                size,
                mrp,
                sales_quantity AS qty,
                CASE 
                    WHEN sales_quantity = 0 THEN 0  
                    ELSE CAST(gross_amount / sales_quantity AS DECIMAL(10, 2)) 
                END AS rate
            FROM voi_jeans_invoice_list
            WHERE TRIM(invoice_no) = @invoice_no;
     `;

        const invoiceResult = await pool.request()
            .input('invoice_no', invoice_no)
            .query(invoiceQuery);

        if (invoiceResult.recordset.length === 0) {
            return res.status(404).send({ message: "Invoice not found" });
        }

        const invoiceDetails = invoiceResult.recordset[0];

        const productResult = await pool.request()
            .input('invoice_no', invoice_no)
            .query(productQuery);

        const response = {
            invoice_no: invoiceDetails.invoice_no,
            invoice_date: invoiceDetails.invoice_date,
            party_name: invoiceDetails.party_name,
            party_gst_no: invoiceDetails.party_gst,
            address: invoiceDetails.address,
            state: invoiceDetails.state,
            email: invoiceDetails.emailid,
            phone: invoiceDetails.phone,
            product_list: productResult.recordset,
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching invoice details:', error);
        res.status(500).send('\u274C Server Error');
    }
};

exports.getVoiInvoiceListHsnCode = async (req, res) => {
    try {
        const { invoice_no } = req.params;
        if (!invoice_no) {
            return res.status(400).send('Invoice number is required');
        }

        const pool = await poolPromise;

        const query = `
            SELECT 
                hsn_code,
                SUM(sales_quantity) AS total_qty,
                MAX([cgst%]) AS cgst,
                MAX([sgst%]) AS sgst,
                SUM(mrp) AS MRP,
                MAX(igst_percentage) AS igst,
                SUM(taxable_amount) AS tax_amt,
                SUM(igst_amount) AS igst_amt,
                SUM(taxable_amount + igst_amount) AS net_amt
            FROM voi_jeans_invoice_list
            WHERE invoice_no = @invoice_no
            GROUP BY hsn_code; `;

        const result = await pool
            .request()
            .input('invoice_no', invoice_no)
            .query(query);

        const response = {
            total_qty: 0,
            total_mrp: 0,
            total_tax_amt: 0,
            total_igst_amt: 0,
            total_net_amt: 0,
            hsn_list: [],
        };

        result.recordset.forEach(record => {
            const hsnData = {
                hsn_code: record.hsn_code || "",
                total_qty: Math.round(record.total_qty || 0), 
                cgst: record.cgst ? record.cgst.toFixed(2) : "0.00",
                sgst: record.sgst ? record.sgst.toFixed(2) : "0.00",
                igst: record.igst ? record.igst.toFixed(2) : "0.00",
                mrp: record.MRP ? record.MRP.toFixed(2) : "0.00",
                tax_amt: record.tax_amt ? record.tax_amt.toFixed(2) : "0.00",
                igst_amt: record.igst_amt ? record.igst_amt.toFixed(2) : "0.00",
                net_amt: record.net_amt ? record.net_amt.toFixed(2) : "0.00",
            };

            response.total_qty += Math.round(record.total_qty || 0); 
            response.total_mrp += record.MRP || 0;
            response.total_tax_amt += record.tax_amt || 0;
            response.total_igst_amt += record.igst_amt || 0;
            response.total_net_amt += record.net_amt || 0;

            response.hsn_list.push(hsnData);
        });

        response.total_tax_amt = response.total_tax_amt.toFixed(2);
        response.total_igst_amt = response.total_igst_amt.toFixed(2);
        response.total_net_amt = response.total_net_amt.toFixed(2);

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching HSN code data:', error);
        res.status(500).send('\u274C Server Error');
    }
}

//update function for updating invoice list
exports.updateRequestStatus = async (req, res) => {
    try {
        const { invoice_no } = req.params;
        const {
            voi_advance_request_id,
            voi_advance_request,
            in_advance_request_id,
            in_advance_request,
            payment_status_id,
            payment_status,
            voi_request_status_id,
            voi_request_status,
            in_request_status_id,
            in_request_status, rerequest_amount, rerequest_percentage,
            comment
        } = req.body;

        const pool = await poolPromise;

        const requestDate = new Date();
        const closingDate = new Date();

        const query = `
            UPDATE voi_jeans_invoice_list
            SET 
                voi_advance_request_id = @voi_advance_request_id,
                voi_advance_request = @voi_advance_request,
                in_advance_request_id = @in_advance_request_id,
                in_advance_request = @in_advance_request,
                payment_status_id = COALESCE(@payment_status_id, payment_status_id),
                payment_status = COALESCE(@payment_status, payment_status),
                request_date = @requestDate,
                comment = COALESCE(@comment, comment),
                voi_request_status_id = @voi_request_status_id,
                voi_request_status = @voi_request_status,
                closing_date = CASE 
                                    WHEN @voi_advance_request_id = 9 THEN COALESCE(@closingDate, closing_date)
                                    ELSE closing_date
                                END
            WHERE invoice_no = @invoice_no; `;

        const transaction = pool.transaction();
        await transaction.begin();

        const result1 = await transaction
            .request()
            .input('voi_advance_request_id', sql.Int, voi_advance_request_id)
            .input('voi_advance_request', sql.VarChar, voi_advance_request)
            .input('in_advance_request_id', sql.Int, in_advance_request_id)
            .input('in_advance_request', sql.VarChar, in_advance_request)
            .input('payment_status_id', sql.Int, payment_status_id)
            .input('payment_status', sql.NVarChar, payment_status)
            .input('invoice_no', sql.VarChar, invoice_no)
            .input('requestDate', sql.DateTime, requestDate)
            .input('comment', sql.VarChar, comment)
            .input('voi_request_status_id', sql.Int, voi_request_status_id)
            .input('voi_request_status', sql.VarChar, voi_request_status)
            .input('closingDate', sql.DateTime, closingDate)
            .query(query);

        if (result1.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Invoice not found or no changes made' });
        }

        const query2 = `
            UPDATE innofashion_invoice_list
            SET 
                request_date = @requestDate,
                in_request_status_id = @in_request_status_id,
                in_request_status = @in_request_status,
                rerequest_percentage = COALESCE(@rerequest_percentage, rerequest_percentage),
                rerequest_amount = COALESCE(@rerequest_amount, rerequest_amount),
                closing_date = CASE 
                                    WHEN @voi_advance_request_id = 9 THEN COALESCE(@closingDate, closing_date)
                                    ELSE closing_date
                                END
            WHERE voi_invoice_no = @invoice_no;
        `;

        const rerequestPercentage = parseFloat(req.body.rerequest_percentage);
        const rerequestAmount = parseFloat(req.body.rerequest_amount);

        const result2 = await transaction
            .request()
            .input('voi_advance_request_id', sql.Int, voi_advance_request_id)
            .input('invoice_no', sql.VarChar, invoice_no)
            .input('requestDate', sql.DateTime, requestDate)
            .input('in_request_status_id', sql.Int, in_request_status_id)
            .input('in_request_status', sql.VarChar, in_request_status)
            .input('rerequest_percentage', sql.Float, rerequestPercentage || null)
            .input('rerequest_amount', sql.Decimal, rerequestAmount || null)
            .input('closingDate', sql.DateTime, closingDate)
            .query(query2)

        if (result2.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Failed to update innofashion_invoice_list' });
        }

        let notificationMessage;
        let advancePercentage;

        if (in_advance_request_id === 1 || in_advance_request_id === 2 || in_advance_request_id === 3) {
            const advancePercentageQuery = `
                SELECT advance_percentage FROM voi_jeans_invoice_list WHERE invoice_no = @invoice_no;
            `;
            const advanceResult = await transaction.request()
                .input('invoice_no', sql.VarChar, invoice_no)
                .query(advancePercentageQuery);

            advancePercentage = advanceResult.recordset[0]?.advance_percentage || 0;
        }

        if (in_advance_request_id === 1) {
            notificationMessage = `${advancePercentage}% Advance for this invoice ${invoice_no} is Approved`;
        } else if (in_advance_request_id === 2) {
            notificationMessage = `${advancePercentage}% Advance for this invoice ${invoice_no} is on Hold`;
        } else if (in_advance_request_id === 3) {
            notificationMessage = `${advancePercentage}% Advance for this invoice ${invoice_no} is Rejected`;
        }

        if (notificationMessage) {
            const notificationQuery = `
                INSERT INTO voi_jeans_notifications (invoice_no, notification_type, notification_date, message, is_read, created_at)
                VALUES (@invoice_no, @notification_type, @notification_date, @message, 0, @created_at);
            `;

            await transaction.request()
                .input('invoice_no', sql.VarChar, invoice_no)
                .input('notification_type', sql.VarChar, 'Advance Status Update')
                .input('notification_date', sql.DateTime, requestDate)
                .input('message', sql.NVarChar, notificationMessage)
                .input('created_at', sql.DateTime, new Date())
                .query(notificationQuery);
        }

        await transaction.commit();

        res.status(200).json({ message: '\u2705 Invoice details updated successfully' });
    } catch (error) {
        console.error('Error updating invoice details:', error);
        res.status(500).send('\u274C Server Error');
    }
}

//search voi jeans invoice list
exports.SearchVoiJeansInvoice = async (req, res) => {
    const { term, voi_advance_request_id } = req.params;  

    if (!term || term.trim() === '') {
        return res.status(200).json({ message: 'Search term is required.' });
    }

    try {
        const pool = await poolPromise;

        let query = `
            SELECT 
                TRIM(invoice_no) AS invoice_no,  
                voi_branch_name,
                party_branch_name,
                invoice_date,
                voi_advance_request_id,
                voi_advance_request,
                in_advance_request_id,
                in_advance_request,
                payment_status_id,
                payment_status, 
                interest_amt, 
                interest_days,
                advance_amount, 
                adv_paid_date,
                advance_percentage,
                credit_period,
                balance_amount,
                SUM(gross_amount) AS total_amount,
                (SUM(gross_amount)+SUM(igst_amount)) AS net_amount,
                ROW_NUMBER() OVER (PARTITION BY invoice_no ORDER BY invoice_date DESC) AS row_num
            FROM voi_jeans_invoice_list
            WHERE 
                (LOWER(invoice_no) LIKE LOWER(@term) 
                OR LOWER(voi_branch_name) LIKE LOWER(@term)) `;

        if (voi_advance_request_id) {
            const parsedVoiAdvanceRequestId = parseInt(voi_advance_request_id);

            if (parsedVoiAdvanceRequestId === 8) {
                query += ` AND voi_advance_request_id = 9 AND interest_amt IS NOT NULL AND interest_amt >= 0.1 `;
            } else if (parsedVoiAdvanceRequestId === 7) {
                query += ` AND voi_advance_request_id NOT IN (0, 6) `;
            } else if (parsedVoiAdvanceRequestId === 6) {
                query += ` AND voi_advance_request_id = 6 AND advance_amount IS NULL `;
            } else if (parsedVoiAdvanceRequestId === 5) {
                query += ` AND voi_advance_request_id NOT IN (1, 3) `;
            } else if (parsedVoiAdvanceRequestId === 3 || parsedVoiAdvanceRequestId === 4) {
                query += ` AND voi_advance_request_id = ${parsedVoiAdvanceRequestId} AND advance_amount IS NOT NULL `;
            } else {
                query += ` AND voi_advance_request_id = ${parsedVoiAdvanceRequestId} `;
            }
        }

        query += ` GROUP BY 
                    invoice_no,  
                    voi_branch_name,
                    party_branch_name,
                    invoice_date,
                    voi_advance_request_id,
                    voi_advance_request,
                    in_advance_request_id,
                    in_advance_request,
                    payment_status_id,
                    payment_status, 
                    interest_amt, 
                    interest_days,
                    advance_amount, 
                    adv_paid_date,
                    advance_percentage,
                    credit_period,
                    balance_amount `;

        const result = await pool
            .request()
            .input('term', sql.NVarChar, `%${term.toLowerCase()}%`) 
            .input('voi_advance_request_id', sql.Int, voi_advance_request_id)
            .query(query);

        res.status(200).json(result.recordset);

    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ message: '\u274C Internal Server Error', error: error.message });
    }
}

//interest calculation API
exports.calculateDailyInterest = async () => {
    try {
        const pool = await poolPromise;

        const fetchAndUpdateQuery = `
            SELECT 
                'voi_jeans_invoice_list' AS table_name, 
                id, 
                advance_amount, 
                interest_amt, 
                ISNULL(interest_days, 0) AS interest_days, 
                adv_paid_date,
                DATEDIFF(DAY, adv_paid_date, GETDATE()) AS full_days_diff,
                DATEDIFF(HOUR, adv_paid_date, GETDATE()) % 24 AS partial_hours_diff
            FROM voi_jeans_invoice_list
            WHERE 
                adv_paid_date IS NOT NULL AND closing_date IS NULL
            UNION ALL
            SELECT 
                'innofashion_invoice_list' AS table_name, 
                id, 
                advance_amount, 
                interest_amt, 
                ISNULL(interest_days, 0) AS interest_days, 
                adv_paid_date,
                DATEDIFF(DAY, adv_paid_date, GETDATE()) AS full_days_diff,
                DATEDIFF(HOUR, adv_paid_date, GETDATE()) % 24 AS partial_hours_diff
            FROM innofashion_invoice_list
            WHERE 
                adv_paid_date IS NOT NULL AND closing_date IS NULL; `;

        const result = await pool.request().query(fetchAndUpdateQuery);

        if (result.recordset.length > 0) {
            for (const row of result.recordset) {
                const totalDays = row.full_days_diff + (row.partial_hours_diff / 24);

                const roundedDays = totalDays >= Math.floor(totalDays) + 1 ? Math.ceil(totalDays) : Math.floor(totalDays);

                const newInterestAmt = (row.advance_amount || 0) * (24.0 /(100* 365.0)) * roundedDays;
                const totalInterestAmt = newInterestAmt;

                const updateQuery = `
                    UPDATE ${row.table_name}
                    SET 
                        interest_amt = ${totalInterestAmt},
                        interest_days = ${roundedDays}
                    WHERE id = ${row.id};
                `;
                await pool.request().query(updateQuery);
            }
        } else {
            console.log('No records to update for interest calculation.');
        }
    } catch (error) {
        console.error('Error calculating daily interest:', error);
    }
}

//debit note
exports.debitNote = async (req, res) => {
    const { voi_invoice_no } = req.params; 

    if (!voi_invoice_no) {
        return res.status(400).send({ message: 'Invoice number is required.' });
    }

    try {
        const pool = await poolPromise;

        const query = `
                    SELECT 
                    voi_invoice_no,
                    invoice_date, 
                    in_invoice_no,
                    debit_no, 
                    debit_date,
                    --adv_paid_date,
                    SUM(COALESCE(sales_quantity, 0)) AS total_qty,
                    SUM(COALESCE(gross_amount, 0) + COALESCE(igst_amount, 0) + COALESCE(cgst_amount, 0) + COALESCE(sgst_amount, 0)) AS total_invoice_amt,
                    COALESCE(advance_amount, 0) AS advance_amount,
                    COALESCE(interest_days, 0) AS interest_total_days,
                    COALESCE(interest_amt, 0) AS interest_amt,
                    (COALESCE(interest_amt, 0) / NULLIF(COALESCE(interest_days, 0), 0)) AS interest_per_day_amt,
                    (SUM(COALESCE(gross_amount, 0) + COALESCE(igst_amount, 0) + COALESCE(cgst_amount, 0) + COALESCE(sgst_amount, 0)) 
                    - COALESCE(advance_amount, 0) - COALESCE(interest_amt, 0)) AS net_amt,
                    SUM(COALESCE(mrp, 0)) AS total_mrp_amt
                FROM innofashion_invoice_list 
                WHERE voi_invoice_no = @voi_invoice_no
                GROUP BY 
                    voi_invoice_no, 
                    invoice_date,
                    in_invoice_no, 
                    debit_no, 
                    debit_date, 
                    --adv_paid_date, 
                    advance_amount, 
                    interest_days, 
                    interest_amt; `;

        const result = await pool.request()
            .input('voi_invoice_no', sql.VarChar, voi_invoice_no)  
            .query(query);

        if (result.recordset.length === 0) {
            return res.status(404).send({ message: 'Invoice not found.' });
        }

        res.status(200).json(result.recordset[0]);

    } catch (error) {
        console.error('Error fetching invoice details:', error);
        res.status(500).send({ message: 'An error occurred while fetching invoice details.' });
    }
}

//count
exports.VoicountAPI = async (req, res) => {
    try {
        const pool = await poolPromise

        const query = `
                    SELECT 
                    COUNT(DISTINCT CASE WHEN voi_advance_request_id = 0 THEN invoice_no END) AS request_count,
                    COUNT(DISTINCT CASE WHEN voi_advance_request_id = 1 THEN invoice_no END) AS requested_count,
                    COUNT(DISTINCT CASE WHEN voi_advance_request_id = 2 THEN invoice_no END) AS advance_paid_count,
                    COUNT(DISTINCT CASE WHEN voi_advance_request_id = 3 THEN invoice_no END) AS hold_count,
                    COUNT(DISTINCT CASE WHEN voi_advance_request_id = 4 THEN invoice_no END) AS rejected_count,
                    COUNT(DISTINCT CASE WHEN voi_advance_request_id = 6 THEN invoice_no END) AS not_eligible_count,
             
                    COUNT(DISTINCT invoice_no) AS total_invoices,
                
                    (SELECT SUM(advance_amount) 
                    FROM (SELECT DISTINCT invoice_no, advance_amount 
                        FROM voi_jeans_invoice_list 
                        WHERE adv_paid_date IS NOT NULL) AS distinct_advances) AS total_advance_amt,
                
                    -- Sum of gross amount + igst amount
                    SUM(gross_amount + igst_amount) AS total_net_amt,
                
                    -- Sum of distinct interest amounts per invoice
                    (SELECT SUM(interest_amt) 
                    FROM (SELECT DISTINCT invoice_no, interest_amt FROM voi_jeans_invoice_list) AS distinct_interest) AS total_interest_amt,
                
                    -- Sum of distinct interest amounts per invoice where voi_advance_request_id = 9
                    (SELECT SUM(interest_amt) 
                    FROM (SELECT DISTINCT invoice_no, interest_amt 
                        FROM voi_jeans_invoice_list 
                        WHERE voi_advance_request_id = 9) AS distinct_interests) AS total_interest_closed,

                    -- Sum of distinct interest amounts per invoice where voi_advance_request_id = 2
                    (SELECT SUM(interest_amt) 
                    FROM (SELECT DISTINCT invoice_no, interest_amt 
                        FROM voi_jeans_invoice_list 
                        WHERE voi_advance_request_id = 2) AS distinct_interests) AS total_interest_paid
                
                FROM voi_jeans_invoice_list; `;

        const result = await pool.request().query(query);

        res.status(200).json(result.recordset[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: '\u274C Server error' });
    }
} 

//put for innofashion isRead
exports.updateVoiJeansIsRead = async (req, res) => {
    try {
        const { isRead } = req.body; 
        const { invoice_no } = req.params;

        const pool = await poolPromise;

        const checkQuery = `
            SELECT invoice_no FROM voi_jeans_invoice_list WHERE invoice_no = @invoice_no; `;
        const checkResult = await pool.request()
            .input('invoice_no', sql.VarChar, invoice_no)  
            .query(checkQuery);

        if (checkResult.recordset.length === 0) {
            return res.status(404).send('Invoice not found');
        }

        const updateQuery = `
            UPDATE voi_jeans_invoice_list
            SET isRead = @isRead
            WHERE invoice_no = @invoice_no; `;

        await pool.request()
            .input('invoice_no', sql.VarChar, invoice_no)  
            .input('isRead', sql.Bit, isRead)  
            .query(updateQuery);

        res.status(200).send('invoice status updated');
    } catch (error) {
        console.error('Error updating invoice status:', error);
        res.status(500).send('\u274C Server Error');
    }
}
