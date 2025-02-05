const { sql, poolPromise } = require('../config/db');
const { calculateDailyInterest } = require('./VoiJeans_controller');
require('dotenv').config();

exports.updateInflowTransaction = async (req, res) => {
    const {
        voi_invoice_no,
        transaction_date,
        from_bank_details,
        to_bank_details,
        transaction_amt,
        remarks,
        transaction_id,
        voi_advance_request_id,
        voi_advance_request,
        in_advance_request_id,
        in_advance_request,
        payment_status_id,
        payment_status,
        comment,
        closing_date = null, closing_amt = null           
    } = req.body;

    if (!voi_invoice_no) {
        return res.status(400).send({ message: 'Voi invoice number is required.' });
    }

    let transaction;

    try {
        const pool = await poolPromise;
        transaction = pool.transaction();
        await transaction.begin();

        const inflowQuery = 
            `UPDATE [VOI_JEANS].[dbo].[innofashion_transactions]
            SET 
                transaction_date = COALESCE(@transaction_date, transaction_date),  
                from_bank_details = COALESCE(@from_bank_details, from_bank_details),  
                to_bank_details = COALESCE(@to_bank_details, to_bank_details),  
                transaction_amt = COALESCE(@transaction_amt, transaction_amt),  
                remarks = COALESCE(@remarks, remarks),  
                transaction_id = COALESCE(@transaction_id, transaction_id)  
            WHERE voi_invoice_no = @voi_invoice_no`;

        await transaction.request()
            .input('voi_invoice_no', sql.NVarChar, voi_invoice_no)
            .input('transaction_date', sql.DateTime, transaction_date)
            .input('from_bank_details', sql.NVarChar, from_bank_details)
            .input('to_bank_details', sql.NVarChar, to_bank_details)
            .input('transaction_amt', sql.Decimal, transaction_amt)
            .input('remarks', sql.NVarChar, remarks)
            .input('transaction_id', sql.NVarChar, transaction_id)
            .query(inflowQuery);

        const invoiceQuery = 
            `UPDATE voi_jeans_invoice_list
            SET 
                voi_advance_request_id = @voi_advance_request_id,
                voi_advance_request = @voi_advance_request,
                in_advance_request_id = @in_advance_request_id,
                in_advance_request = @in_advance_request,
                payment_status_id = COALESCE(@payment_status_id, payment_status_id),
                payment_status = COALESCE(@payment_status, payment_status),
                adv_paid_date = @transaction_date,
                closing_date = COALESCE(@closing_date, closing_date),
                comment = COALESCE(@comment, comment),
                closing_amt = COALESCE(@closing_amt, closing_amt)
            WHERE invoice_no = @voi_invoice_no`;

        await transaction.request()
            .input('voi_invoice_no', sql.NVarChar, voi_invoice_no)
            .input('voi_advance_request_id', sql.Int, voi_advance_request_id)
            .input('voi_advance_request', sql.NVarChar, voi_advance_request)
            .input('in_advance_request_id', sql.Int, in_advance_request_id)
            .input('in_advance_request', sql.NVarChar, in_advance_request)
            .input('payment_status_id', sql.Int, payment_status_id)
            .input('payment_status', sql.NVarChar, payment_status)
            .input('transaction_date', sql.DateTime, transaction_date)
            .input('closing_date', sql.DateTime, closing_date)
            .input('comment', sql.NVarChar, comment)
            .input('closing_amt', sql.Decimal, closing_amt)
            .query(invoiceQuery);

        // Notification logic
        let notificationMessage;
        let advancePercentage;

        if (in_advance_request_id === 1 || in_advance_request_id === 2 || in_advance_request_id === 3) {
            const advancePercentageQuery = 
                `SELECT advance_percentage FROM voi_jeans_invoice_list WHERE invoice_no = @voi_invoice_no`;
            const advanceResult = await transaction.request()
                .input('voi_invoice_no', sql.VarChar, voi_invoice_no)
                .query(advancePercentageQuery);

            advancePercentage = advanceResult.recordset[0]?.advance_percentage || 0;
        }

        if (in_advance_request_id === 1) {
            notificationMessage = `${advancePercentage}% Advance for this invoice ${voi_invoice_no} is Approved`;
        } else if (in_advance_request_id === 2) {
            notificationMessage = `${advancePercentage}% Advance for this invoice ${voi_invoice_no} is on Hold`;
        } else if (in_advance_request_id === 3) {
            notificationMessage = `${advancePercentage}% Advance for this invoice ${voi_invoice_no} is Rejected`;
        }

        if (notificationMessage) {
            const notificationQuery = 
                `INSERT INTO voi_jeans_notifications (invoice_no, notification_type, notification_date, message, is_read, created_at)
                VALUES (@voi_invoice_no, @notification_type, @notification_date, @message, 0, @created_at)`;

            await transaction.request()
                .input('voi_invoice_no', sql.VarChar, voi_invoice_no)
                .input('notification_type', sql.VarChar, 'Advance Status Update')
                .input('notification_date', sql.DateTime, transaction_date)
                .input('message', sql.NVarChar, notificationMessage)
                .input('created_at', sql.DateTime, new Date())
                .query(notificationQuery);
        }

        await transaction.commit();

        await calculateDailyInterest();

        res.status(200).send({ message: 'Transaction and invoice details updated successfully.' });
    } catch (error) {
        console.error('Error updating transaction and invoice:', error);

        if (transaction) await transaction.rollback();

        res.status(500).send({ message: 'An error occurred while updating the transaction and invoice details.' });
    }
};


//get transaction detaile by voi_invoice_no
exports.GetTransactionDetails = async (req, res) => {
    const { voi_invoice_no } = req.params;

    if (!voi_invoice_no) {
        return res.status(400).send({ message: 'Voi invoice number is required.' });
    }

    try {
        const pool = await poolPromise;
        const query = `SELECT * FROM innofashion_transactions WHERE voi_invoice_no = @voi_invoice_no`
        const result = await pool
            .request()
            .input('voi_invoice_no', sql.NVarChar, voi_invoice_no)
            .query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).send({ message: 'Transaction not found for the provided invoice number.' });
        }
        res.status(200).send(result.recordset[0])
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).send({ message: 'An error occurred while fetching transaction details.', error: error.message });
    }
}

//innofashion oulet bill transaction update
exports.UpdateOuletTransactions = async (req, res) => {
    const {in_invoice_no} = req.params

    const {
        transaction_date,
        from_bank_details,
        to_bank_details,
        transaction_amt,
        remarks,
        transaction_id,
        payment_status_id,
        payment_status         
    } = req.body;
try {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();

        const inflowQuery = `
            UPDATE [VOI_JEANS].[dbo].[innofashion_outlet_bill_transactions]
            SET 
                transaction_date = COALESCE(@transaction_date, transaction_date),  
                from_bank_details = COALESCE(@from_bank_details, from_bank_details),  
                to_bank_details = COALESCE(@to_bank_details, to_bank_details),  
                transaction_amt = COALESCE(@transaction_amt, transaction_amt),  
                remarks = COALESCE(@remarks, remarks),  
                transaction_id = COALESCE(@transaction_id, transaction_id)  
            WHERE in_invoice_no = @in_invoice_no
        `;

        await transaction.request()
            .input('in_invoice_no', sql.NVarChar, in_invoice_no)
            .input('transaction_date', sql.DateTime, transaction_date)
            .input('from_bank_details', sql.NVarChar, from_bank_details)
            .input('to_bank_details', sql.NVarChar, to_bank_details)
            .input('transaction_amt', sql.Decimal, transaction_amt)
            .input('remarks', sql.NVarChar, remarks)
            .input('transaction_id', sql.NVarChar, transaction_id)
            .query(inflowQuery);

        const invoiceQuery = `
            UPDATE [dbo].[innofashion_outlet_bill_invoice]
            SET 
                payment_status_id = COALESCE(@payment_status_id, payment_status_id),
                payment_status = COALESCE(@payment_status, payment_status)
            WHERE in_invoice_no = @in_invoice_no
        `;

        await transaction.request()
            .input('in_invoice_no', sql.NVarChar, in_invoice_no)
            .input('payment_status_id', sql.Int, payment_status_id)
            .input('payment_status', sql.NVarChar, payment_status)
            .query(invoiceQuery);

        await transaction.commit();

        res.status(200).send({ message: 'Transaction and invoice details updated successfully.' });
    

} catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).send({ message: 'An error occurred while fetching transaction details.', error: error.message });
}
}

//oulet bill transaction get
exports.GetOutletBillTransactions = async (req, res) => {
    const { in_invoice_no } = req.params
try {
    const pool = await poolPromise;
    const inflowQuery = `
            SELECT * FROM innofashion_outlet_bill_transactions
            WHERE in_invoice_no = @in_invoice_no
        `;

       const result = await pool.request()
            .input('in_invoice_no', sql.NVarChar, in_invoice_no)
            .query(inflowQuery);

         res.status(200).send(result.recordset[0])

} catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).send({ message: 'An error occurred while fetching transaction details.', error: error.message });
}
}
