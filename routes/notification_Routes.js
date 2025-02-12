const express = require('express');
const { getNotifications, updateNotificationStatus, getInnofashionNotifications, updateInnofashionNotificationStatus } = require('../controllers/notification_controller');
const { authenticateToken } = require('../middileware/Auth');
const notiRoute = express.Router();

notiRoute.get('/voi-jeans', authenticateToken, getNotifications)
notiRoute.put('/voi-jeans/:notification_id', authenticateToken, updateNotificationStatus)
notiRoute.get('/innofashion', authenticateToken, getInnofashionNotifications)
notiRoute.put('/innofashion/:notification_id', authenticateToken, updateInnofashionNotificationStatus)

module.exports = { notiRoute }