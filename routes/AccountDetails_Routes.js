const express = require('express');
const { GetVoiBankDetails, GetVoiBankDetailsById, PutVoiBankDetails, PostVoiBankDetails, GetInfBankDetails, GetInfBankDetailsById, PostInfBankDetails, PutInfBankDetails, DeleteInfBankDetails, DeleteVoiBankDetails } = require('../controllers/AccountDetails_controller');

const bankRoute = express.Router();

//VOI JEANS
bankRoute.get('/voi-jeans-bank-details', GetVoiBankDetails)
bankRoute.get('/voi-jeans-bank-details/:acc_id', GetVoiBankDetailsById)
bankRoute.put('/voi-jeans-bank-details/:acc_id', PutVoiBankDetails)
bankRoute.post('/voi-jeans-bank-details', PostVoiBankDetails)
bankRoute.delete('/voi-jeans-bank-details/:acc_id', DeleteVoiBankDetails)

//INNOFASHION
bankRoute.get('/innofashion-bank-details', GetInfBankDetails)
bankRoute.get('/innofashion-bank-details/:acc_id', GetInfBankDetailsById)
bankRoute.post('/innofashion-bank-details', PostInfBankDetails)
bankRoute.put('/innofashion-bank-details/:acc_id', PutInfBankDetails)
bankRoute.delete('/innofashion-bank-details/:acc_id', DeleteInfBankDetails)


module.exports = { bankRoute }