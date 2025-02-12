const express = require('express');
const voiRoutes = express.Router();
const { login, forgotPassword, resetPassword, VoicejeansInvoiceList, VoijeansInvoiceListByInvoiceNo, updateInvoiceDetails, getInvoicesByAdvanceRequestId, getVoiInvoiceListByInvoiceNo, getVoiInvoiceListHsnCode, updateRequestStatus, debitNote, SearchVoiJeansInvoice, VoicountAPI, updateVoiJeansIsRead,  } = require('../controllers/VoiJeans_controller');
const { authenticateToken } = require('../middileware/Auth');

voiRoutes.post('/login', login); 
voiRoutes.put('/forgot-password', authenticateToken, forgotPassword); 
voiRoutes.put('/reset-password', authenticateToken, resetPassword); 
voiRoutes.get('/voijeans-invoice-list', authenticateToken, VoicejeansInvoiceList); 
voiRoutes.get('/voijeans-invoice-list/:invoice_no(*)', authenticateToken, VoijeansInvoiceListByInvoiceNo); 
voiRoutes.put('/voijeans-request/:invoice_no(*)', authenticateToken, updateRequestStatus); 

voiRoutes.put('/voijeans-invoice-list/:invoice_no(*)', authenticateToken, updateInvoiceDetails); 
voiRoutes.get('/voijeans/:invoice_no(*)', authenticateToken, getVoiInvoiceListByInvoiceNo); 
voiRoutes.get('/voijeans-hsncode/:invoice_no(*)', authenticateToken, getVoiInvoiceListHsnCode); 
voiRoutes.get('/voijeans-invoice/:voi_advance_request_id', authenticateToken, getInvoicesByAdvanceRequestId); 
voiRoutes.get('/debit-note/:voi_invoice_no(*)', authenticateToken, debitNote); 
voiRoutes.get('/voijeans-search/:voi_advance_request_id/:term(*)', authenticateToken, SearchVoiJeansInvoice); 
voiRoutes.get('/voijeans-count', authenticateToken, VoicountAPI);
// voiRoutes.put('/invoice-status/:invoice_no', updateVoiJeansIsRead)
voiRoutes.put('/voijeans-invoice-status/:invoice_no(*)', authenticateToken, updateVoiJeansIsRead)

module.exports = voiRoutes;
   