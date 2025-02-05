const express = require('express');
const { updateInflowTransaction, GetTransactionDetails, UpdateOuletTransactions, GetOutletBillTransactions } = require('../controllers/Transaction_controller');
const TransactionRoutes = express.Router();

TransactionRoutes.put('/transaction-details/:voi_invoice_no(*)', updateInflowTransaction)
TransactionRoutes.get('/transaction-details/:voi_invoice_no(*)', GetTransactionDetails)
TransactionRoutes.put('/outlet-transactions/:in_invoice_no', UpdateOuletTransactions)
TransactionRoutes.get('/outlet-transactions/:in_invoice_no', GetOutletBillTransactions)

module.exports = { TransactionRoutes }