const express = require('express')
const { PostSalesInvoices } = require('../controllers/salesInvoice_controller')
const salesRoter = express.Router()

//salesRoter.get('/sales-invoice', PostSalesInvoices)

module.exports = { salesRoter }