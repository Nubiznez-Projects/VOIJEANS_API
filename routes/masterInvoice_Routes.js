const express = require('express')
const { GetMasterInvoice } = require('../controllers/masterInvoice_controller')

const MasterInvoiceRoutes = express.Router()

MasterInvoiceRoutes.get('/master-invoice', GetMasterInvoice)

module.exports = { MasterInvoiceRoutes }

