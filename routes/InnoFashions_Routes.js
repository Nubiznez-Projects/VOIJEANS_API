const express = require('express');
const innoFashionRoutes = express.Router();
const { login, forgotPassword, resetPassword, InnofashionInvoiceList, getInvoicesByAdvanceRequestId, SearchInnofashionInvoice, InnofashioncountAPI, CountCreditPeriods, getInvoicesByPaymentId, GetDebitNote, updateInnoFashionIsRead } = require('../controllers/innoFashions_controller');

innoFashionRoutes.post('/innoFashion-login', login); 
innoFashionRoutes.put('/innoFashion-forgot-password', forgotPassword); 
innoFashionRoutes.put('/innoFashion-reset-password', resetPassword); 
innoFashionRoutes.get('/innofashion-invoice-list', InnofashionInvoiceList); 
innoFashionRoutes.get('/innofashion-invoice/:in_advance_request_id', getInvoicesByAdvanceRequestId);
innoFashionRoutes.get('/innofashion-search/:in_advance_request_id/:term(*)', SearchInnofashionInvoice);
innoFashionRoutes.get('/innofashion-count', InnofashioncountAPI);
innoFashionRoutes.get('/count-credit-periods', CountCreditPeriods);
innoFashionRoutes.get('/oulet-bill-invoice/:payment_status_id', getInvoicesByPaymentId);
innoFashionRoutes.get('/IN-debit-note', GetDebitNote);
innoFashionRoutes.put('/innofashion-invoice-status/:voi_invoice_no(*)', updateInnoFashionIsRead);

module.exports = innoFashionRoutes;
