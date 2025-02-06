const nodemailer = require("nodemailer");
const {sql, poolPromise} = require('../config/db');  
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");


exports.invoiceMailSend = async (req, res) => {
  const invoiceNo = req.params.invoice_no;

  try {
    const pool = await poolPromise;

    const query = ` SELECT * FROM voi_jeans_invoice_list WHERE invoice_no = @invoiceNo `;

    const result = await pool
      .request()
      .input("invoiceNo", sql.VarChar, invoiceNo)
      .query(query);

    if (result.recordset.length === 0) {
      return res.status(404).send("Invoice not found");
    }

    //console.log(invoices);

    const invoices = result.recordset;

    const invoicesWithPerRate = invoices.map((invoice) => {
      const perRate =
        invoice.sales_quantity > 0
          ? invoice.gross_amount / invoice.sales_quantity
          : 0; 
      return {
        ...invoice,
        perRate: perRate.toFixed(2),
      };
    });

    const grandTotalGrossAmount = invoicesWithPerRate.reduce(
      (sum, invoice) => sum + parseFloat(invoice.gross_amount || 0),
      0
    );

    const grandTotalIgstAmount = invoicesWithPerRate.reduce(
      (sum, invoice) => sum + parseFloat(invoice.igst_amount || 0),
      0
    );

    const grandTotal = (grandTotalGrossAmount + grandTotalIgstAmount).toFixed(2);

    const totalSalesQuantity = invoicesWithPerRate.reduce(
      (sum, invoice) => sum + parseFloat(invoice.sales_quantity || 0),
      0
    );

    const totalGrossAmount = invoicesWithPerRate.reduce(
      (sum, invoice) => sum + parseFloat(invoice.gross_amount || 0),
      0
    );

    const hsnGrouped = invoicesWithPerRate.reduce((acc, invoice) => {
      const { hsn_code, igst_percentage, cgst_percentage, sgst_percentage } = invoice;

      if (!acc[hsn_code]) {
        acc[hsn_code] = {
          hsn_code,
          totalQuantity: 0,
          taxableAmount: 0,
          igstAmount: 0,
          cgstPercentage: cgst_percentage || 0,
          sgstPercentage: sgst_percentage || 0,
          igstPercentage: igst_percentage || 0,
        };
      }

      acc[hsn_code].totalQuantity += parseFloat(invoice.sales_quantity || 0);
      acc[hsn_code].taxableAmount += parseFloat(invoice.gross_amount || 0);
      acc[hsn_code].igstAmount += parseFloat(invoice.igst_amount || 0);

      return acc;
    }, {});

    const hsnGroupedArray = Object.values(hsnGrouped);

    function formatDate(date) {
      const options = { day: "2-digit", month: "short", year: "numeric" };
      return new Date(date).toLocaleDateString("en-GB", options);
    }

    const logoPath = path.join(__dirname, "..", "public", "innologo.png");
    //const logoPath = "E:\\voi_jeans_api\\public\\innologo.png";
    const logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });
    const logoDataUri = `data:image/png;base64,${logoBase64}`;

    const partyEmailid = invoices[0].party_emailid || "partyemailid@gmail.com";
    const voiEmailid = invoices[0].voi_emailid || "voiemailid@gmail.com";
    const partyPhone = invoices[0].party_phone || "9517634823"
    const voiPhone = invoices[0].voi_phone || "9517634823"
 

    const htmlContent = `    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 20px;
      }

      @media print {
        @page {
          margin-top: 7px;
          margin-bottom: 10px;
          size: A4;
        }

        table, .table-data, .tax-amt, .net-calc, .terms-condi {
            page-break-inside: avoid;
        }

        html, body {
        height: 100%;
    }
        

    .outer-border {
        display: flex;
        flex-direction: column;
        justify-content: space-between; 
        min-height: 100vh; 
        border: 5px solid black;
        padding: 20px;
        box-sizing: border-box;
    }

        tr {
          page-break-inside: avoid;
        }

        tfoot {
          break-before: avoid;
        }

        thead {
          break-after: avoid;
        }

        li {
          page-break-inside: avoid;
        }
        .bar {
          position: relative;
          bottom: 0;
          width: 80%;
        }
      }

      .outer-border {
        width: 100%;
        border: solid gainsboro 2px;
        border-radius: 3px;
        display: flex;
        flex-direction: column;
        justify-content: space-between; 
        min-height: 100vh;
      }

      .invocie-header {
        width: auto;
        height: auto;
        padding: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .company-details {
        width: 60%;
        height: auto;
        display: flex;
      }

      .invocie-logo {
        height: auto;
        width: 250px;
        padding: 15px;
        border: 2px dashed gainsboro;
        border-top-left-radius: 10px;
        border-bottom-left-radius: 10px;
      }

      .logo {
        height: 200px;
        width: 200px;
        align-content: center;
      }

      .invocie-company-details {
        padding: 10px;
        align-content: center;
        border-right: 2px dashed gainsboro;
        border-bottom: 2px dashed gainsboro;
        border-top: 2px dashed gainsboro;
        border-top-right-radius: 10px;
        border-bottom-right-radius: 10px;
        padding-left: 30px;
        width: 100%;
      }

      p {
        line-height: 0.9;
      }

      .invocie-details {
        width: auto;
        height: auto;
        display: flex;
        flex-direction: column;
        align-items: end;
        justify-content: center;
        padding: 10px;
        margin-right: 100px;
      }

      span {
        font-weight: normal;
        color: #6a6767;
      }

      .invocie-title {
        font-size: 35px;
        font-weight: 600;
        line-height: 0.1;
      }

      .invocie-date {
        font-size: 18px;
        line-height: 0;
      }

      .invocie-no {
        font-size: 18px;
        line-height: 0;
      }

      .company-address {
        font-size: 18px;
        line-height: 1;
      }

      .company-gst,
      .company-email,
      .company-phone {
        font-size: 18px;
      }

      .bill-ship-details {
        width: auto;
        height: auto;
        display: flex;
        padding: 10px;
      }

      .billto {
        width: 60%;
        height: auto;
        padding: 10px;
      }

      .shipto {
        width: 40%;
        height: auto;
        padding: 10px;
      }

      .product-details {
        width: auto;
        height: auto;
        margin: 10px;
        padding: 10px;
      }

      .table-data {
        border-radius: 5px;
        overflow: hidden;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
        border: none;
        overflow: hidden;
      }

      th,
      td {
        border: 1px solid #3348ff;
        text-align: center;
        padding: 8px;
      }

      thead tr {
        background-color: #3348ff;
        color: white;
      }

      tfoot tr {
        overflow: hidden;
        background-color: #f2f2f2;
        border-bottom-left-radius: 5px;
        border-bottom-right-radius: 5px;
        font-weight: bold;
        border: 1px solid #3348ff;
      }

      tfoot td {
        overflow: hidden;
        text-align: center;
        border-left: none !important;
        border-right: none !important;
      }

      .grand-total {
        text-align: center;
        font-weight: bold;
      }

      .qty,
      .net-amt {
        font-weight: bold;
      }

      .tax-amt {
        width: auto;
        height: auto;
        margin: 10px;
        padding: 10px;
      }

      .net-calc {
        width: auto;
        height: auto;
        padding: 10px;
      }

      .calc {
        display: flex;
        justify-content: end;
        margin: 20px;
      }

    //   .gst-name {
    //     width: 16%;
    //   }

      .gst-amt {
        width: 15%;
        text-align: right;
        padding: 3px;
        style="font-size: 14px;
      }

      .name,
      .amt {
        font-size: 20px;
        font-weight: bold;
      }

      .route-line {
        height: 2px;
        width: 34%;
        background-color: #bebdbd;
        top: 50%;
        left: 0;
      }

      .line-amt {
        display: flex;
        justify-content: end;
        flex-direction: column;
        align-items: end;
        margin: 20px;
      }

      .calc-net-amt {
        display: flex;
        justify-content: space-between;
        width: 32%;
      }

      .terms-condi {
        width: auto;
        height: auto;
        padding: 10px;
      }

      .terms-column {
        display: flex;
        justify-content: start;
        align-content: start;
      }

      .terms {
        width: 50%;
        height: auto;
        margin-left: -10px;
      }

      .condi {
        width: 50%;
        height: auto;
        padding: 10px;
        margin-top: -15px;
      }

      li,
      .para {
        font-size: large;
        line-height: 2;
        text-align: justify;
      }

      .bar {
        height: 40px;
        width: 100%;
        background-color: #d1d6ff;
      }

      .title {
        font-size: large;
        font-weight: bold;
        color: #3348ff;
      }

      /* Responsive Design */
      @media (max-width: 992px) {
        body {
          margin: 20px;
        }
        .outer-border {
        display: flex;
        flex-direction: column;
        justify-content: space-between; 
        min-height: 100vh;
    }
        .logo {
          height: 100px;
          width: 200px;
        }

        .invocie-logo {
          width: 200px;
          padding: 10px;
          align-content: center;
        }

        h1 {
          font-size: 25px;
        }

        .company-address {
          font-size: 10px;
          line-height: 1.5;
          margin-top: -10px;
        }
        .company-gst,
        .company-email,
        .company-phone {
          font-size: 10px;
        }

        span {
          font-size: 10px;
        }

        .invocie-details {
          padding: 5px;
          margin-right: 10px;
        }

        .invocie-title {
          font-size: 20px;
          font-weight: 600;
          line-height: 0.1;
        }

        .invocie-date {
          font-size: 10px;
          line-height: 0;
        }

        .invocie-no {
          font-size: 10px;
          line-height: 0;
        }

        .billto {
          width: 50%;
        }

        .shipto {
          width: 50%;
        }

        strong {
          line-height: 1;
        }

        .para {
          font-size: 10px;
          text-align: justify;
        }

        li {
          font-size: 10px;
          text-align: justify;
        }

        p {
          font-size: 10px;
        }

        .title {
          font-size: 12px;
        }

        table {
          font-size: 10px;
        }

        h2 {
          font-size: 16px;
        }

        .name,
        .amt {
          font-size: 15px;
        }

        .product-details {
          margin-top: -30px;
        }

        .tax-amt {
          margin-top: -30px;
        }

        .calc {
          margin-top: -15px;
        }

        .bill-ship-details {
          margin-top: -15px;
        }

        .terms-condi {
          margin-top: -15px;
        }

        .terms-column {
          margin-top: -10px;
        }

        .terms {
          margin-top: -15px;
          margin-left: -15px;
        }

        .condi {
          margin-top: -20px;
        }
        .company-details {
          width: 75%;
        }
      }

      @media (max-width: 480px) {
        body {
          margin: 0px;
        }

        .outer-border {
          width: min-content;
          height: 100vh;
        }

        .logo {
          height: 150px;
          width: 100px;
        }

        .invocie-logo {
          width: 150px;
          padding: 5px;
          align-content: center;
        }

        .invocie-company-details {
          padding: 5px;
          margin-left: 10px;
        }

        h1 {
          font-size: 20px;
        }

        .company-address,
        .company-gst,
        .company-email,
        .company-phone {
          font-size: small;
        }

        span {
          font-size: small;
        }

        .invocie-details {
          padding: 5px;
          margin-right: 10px;
        }

        .invocie-title {
          font-size: 25px;
          font-weight: 600;
          line-height: 0.1;
        }

        .invocie-date {
          font-size: 12px;
          line-height: 0;
        }

        .invocie-no {
          font-size: 12px;
          line-height: 0;
        }

        p {
          font-size: small;
        }

        .billto {
          width: 50%;
        }

        .shipto {
          width: 50%;
        }

        .product-details {
          margin: 2px;
          padding: 2px;
        }

        table {
          width: 100%;
          overflow: hidden;
        }

        td,
        th {
          font-size: small;
        }

        .name,
        .amt {
          font-size: 10px;
        }

        h2 {
          font-size: medium;
        }

        li {
          font-size: small;
          text-align: justify;
        }

        .para {
          font-size: small;
          text-align: justify;
        }

        strong {
          line-height: 1;
        }

        .condi {
          margin-top: -25px;
        }
      }
    </style>
</head>

<body>
    <div class="outer-border">
        <div class="invocie-header">
            <div class="company-details">
                <div class="invocie-logo">
                <img src='${logoDataUri}' alt="logo" class="logo" />
                </div>
                <div class="invocie-company-details">
                    <h1>Innofashion</h1>
                    <p class="company-address">SAKNAGAR, TN SFNO-61/2PART,THOTTIPALAYAMVILLAGE
                        ZONE, TIRUPUR-641603</p>
                    <p class="company-gst"><span>GSTIN : </span> 33AAGCI9374J1Z5</p>
                    <p class="company-email"><span>Email : </span> INNO.DB@innofashion.IN</p>
                    <p class="company-phone"><span>Phone : </span> 9121760868</p>
                </div>
            </div>
            <div class="invocie-details">
                <p class="invocie-title">Invoice</p>
                <p class="invocie-date"><span>Invoice Date :</span>${formatDate(
                  invoices[0].invoice_date
                )}</p>
                <p class="invocie-no"><span>Invoice No :</span>${invoiceNo}</p>
            </div>
        </div>
        <div class="bill-ship-details">
            <div class="billto">
                <p class="title">Bill To</p>
                <p><strong>${invoices[0].party_branch_name}</strong></p>
                <p>305, 3rd Floor Orion mall, Bengaluru, Karnataka, India - 560055</p>
                <p><span>Email : </span>${partyEmailid}</p>
                <p><span>Phone : </span>${partyPhone}</p>
            </div>
            <div class="shipto">
                <p class="title">Ship To</p>
                <p><strong>${invoices[0].voi_branch_name}</strong></p>
                <p>305, 3rd Floor Orion mall, Bengaluru, Karnataka, India - 560055</p>
                <p><span>Email : </span>${voiEmailid}</p>
                <p><span>Phone : </span>${voiPhone}</p>
            </div>
        </div>
        <div class="product-details">
            <h2>Product List</h2>
            <div class="table-data">
                <table>
                    <thead>
                        <tr>
                            <th>S. No</th>
                            <th>HSN</th>
                            <th>Product</th>
                            <th>Item Code</th>
                            <th>Item Name</th>
                            <th>Size</th>
                            <th>Qty</th>
                            <th>MRP</th>
                            <th>Per Rate</th>
                            <th>Net Amount</th>
                        </tr>
                    </thead>
                    <tbody id="product-table">
                    ${invoicesWithPerRate
                      .map(
                        (invoice, index) => `
                  <tr>
                  <td>${index + 1}</td>
                  <td>${invoice.hsn_code}</td>
                  <td>${invoice.category}</td>
                  <td>${invoice.item_code}</td>
                  <td>${invoice.item_name}</td>
                  <td>${invoice.size}</td>
                  <td>${invoice.sales_quantity}</td>
                  <td>${invoice.mrp}</td>
                  <td>${invoice.perRate}</td>
                  <td>${invoice.gross_amount}</td>
                  </tr> `
                      )
                      .join("")}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="6" class="grand-total">GRAND TOTAL</td>
                            <td class="qty">${totalSalesQuantity}</td>
                            <td colspan="2"></td>
                            <td class="net-amt">₹${grandTotalGrossAmount.toFixed(
                              2
                            )}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
        <div class="tax-amt">
            <h2>Taxable Amount</h2>
            <div class="table-data">
                <table>
                    <thead>
                        <tr>
                            <th>S. No</th>
                            <th>HSN</th>
                            <th>Total Qty</th>
                            <th>CGST %</th>
                            <th>SGST %</th>
                            <th>IGST %</th>
                            <th>Taxable Amount</th>
                            <th>IGST Amount</th>
                            <th>Net Amount</th>
                        </tr>
                    </thead>
                    <tbody id="taxamt">
                    ${hsnGroupedArray
                      .map(
                        (hsn, index) => `
                      <tr>
                        <td>${index + 1}</td>
                        <td>${hsn.hsn_code}</td>
                        <td>${hsn.totalQuantity}</td>
                        <td>${hsn.cgstPercentage}%</td>
                        <td>${hsn.sgstPercentage}%</td>
                        <td>${hsn.igstPercentage}%</td>
                        <td>₹${hsn.taxableAmount.toFixed(2)}</td>
                        <td>₹${hsn.igstAmount.toFixed(2)}</td>
                        <td>₹${(hsn.taxableAmount - hsn.igstAmount).toFixed(
                          2
                        )}</td>
                      </tr> `
                      )
                      .join("")}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" class="grand-total">GRAND TOTAL</td>
                            <td class="qty">${totalSalesQuantity}</td>
                            <td colspan="3"></td>
                            <td class="net-amt">12971.36</td>
                            <td class="net-amt">648.58</td>
                            <td class="net-amt">13619.94</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
        <div class="net-calc">
            <div class="calc">
                <div class="gst-name">
                    <p class="name">GrossAmount :</p>
                    <p class="name">Total IGST(5%):</p>
                    <p class="name">Total TCS</p>
                </div>
                <div class="gst-amt">
                    <p class="amt">${grandTotalGrossAmount.toFixed(2)}</p>
                    <p class="amt">${grandTotalIgstAmount.toFixed(2)}</p>
                    <p class="amt">0</p>
                </div>
            </div>
            <div class="line-amt">
                <div class="route-line"></div>
                <div class="calc-net-amt">
                    <p class="name" style="font-size: 18px;">Net Amount :</p>
                    <p class="amt" style="font-size: 19px;">₹${grandTotal}</p>
                </div>
                <div class="route-line"></div>
            </div>
        </div>
        <div class="terms-condi">
            <h2>Terms and Conditions</h2>
            <div class="terms-column">
                <div class="terms">
                    <ul>
                        <li>Payment requested by cross payeesA/c Cheque only</li>
                        <li> Unlessotherwise started all prices are strictly net.</li>
                        <li>Our responsibility ceases on delivery of the goods to angadia carriers motor transport, rail
                            or post.</li>
                        <li> Goods supplied to order will not be accepted back.</li>
                        <li> The Cause of action shall be deemed to arised in Mumbai disputed shall be settled in
                            Mumbai.</li>
                        <li> Interest @ of 24%per annum will be charged on bills remaining.</li>
                    </ul>
                </div>
                <div class="condi">
                    <p class="para">Any Disputes or Differences whatsoever arising between the Parties
                        relating to this contract shall be subject to jurisdiction of
                        Conciliation & Arbitration Sub Committee for settlement in
                        accordance with Rules for Conciliation of The Clothing
                        Manufacturers Association of India and if not Resolvedthen shall be
                        referred to Arbitration in accordance with the rules Arbitration of
                        The Indian Merchant Chambers as per MOU between CMAI and
                        IMC and award made in pursuance thereof shall be Final and
                        binding on the Parties</p>
                </div>
            </div>
        </div>
        <div class="bar"></div>
    </div>
</body>
</html> `;

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(htmlContent);
    const pdfPath = path.join(__dirname, `invoice-${invoiceNo}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: "A4",
      margin: { top: "5px", bottom: "5px" },
      padding: { top: "10px", right: "10px", bottom: "10px", left: "10px" },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size: 10px; text-align: center; width: 100%;"></div>`,
      footerTemplate: `<div style="font-size: 10px; text-align: center; width: 100%;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
      scale: 1,
    });

    await browser.close();

    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com", 
      port: 587, 
      secure: false, 
      auth: {
        user: "no-reply@thebusstand.com",
        pass: "bdqbqlgqgcnnrxrr",
      },
      tls: {
        rejectUnauthorized: false, 
      },
    });    

    const mailOptions = {
      from: "no-reply@thebusstand.com",
      to: ["anukrishna.nubiznez@gmail.com", "nbzashika@gmail.com"],  
      subject: `Invoice ${invoiceNo}`,
      text: "Please find attached the invoice PDF.",
      attachments: [
        {
          filename: `invoice-${invoiceNo}.pdf`,
          path: pdfPath,
        },
      ],
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
        return res.status(500).send("Error sending email");
      }

      console.log("Email sent: " + info.response);

      fs.unlinkSync(pdfPath);

      res.status(200).send("\u2705 Invoice sent via email successfully.");
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("\u274C Internal Server Error");
  }
};

// POST API for outlet remark
exports.outletRemark = async (req, res) => {
        const { in_invoice_no, item_code, comments } = req.body;
        const image = req.file ? req.file.path : null;

        console.log(req.body);

        if (!in_invoice_no || !item_code || !comments) {
            return res.status(400).json({ success: false, message: 'Fields in_invoice_no, item_Code, and Comments are required.' });
        }

        let pool;
        try {
            pool = await poolPromise;

            const result = await pool.request()
                .input('in_invoice_no', sql.VarChar, in_invoice_no)
                .input('item_code', sql.VarChar, item_code)
                .input('comments', sql.Text, comments)
                .input('image', sql.VarChar, image || null)
                .query(`
                    INSERT INTO innofashion_outlet_remarks_tbl (in_invoice_no, item_code, comments, image)
                    VALUES (@in_invoice_no, @item_code, @comments, COALESCE(@image, '')) `);

            res.status(201).json({
                success: true,
                message: '\u2705 Remark added successfully'
            });
        } catch (dbErr) {
            console.error('Database error:', dbErr);
            res.status(500).json({ success: false, message: 'Database operation failed', error: dbErr.message });
        } finally {
            if (pool) pool.close();
        }
    }
