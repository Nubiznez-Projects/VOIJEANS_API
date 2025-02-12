const express = require('express');
const { updateInflowTransaction, GetTransactionDetails, UpdateOuletTransactions, GetOutletBillTransactions } = require('../controllers/Transaction_controller');
const { authenticateToken } = require('../middileware/Auth');
const TransactionRoutes = express.Router();

TransactionRoutes.put('/transaction-details/:voi_invoice_no(*)', authenticateToken, updateInflowTransaction)
TransactionRoutes.get('/transaction-details/:voi_invoice_no(*)', authenticateToken, GetTransactionDetails)
TransactionRoutes.put('/outlet-transactions/:in_invoice_no', authenticateToken, UpdateOuletTransactions)
TransactionRoutes.get('/outlet-transactions/:in_invoice_no', authenticateToken, GetOutletBillTransactions)

module.exports = { TransactionRoutes }