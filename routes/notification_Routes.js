const express = require('express');
const { getNotifications, updateNotificationStatus, getInnofashionNotifications, updateInnofashionNotificationStatus } = require('../controllers/notification_controller');
const notiRoute = express.Router();

notiRoute.get('/voi-jeans', getNotifications)
notiRoute.put('/voi-jeans/:notification_id', updateNotificationStatus)
notiRoute.get('/innofashion', getInnofashionNotifications)
notiRoute.put('/innofashion/:notification_id', updateInnofashionNotificationStatus)

module.exports = { notiRoute }