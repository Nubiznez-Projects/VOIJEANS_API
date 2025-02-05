const express = require('express')
const { invoiceMailSend, outletRemark } = require('../controllers/outlet_controller')

const outletRote = express.Router()

outletRote.get('invoice/pdf/invoice_no(*)', invoiceMailSend)
outletRote.post('otlet_remarks', outletRemark)


module.exports = { outletRote }