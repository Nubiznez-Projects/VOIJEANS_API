const { sql, poolPromise } = require('../config/db')

//voi-jeans nptifications
exports.getNotifications = async (req, res) => {
    try {
        const pool = await poolPromise;

        const query = `
            SELECT 
                notification_id, 
                invoice_no, 
                notification_type, 
                notification_date, 
                message, 
                is_read, 
                created_at 
            FROM voi_jeans_notifications 
            ORDER BY created_at DESC; `;

        const result = await pool.request().query(query);

        const countQuery = `
            SELECT COUNT(*) AS unread_count 
            FROM voi_jeans_notifications 
            WHERE is_read = 0;
        `;

        const countResult = await pool.request().query(countQuery);

        res.status(200).json({
            notifications: result.recordset,
            unread_count: countResult.recordset[0].unread_count
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).send('Server Error');
    }
};

//put for voi-jeans notifications
exports.updateNotificationStatus = async (req, res) => {
    try {
        const { is_read } = req.body; 
        const { notification_id } = req.params;

        const pool = await poolPromise;

        const checkQuery = `
            SELECT notification_id FROM voi_jeans_notifications WHERE notification_id = @notification_id;
        `;
        const checkResult = await pool.request()
            .input('notification_id', sql.Int, notification_id)  
            .query(checkQuery);

        if (checkResult.recordset.length === 0) {
            return res.status(404).send('Notification not found');
        }

        const updateQuery = `
            UPDATE voi_jeans_notifications
            SET is_read = @is_read, updated_at = GETDATE()
            WHERE notification_id = @notification_id;
        `;

        await pool.request()
            .input('notification_id', sql.Int, notification_id)  
            .input('is_read', sql.Bit, is_read)  
            .query(updateQuery);

        res.status(200).send('Notification status updated');
    } catch (error) {
        console.error('Error updating notification status:', error);
        res.status(500).send('Server Error');
    }
}

//innofashion nptifications
exports.getInnofashionNotifications = async (req, res) => {
    try {
        const pool = await poolPromise;

        const query = `
            SELECT 
                notification_id, 
                invoice_no, 
                notification_type, 
                notification_date, 
                message, 
                is_read, 
                created_at 
            FROM innofashion_notifications 
            ORDER BY created_at DESC; `;

        const result = await pool.request().query(query);

        const countQuery = `
            SELECT COUNT(*) AS unread_count 
            FROM innofashion_notifications 
            WHERE is_read = 0;
        `;

        const countResult = await pool.request().query(countQuery);

        res.status(200).json({
            notifications: result.recordset,
            unread_count: countResult.recordset[0].unread_count
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).send('Server Error');
    }
};

//put for innofashion notifications
exports.updateInnofashionNotificationStatus = async (req, res) => {
    try {
        const { is_read } = req.body; 
        const { notification_id } = req.params;

        const pool = await poolPromise;

        const checkQuery = `
            SELECT notification_id FROM innofashion_notifications WHERE notification_id = @notification_id; `;
        const checkResult = await pool.request()
            .input('notification_id', sql.Int, notification_id)  
            .query(checkQuery);

        if (checkResult.recordset.length === 0) {
            return res.status(404).send('Notification not found');
        }

        const updateQuery = `
            UPDATE innofashion_notifications
            SET is_read = @is_read, updated_at = GETDATE()
            WHERE notification_id = @notification_id; `;

        await pool.request()
            .input('notification_id', sql.Int, notification_id)  
            .input('is_read', sql.Bit, is_read)  
            .query(updateQuery);

        res.status(200).send('Notification status updated');
    } catch (error) {
        console.error('Error updating notification status:', error);
        res.status(500).send('Server Error');
    }
}




