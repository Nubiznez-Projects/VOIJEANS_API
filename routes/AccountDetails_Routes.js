const express = require('express');
const { GetVoiBankDetails, GetVoiBankDetailsById, PutVoiBankDetails, PostVoiBankDetails, GetInfBankDetails, GetInfBankDetailsById, PostInfBankDetails, PutInfBankDetails, DeleteInfBankDetails, DeleteVoiBankDetails } = require('../controllers/AccountDetails_controller');
const { authenticateToken } = require('../middileware/Auth');

const bankRoute = express.Router();

//VOI JEANS
bankRoute.get('/voi-jeans-bank-details', authenticateToken, GetVoiBankDetails)
bankRoute.get('/voi-jeans-bank-details/:acc_id', authenticateToken, GetVoiBankDetailsById)
bankRoute.put('/voi-jeans-bank-details/:acc_id', authenticateToken, PutVoiBankDetails)
bankRoute.post('/voi-jeans-bank-details', authenticateToken, PostVoiBankDetails)
bankRoute.delete('/voi-jeans-bank-details/:acc_id', authenticateToken, DeleteVoiBankDetails)

//INNOFASHION......
bankRoute.get('/innofashion-bank-details', authenticateToken, GetInfBankDetails)
bankRoute.get('/innofashion-bank-details/:acc_id', authenticateToken, GetInfBankDetailsById)
bankRoute.post('/innofashion-bank-details', authenticateToken, PostInfBankDetails)
bankRoute.put('/innofashion-bank-details/:acc_id', authenticateToken, PutInfBankDetails)
bankRoute.delete('/innofashion-bank-details/:acc_id', authenticateToken, DeleteInfBankDetails)


module.exports = { bankRoute }