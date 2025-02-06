const { sql, poolPromise } = require('../config/db');

// GET all records of INNOFASHION_BANK_DETAILS
exports.GetInfBankDetails = async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query('SELECT * FROM innofashion_bank_details');
      res.status(200).json(result.recordset);    
    } catch (error) {
      res.status(500).send(error.message);
    }
  } 
  
  // GET a record by ID of INNOFASHION_BANK_DETAILS
  exports.GetInfBankDetailsById = async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('acc_id', sql.VarChar, req.params.acc_id)
        .query('SELECT * FROM innofashion_bank_details WHERE acc_id = @acc_id');
      res.status(200).json(result.recordset);
    } catch (error) {
      res.status(500).send(error.message);
    }
  }
  
  // POST (Create a new record) of INNOFASHION_BANK_DETAILS
  exports.PostInfBankDetails = async (req, res) => {
    const { acc_holder_name, acc_no, bank_name, ifsc_code, branch_name, acc_type } = req.body;     
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input('acc_holder_name', sql.VarChar, acc_holder_name)
        .input('acc_no', sql.VarChar, acc_no)
        .input('bank_name', sql.VarChar, bank_name)
        .input('ifsc_code', sql.VarChar, ifsc_code)
        .input('branch_name', sql.VarChar, branch_name)
        .input('acc_type', sql.VarChar, acc_type)
        .query(
          `INSERT INTO innofashion_bank_details (acc_holder_name, acc_no, bank_name, ifsc_code, branch_name, acc_type) 
                 VALUES (@acc_holder_name, @acc_no, @bank_name, @ifsc_code, @branch_name, @acc_type)`
        );
      const result = res.status(201).send('\u2705 Record created successfully');
    } catch (error) {
      res.status(500).send(error.message);
    }
  }
  
  // PUT (Update a record) of INNOFASHION_BANK_DETAILS
  exports.PutInfBankDetails = async (req, res) => {
    const { acc_holder_name, acc_no, bank_name, ifsc_code, branch_name, acc_type } = req.body;
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input('acc_id', sql.VarChar, req.params.acc_id)
        .input('acc_holder_name', sql.VarChar, acc_holder_name)
        .input('acc_no', sql.VarChar, acc_no)
        .input('bank_name', sql.VarChar, bank_name)
        .input('ifsc_code', sql.VarChar, ifsc_code)
        .input('branch_name', sql.VarChar, branch_name)
        .input('acc_type', sql.VarChar, acc_type)
        .query(
          `UPDATE innofashion_bank_details 
           SET acc_holder_name = @acc_holder_name, acc_no = @acc_no, bank_name = @bank_name, 
               ifsc_code = @ifsc_code, branch_name = @branch_name, acc_type = @acc_type WHERE acc_id = @acc_id` );
      res.status(200).send('\u2705 Record updated successfully');
    } catch (error) {
      res.status(500).send(error.message);
    }
  }
  
  // DELETE a record of INNOFASHION_BANK_DETAILS
  exports.DeleteInfBankDetails = async (req, res) => {
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input('acc_id', sql.VarChar, req.params.acc_id)
        .query('DELETE FROM innofashion_bank_details WHERE acc_id = @acc_id');
      res.status(200).send('\u2705 Record deleted successfully');
    } catch (error) {
      res.status(500).send(error.message);
    }
  }

  // GET all records of VOI JEANS_BANK_DETAILS
exports.GetVoiBankDetails = async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query('SELECT * FROM voi_jeans_bank_details');
      res.status(200).json(result.recordset);
    } catch (error) {
      res.status(500).send(error.message);
    }
  }
  
  // GET a record by ID of VOI JEANS_BANK_DETAILS
  exports.GetVoiBankDetailsById = async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('acc_id', sql.VarChar, req.params.acc_id)
        .query('SELECT * FROM voi_jeans_bank_details WHERE acc_id = @acc_id');
      res.status(200).json(result.recordset);
    } catch (error) {
      res.status(500).send(error.message);
    }
  }
  
  // POST (Create a new record) of VOI JEANS_BANK_DETAILS
  exports.PostVoiBankDetails = async (req, res) => {
    const { acc_holder_name, acc_no, bank_name, ifsc_code, branch_name, acc_type } = req.body;
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input('acc_holder_name', sql.VarChar, acc_holder_name)
        .input('acc_no', sql.VarChar, acc_no)
        .input('bank_name', sql.VarChar, bank_name)
        .input('ifsc_code', sql.VarChar, ifsc_code)
        .input('branch_name', sql.VarChar, branch_name)
        .input('acc_type', sql.VarChar, acc_type)
        .query(
          `INSERT INTO voi_jeans_bank_details (acc_holder_name, acc_no, bank_name, ifsc_code, branch_name, [acc_type]) 
                 VALUES (@acc_holder_name, @acc_no, @bank_name, @ifsc_code, @branch_name, @acc_type)`
        );
      res.status(201).send('\u2705 Record created successfully');
    } catch (error) {
      res.status(500).send(error.message);
    }
  }
  
  // PUT (Update a record) of VOI JEANS_BANK_DETAILS
  exports.PutVoiBankDetails = async (req, res) => {
    const { acc_holder_name, acc_no, bank_name, ifsc_code, branch_name, acc_type } = req.body;
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input('acc_id', sql.VarChar, req.params.acc_id)
        .input('acc_holder_name', sql.VarChar, acc_holder_name)
        .input('acc_no', sql.VarChar, acc_no)
        .input('bank_name', sql.VarChar, bank_name)
        .input('ifsc_code', sql.VarChar, ifsc_code)
        .input('branch_name', sql.VarChar, branch_name)
        .input('acc_type', sql.VarChar, acc_type)
        .query(
          `UPDATE voi_jeans_bank_details 
           SET acc_holder_name = @acc_holder_name, acc_no = @acc_no, bank_name = @bank_name, 
               ifsc_code = @ifsc_code, branch_name = @branch_name, acc_type = @acc_type 
           WHERE acc_id = @acc_id`
        );
      res.status(200).send('\u2705 Record updated successfully');
    } catch (error) {
      res.status(500).send(error.message);
    }
  }
  
  // DELETE a record of VOI JEANS_BANK_DETAILS
  exports.DeleteVoiBankDetails = async (req, res) => {
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input('acc_id', sql.VarChar, req.params.acc_id)
        .query('DELETE FROM voi_jeans_bank_details WHERE acc_id = @acc_id');
      res.status(200).send('\u2705 Record deleted successfully');
    } catch (error) {
      res.status(500).send(error.message);
    }
  }