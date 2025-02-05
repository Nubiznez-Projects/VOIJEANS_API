const express = require('express');
const voiRoutes = express.Router();
const { login, forgotPassword, resetPassword, VoicejeansInvoiceList, VoijeansInvoiceListByInvoiceNo, updateInvoiceDetails, getInvoicesByAdvanceRequestId, getVoiInvoiceListByInvoiceNo, getVoiInvoiceListHsnCode, updateRequestStatus, debitNote, SearchVoiJeansInvoice, VoicountAPI, updateVoiJeansIsRead,  } = require('../controllers/VoiJeans_controller');

voiRoutes.post('/login', login); 
voiRoutes.put('/forgot-password', forgotPassword); 
voiRoutes.put('/reset-password', resetPassword); 
voiRoutes.get('/voijeans-invoice-list', VoicejeansInvoiceList); 
voiRoutes.get('/voijeans-invoice-list/:invoice_no(*)', VoijeansInvoiceListByInvoiceNo); 
voiRoutes.put('/voijeans-request/:invoice_no(*)', updateRequestStatus); 

voiRoutes.put('/voijeans-invoice-list/:invoice_no(*)', updateInvoiceDetails); 
voiRoutes.get('/voijeans/:invoice_no(*)', getVoiInvoiceListByInvoiceNo); 
voiRoutes.get('/voijeans-hsncode/:invoice_no(*)', getVoiInvoiceListHsnCode); 
voiRoutes.get('/voijeans-invoice/:voi_advance_request_id', getInvoicesByAdvanceRequestId); 
voiRoutes.get('/debit-note/:voi_invoice_no(*)', debitNote); 
voiRoutes.get('/voijeans-search/:voi_advance_request_id/:term(*)', SearchVoiJeansInvoice); 
voiRoutes.get('/voijeans-count', VoicountAPI);
// voiRoutes.put('/invoice-status/:invoice_no', updateVoiJeansIsRead)
voiRoutes.put('/voijeans-invoice-status/:invoice_no(*)', updateVoiJeansIsRead)

module.exports = voiRoutes;
   