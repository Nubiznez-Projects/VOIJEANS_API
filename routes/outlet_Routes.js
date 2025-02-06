const express = require('express')
const multer = require('multer')
const { invoiceMailSend, outletRemark } = require('../controllers/outlet_controller')

const outletRote = express.Router()

const outlet_storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './outlet_files/'); 
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}_${file.originalname}`); 
    }
});
const outlet_upload = multer({ storage: outlet_storage });

outletRote.get('/invoice/pdf/:invoice_no(*)', invoiceMailSend)
outletRote.post('/outlet_remarks', outlet_upload.single('image'), outletRemark)


module.exports = { outletRote }