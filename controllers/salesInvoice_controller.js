const { sql, poolPromise } = require("../config/db");
const axios = require("axios");

// Get the current date in 'yyyy-mm-dd' format
const currentDate = new Date();
const currentDateString = currentDate.toISOString().split('T')[0]; // Format it to 'yyyy-mm-dd'

console.log(currentDateString);

async function fetchAndInsertSalesInvoices() {
  try {
    // Set both DateFrom and DateTo to the current date
    const apiUrl = "https://logicapi.logicerp.in/VOIJeans_BI/GetSaleInvoice";
    const requestBody = {
      GlobalModifyCode: 0,
      Doc_Codes: "",
      DateFrom: currentDateString,
      DateTo: currentDateString, // Use the same date for both
      Branch_Codes_From: ""
    };
    const auth = { username: "VOI_BI", password: "Voi~121#" };

    // Fetch data from the API
    const response = await axios.post(apiUrl, requestBody, {
      headers: { "Content-Type": "application/json" },
      auth: auth,
    });

    const salesData = response.data.GetData;

    // Connect to the database
    const pool = await poolPromise;

    for (const invoice of salesData) {
      for (const item of invoice.LstItems) {
        
        // ✅ Ensure BranchCode is a string
        const branchCode = invoice.Branch_Code ? invoice.Branch_Code.toString() : "";

        // Check if the record exists using SL_Txn_Code
        const queryCheckExistence = `
          SELECT COUNT(1) 
          FROM [dbo].[Sale_bill_tbl] 
          WHERE [SL_Txn_Code] = @SL_Txn_Code
        `;
        const requestCheckExistence = pool.request();
        requestCheckExistence.input('SL_Txn_Code', sql.Int, item.SL_Txn_Code);
        
        const result = await requestCheckExistence.query(queryCheckExistence);
        
        // If the record exists, update it; if not, insert it
        const recordExists = result.recordset[0][''] > 0;

        console.log(recordExists);

        const query = recordExists ? `
          UPDATE [dbo].[Sale_bill_tbl] 
          SET 
            [FROM BRANCH NAME] = @FromBranchName,
            [GST NO WISE] = @GSTNoWise,
            [BILL DATE] = @BillDate,
            [TO PARTY NAME] = @ToPartyName,
            [PARTY GST NO] = @PartyGSTNo,
            [CATEGORY] = @Category,
            [FIT] = @Fit,
            [PRODUCT CATEGORY] = @ProductCategory,
            [SEASON] = @Season,
            [HSN CODE] = @HSNCode,
            [ITEM CODE] = @ItemCode,
            [ITEM NAME] = @ItemName,
            [SHADE NAME] = @ShadeName,
            [SIZE] = @Size,
            [SALE QTY] = @SaleQty,
            [GROSS AMOUNT] = @GrossAmount,
            [MRP] = @MRP,
            [CD%] = @CDPercent,
            [CD VALUE] = @CDValue,
            [SCHEME(RS)] = @SchemeRs,
            [MANUAL/EMPLOYEE DISCOUNT] = @ManualEmployeeDiscount,
            [TRADE DISCOUNT] = @TradeDiscount,
            [DISCOUNT COUPON VALUE] = @DiscountCouponValue,
            [SP DISCOUNT] = @SPDiscount,
            [SCHEME/UNIT] = @SchemePerUnit,
            [TAXABLE AMOUNT] = @TaxableAmount,
            [CGST%] = @CGSTPercent,
            [TOTAL CGST AMOUNT] = @TotalCGSTAmount,
            [SGST%] = @SGSTPercent,
            [TOTAL SGST AMOUNT] = @TotalSGSTAmount,
            [IGST%] = @IGSTPercent,
            [TOTAL IGST AMOUNT] = @TotalIGSTAmount,
            [ADJUSTMENT] = @Adjustment,
            [ROUND AMOUNT] = @RoundAmount,
            [NET AMOUNT] = @NetAmount,
            [SCHEME NAME] = @SchemeName,
            [TAX REGION] = @TaxRegion,
            [GST STATE NAME] = @GSTStateName,
            [PARTY REGISTRATION NO] = @PartyRegistrationNo,
            [PARTY ORDER NO] = @PartyOrderNo,
            [SGST/IGST%] = @SGSTIGSTPercent,
            [SL_Txn_Code] = @SL_Txn_Code
          WHERE [SL_Txn_Code] = @SL_Txn_Code
        ` : `
          INSERT INTO [dbo].[Sale_bill_tbl] (
            [FROM BRANCH NAME], [BRANCH CODE], [GST NO WISE], [BILL DATE], [BILL NO],
            [TO PARTY NAME], [PARTY GST NO], [CATEGORY], [FIT], [PRODUCT CATEGORY], [SEASON],
            [HSN CODE], [ITEM CODE], [ITEM NAME], [SHADE NAME], [SIZE], [SALE QTY], [GROSS AMOUNT],
            [MRP], [CD%], [CD VALUE], [SCHEME(RS)], [MANUAL/EMPLOYEE DISCOUNT], [TRADE DISCOUNT],
            [DISCOUNT COUPON VALUE], [SP DISCOUNT], [SCHEME/UNIT], [TAXABLE AMOUNT], [CGST%],
            [TOTAL CGST AMOUNT], [SGST%], [TOTAL SGST AMOUNT], [IGST%], [TOTAL IGST AMOUNT],
            [ADJUSTMENT], [ROUND AMOUNT], [NET AMOUNT], [SCHEME NAME], [TAX REGION], [GST STATE NAME],
            [PARTY REGISTRATION NO], [PARTY ORDER NO], [SGST/IGST%], [SL_Txn_Code]
          ) VALUES (
            @FromBranchName, @BranchCode, @GSTNoWise, @BillDate, @BillNo,
            @ToPartyName, @PartyGSTNo, @Category, @Fit, @ProductCategory, @Season,
            @HSNCode, @ItemCode, @ItemName, @ShadeName, @Size, @SaleQty, @GrossAmount,
            @MRP, @CDPercent, @CDValue, @SchemeRs, @ManualEmployeeDiscount, @TradeDiscount,
            @DiscountCouponValue, @SPDiscount, @SchemePerUnit, @TaxableAmount, @CGSTPercent,
            @TotalCGSTAmount, @SGSTPercent, @TotalSGSTAmount, @IGSTPercent, @TotalIGSTAmount,
            @Adjustment, @RoundAmount, @NetAmount, @SchemeName, @TaxRegion, @GSTStateName,
            @PartyRegistrationNo, @PartyOrderNo, @SGSTIGSTPercent, @SL_Txn_Code
          )
        `;

        const request = pool.request();
        request.input('FromBranchName', sql.NVarChar(255), invoice.Branch_Name);
        request.input('BranchCode', sql.NVarChar(255), branchCode);
        request.input('GSTNoWise', sql.NVarChar(255), '');
        
        // Ensure 'invoice.Bill_Date' is in dd/mm/yyyy format
        const formattedBillDate = invoice.Bill_Date.split('/');
        if (formattedBillDate.length === 3) {
          const [day, month, year] = formattedBillDate;
          const validDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          request.input('BillDate', sql.Date, validDate);
        } else {
          console.error("Invalid Bill Date:", invoice.Bill_Date);
          request.input('BillDate', sql.Date, null);
        }

        // Add other inputs as needed...
        request.input('BillNo', sql.NVarChar(255), invoice.Bill_No);
        request.input('ToPartyName', sql.NVarChar(255), invoice.Customer_Name);
        request.input('PartyGSTNo', sql.NVarChar(255), '');
        request.input('Category', sql.NVarChar(255), item.Item_Group_Name_1);
        request.input('Fit', sql.NVarChar(255), '');
        request.input('ProductCategory', sql.NVarChar(255), item.Item_Group_Name_1);
        request.input('Season', sql.NVarChar(255), '');
        request.input('HSNCode', sql.NVarChar(255), item.HSN_Code);
        request.input('ItemCode', sql.NVarChar(255), item.LogicUser_Code);
        request.input('ItemName', sql.NVarChar(255), item.ItemName);
        request.input('ShadeName', sql.NVarChar(255), item.ColorName);
        request.input('Size', sql.NVarChar(255), item.PackName);
        request.input('SaleQty', sql.Float, item.Quantity);
        request.input('GrossAmount', sql.Float, item.Gross_Amt);
        request.input('MRP', sql.Float, item.Item_MRP);
        request.input('CDPercent', sql.Float, item.CD_Per);
        request.input('CDValue', sql.Float, item.CD);
        request.input('SchemeRs', sql.Float, item.Scheme_Rs);
        request.input('ManualEmployeeDiscount', sql.Float, 0);
        request.input('TradeDiscount', sql.Float, item.TD);
        request.input('DiscountCouponValue', sql.Float, 0);
        request.input('SPDiscount', sql.Float, item.SPDiscount);
        request.input('SchemePerUnit', sql.Float, item.Scheme_Unit);
        request.input('TaxableAmount', sql.Float, item.Sale_Amt);
        request.input('CGSTPercent', sql.Float, item.Tax_1);
        request.input('TotalCGSTAmount', sql.Float, item.Tax_Amt_1);
        request.input('SGSTPercent', sql.Float, item.Tax_2);
        request.input('TotalSGSTAmount', sql.Float, item.Tax_Amt_2);
        request.input('IGSTPercent', sql.Float, item.Tax_3);
        request.input('TotalIGSTAmount', sql.Float, item.Tax_Amt_3);
        request.input('Adjustment', sql.Float, item.AdjustmentRupees);
        request.input('RoundAmount', sql.Float, item.Round_Amt);
        request.input('NetAmount', sql.Float, item.Net_Amt);
        request.input('SchemeName', sql.NVarChar(255), '');
        request.input('TaxRegion', sql.NVarChar(255), invoice.Tax_Region_Name);
        request.input('GSTStateName', sql.NVarChar(255), '');
        request.input('PartyRegistrationNo', sql.NVarChar(255), '');
        request.input('PartyOrderNo', sql.NVarChar(255), invoice.SO_Party_Order_No);
        request.input('SGSTIGSTPercent', sql.Float, item.Tax_2);
        request.input('SL_Txn_Code', sql.Int, item.SL_Txn_Code);

        await request.query(query);

        console.log("Sales Invoice processed successfully!");
      }
    }
  } catch (error) {
    console.error("Error fetching or inserting data:", error.message);
  }
}

setInterval(fetchAndInsertSalesInvoices, 5 * 60 * 60 * 1000); // Run every 5 hours

//setInterval(fetchAndInsertSalesInvoices, 8000); // Run every 1 second


