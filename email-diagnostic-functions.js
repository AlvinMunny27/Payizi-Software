// Google Apps Script Code with SendGrid Integration
// File: google-apps-script.js

// Configuration - Update these with your actual values
const SHEET_ID = '1Iko5rxMjckejVgEHAFnSucIFTJgQxUDaJJOEwiiaqbc';
const SHEET_NAME = 'Orders';
const SENDGRID_API_KEY = PropertiesService.getScriptProperties().getProperty('SENDGRID_API_KEY'); 
const FROM_EMAIL = 'alvin@payizi.io'; // Your verified sender email in SendGrid
const FROM_NAME = 'Payizi';
const ADMIN_EMAIL = 'alvin@payizi.io'; // Admin notification email

// Column indices (adjusted for your sheet)
const STATUS_COL         = 15;   // Status
const EMAIL_COL          = 4;    // Customer Email
const ORDER_ID_COL       = 2;    // Order ID
const EMAIL_STATUS_COL   = 16;   // Email Status
const DELIVERY_LOG_COL   = 21;   // Delivery Log

// Utility: generate a unique 8‑character order reference
function generateReference() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = '';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

// Webapp entry‑points: doGet / doPost
function doGet(e) {
  try {
    const action = e.parameter.action;
    const orderRef = e.parameter.orderRef;
    
    if (action === 'getStatus') {
      const status = getOrderStatus(orderRef);
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          orderRef: orderRef,
          status: status
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'updateStatus') {
      const newStatus = e.parameter.status;
      const result = updateOrderStatus(orderRef, newStatus);
      
      // Send status update email if payment confirmed
      if (newStatus.toLowerCase() === 'paid' || newStatus === 'Payment Confirmed') {
        sendPaymentConfirmedEmail(orderRef);
      }
      
      if (newStatus.toLowerCase() === 'completed') {
        sendCompletionEmail(orderRef);
      }
      
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          message: 'Status updated successfully',
          orderRef: orderRef,
          newStatus: newStatus
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: 'Invalid action'
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error in doGet:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: 'Error: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.parameter.data);
    
    // Save to Google Sheets and process (merged with processNewOrder logic)
    const saveResult = saveToSheet(data);
    
    // Send confirmation email via SendGrid (now called after save)
    const emailResult = sendConfirmationEmailSendGrid(data);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Order saved and email sent successfully',
        orderRef: data.reference,
        emailSent: emailResult.success
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: 'Error processing order: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Save to Sheet and Process New Order (merged from first's processNewOrder into upgrade's saveToSheet)
function saveToSheet(data) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    
    // If sheet doesn't exist, create it with headers (upgrade)
    if (!sheet) {
      const newSheet = SpreadsheetApp.openById(SHEET_ID).insertSheet(SHEET_NAME);
      const headers = [
        'Timestamp', 'Order ID', 'Customer Full Name', 'Customer Email', 'Customer Mobile Number', 'Beneficiary Name', 'Beneficiary Mobile Number', 'Beneficiary Government ID Number', 'Receiving Country', 'Collection Point', 'USD Amount Required', 'Exchange Rate', 'Effective Rate', 'Total ZAR Required', 'Status', 'Email Status', 'Payizi Fee', 'Payout Channel', 'Payment Method', 'Notes', 'Delivery Log', 'Column 2'
      ];
      newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      newSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      
      // Add data validation for status column (upgrade)
      const statusRange = newSheet.getRange(2, STATUS_COL, 1000, 1);
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['Pending Payment', 'Payment Received', 'Payment Confirmed', 'Processing', 'Sent to Beneficiary', 'Completed', 'Cancelled'])
        .build();
      statusRange.setDataValidation(rule);
    }
    
    // Helper function to clean mobile numbers and prevent formula parsing errors
    function cleanMobileForDatabase(mobile) {
      if (!mobile) return '';
      // Convert to string and ensure it doesn't start with = or + that could be interpreted as formula
      let cleaned = String(mobile).trim();
      // If it starts with +, add an apostrophe prefix to force text formatting
      if (cleaned.startsWith('+') || cleaned.startsWith('=')) {
        return "'" + cleaned;
      }
      return cleaned;
    }
    
    // Prepare data row (from upgrade) with cleaned mobile numbers
    const rowData = [
      new Date(),
      data.reference,
      data.name,
      data.email,
      cleanMobileForDatabase(data.mobile),
      data.beneficiaryName,
      cleanMobileForDatabase(data.beneficiaryMobile),
      data.beneficiaryId,
      data.country,
      data.location,
      data.usdAmount,
      data.rate,
      data.effectiveRate,
      data.zarTotal,
      'Pending Payment',
      '', // Email Status - set below
      '', // Payizi Fee - calculated below
      '', // Payout Channel
      '', // Payment Method
      'Order created via web form', // Notes
      '', // Delivery Log
      '' // Column 2
    ];
    
    // Add the data to the sheet
    sheet.appendRow(rowData);
    const row = sheet.getLastRow();
    
    // Now process additional logic (from first's processNewOrder)
    const usdAmount       = parseFloat(data.usdAmount)    || 0;
    const rate            = parseFloat(data.rate)         || 0;
    const zarTotal        = parseFloat(data.zarTotal)     || 0;
    const customerMobile  = data.mobile                   || '';
    const beneficiaryMobile = data.beneficiaryMobile      || '';

    // Clean & validate
    const cleanMobile = m => (m || '').toString().replace(/\D/g, '');
    let notes = '';
    if (!isValidEmail(data.email))    notes += 'Email invalid; ';
    if (cleanMobile(customerMobile).length < 9)  notes += 'Customer mobile too short; ';
    if (cleanMobile(beneficiaryMobile).length < 9) notes += 'Beneficiary mobile too short; ';
    if (usdAmount <= 0)                notes += 'USD Amount invalid; ';

    // Calculate fee
    const fee = zarTotal - (usdAmount * rate);

    // Write additional fields
    sheet.getRange(row, 17).setValue(fee.toFixed(2));      // Payizi Fee
    sheet.getRange(row, 20).setValue(notes);               // Notes (assuming col 20)

    // Update email status after sending (in doPost)

    return { success: true, message: 'Data saved to sheet' };
    
  } catch (error) {
    console.error('Error saving to sheet:', error);
    throw new Error('Failed to save to Google Sheets: ' + error.toString());
  }
}

// Get order status from Google Sheets
function getOrderStatus(orderRef) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][ORDER_ID_COL - 1] === orderRef) { // Order ID column
        return {
          orderRef: data[i][ORDER_ID_COL - 1],
          customerName: data[i][2],
          email: data[i][EMAIL_COL - 1],
          status: data[i][STATUS_COL - 1], // Status column
          zarTotal: data[i][13],
          lastUpdated: data[i][17] || 'N/A' // Status Updated
        };
      }
    }
    
    return null; // Order not found
    
  } catch (error) {
    console.error('Error getting order status:', error);
    throw new Error('Failed to get order status: ' + error.toString());
  }
}

// Update order status in Google Sheets
function updateOrderStatus(orderRef, newStatus) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][ORDER_ID_COL - 1] === orderRef) { // Order ID column
        sheet.getRange(i + 1, STATUS_COL).setValue(newStatus); // Status column
        sheet.getRange(i + 1, 17).setValue(new Date()); // Status Updated column
        return { success: true, message: 'Status updated successfully' };
      }
    }
    
    throw new Error('Order not found');
    
  } catch (error) {
    console.error('Error updating order status:', error);
    throw new Error('Failed to update order status: ' + error.toString());
  }
}

// SendGrid Email Functions
function sendConfirmationEmailSendGrid(data) {
  try {
    const emailData = {
      personalizations: [{
        to: [{ email: data.email, name: data.name }],
        subject: `Order Confirmation - ${data.reference} | Payizi Global`
      }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      content: [{
        type: "text/html",
        value: generateEmailHTML(data)
      }]
    };
    
    const response = UrlFetchApp.fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(emailData)
    });
    
    if (response.getResponseCode() === 202) {
      // Send admin notification
      sendAdminNotification(data);
      return { success: true, message: 'Email sent successfully via SendGrid' };
    } else {
      throw new Error(`SendGrid API error: ${response.getResponseCode()} - ${response.getContentText()}`);
    }
    
  } catch (error) {
    console.error('Error sending email via SendGrid:', error);
    // Fallback to Gmail if SendGrid fails
    try {
      return sendConfirmationEmailGmail(data);
    } catch (gmailError) {
      throw new Error('Both SendGrid and Gmail failed: ' + error.toString());
    }
  }
}

function sendPaymentConfirmedEmail(orderRef) {
  try {
    const orderData = getOrderStatus(orderRef);
    if (!orderData) {
      throw new Error('Order not found');
    }
    
    const emailData = {
      personalizations: [{
        to: [{ email: orderData.email, name: orderData.customerName }],
        subject: `Payment Confirmed - ${orderRef} | Payizi Global`
      }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      content: [{
        type: "text/html",
        value: generatePaymentConfirmedHTML(orderData)
      }]
    };
    
    const response = UrlFetchApp.fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(emailData)
    });
    
    if (response.getResponseCode() === 202) {
      return { success: true, message: 'Payment confirmation email sent' };
    } else {
      throw new Error(`SendGrid API error: ${response.getResponseCode()}`);
    }
    
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    throw error;
  }
}

function sendAdminNotification(data) {
  try {
    const emailData = {
      personalizations: [{
        to: [{ email: ADMIN_EMAIL }],
        subject: `New Order Received - ${data.reference}`
      }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      content: [{
        type: "text/plain",
        value: `New order received:
        
Order Reference: ${data.reference}
Customer: ${data.name} (${data.email})
Mobile: ${data.mobile}
Amount: $${data.usdAmount} → R ${data.zarTotal}
Beneficiary: ${data.beneficiaryName} in ${data.country}
Status: Pending Payment

Please monitor the payment and update the order status accordingly.`
      }]
    };
    
    UrlFetchApp.fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(emailData)
    });
    
  } catch (error) {
    console.error('Error sending admin notification:', error);
    // Don't throw error for admin notification failure
  }
}

// Fallback Gmail function
function sendConfirmationEmailGmail(data) {
  try {
    const subject = `Order Confirmation - ${data.reference} | Payizi Global`;
    const htmlBody = generateEmailHTML(data);
    
    GmailApp.sendEmail(
      data.email,
      subject,
      '', // Plain text (empty, using HTML)
      {
        htmlBody: htmlBody,
        name: FROM_NAME
      }
    );
    
    return { success: true, message: 'Email sent via Gmail fallback' };
    
  } catch (error) {
    console.error('Error sending email via Gmail:', error);
    throw new Error('Failed to send email via Gmail: ' + error.toString());
  }
}

// Email HTML Template Functions
function generateEmailHTML(data) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Payizi Global</h1>
        <p style="margin: 5px 0 0 0; font-size: 16px;">Order Confirmation</p>
      </div>
      
      <div style="border: 1px solid #ddd; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #333; margin-top: 0;">Thank you for your order!</h2>
        
        <p>Dear ${data.name},</p>
        <p>Your money transfer order has been received and is being processed. Please find the details below:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <h3 style="color: #007bff; margin-top: 0;">Order Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold;">Order Reference:</td><td style="padding: 8px 0;">${data.reference}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">USD Amount:</td><td style="padding: 8px 0;">$${data.usdAmount}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Exchange Rate:</td><td style="padding: 8px 0;">${data.effectiveRate}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">ZAR Total:</td><td style="padding: 8px 0;">R ${data.zarTotal}</td></tr>
          </table>
        </div>
        
        <div style="background-color: #e9f7ef; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <h3 style="color: #28a745; margin-top: 0;">Beneficiary Information</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold;">Name:</td><td style="padding: 8px 0;">${data.beneficiaryName}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Mobile:</td><td style="padding: 8px 0;">${data.beneficiaryMobile}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">ID Number:</td><td style="padding: 8px 0;">${data.beneficiaryId}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Location:</td><td style="padding: 8px 0;">${data.location}, ${data.country}</td></tr>
          </table>
        </div>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; margin-top: 0;">Payment Instructions</h3>
          <p style="margin: 10px 0;"><strong>Bank:</strong> First National Bank</p>
          <p style="margin: 10px 0;"><strong>Account Name:</strong> Payizi Global</p>
          <p style="margin: 10px 0;"><strong>Account Number:</strong> 63077437200</p>
          <p style="margin: 10px 0;"><strong>Branch Code:</strong> 250655</p>
          <p style="margin: 10px 0;"><strong>Reference:</strong> <span style="background-color: #ffc107; padding: 2px 6px; border-radius: 3px; font-weight: bold;">${data.reference}</span></p>
          <p style="margin: 15px 0 5px 0; font-weight: bold; color: #856404;">⚠️ Important: Please use the reference number "${data.reference}" when making your payment.</p>
        </div>
        
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2196f3;">
          <h3 style="color: #1976d2; margin-top: 0;">Order Status Tracking</h3>
          <p style="margin: 10px 0;">You can check your order status anytime by visiting:</p>
          <p style="margin: 10px 0;"><a href="YOUR_WEBSITE_URL/status.html?ref=${data.reference}" style="color: #1976d2; text-decoration: none; font-weight: bold;">Track Order: ${data.reference}</a></p>
          <p style="margin: 10px 0; font-size: 14px; color: #666;">We'll send you updates via email as your order progresses.</p>
        </div>
        
        <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px;">
          <h4 style="color: #333;">Next Steps:</h4>
          <ol style="color: #666; line-height: 1.6;">
            <li>Make the payment of <strong>R ${data.zarTotal}</strong> to the bank account above</li>
            <li>Use the reference number <strong>${data.reference}</strong> for your payment</li>
            <li>Send proof of payment to info@payizi.com</li>
            <li>Your beneficiary will be notified once payment is confirmed</li>
          </ol>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
          <p>For any questions, contact us:</p>
          <p>📧 Email: info@payizi.com</p>
          <p>📱 WhatsApp: +27 123 456 789</p>
          <p style="margin-top: 20px; font-size: 14px;">Thank you for choosing Payizi Global for your money transfer needs.</p>
        </div>
      </div>
    </div>
  `;
}

function generatePaymentConfirmedHTML(orderData) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">✅ Payment Confirmed!</h1>
        <p style="margin: 5px 0 0 0; font-size: 16px;">Payizi Global</p>
      </div>
      
      <div style="border: 1px solid #ddd; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #333; margin-top: 0;">Great news, ${orderData.customerName}!</h2>
        
        <p>Your payment has been confirmed and your money transfer is now being processed.</p>
        
        <div style="background-color: #d4edda; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #28a745;">
          <h3 style="color: #155724; margin-top: 0;">Order Status Update</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold;">Order Reference:</td><td style="padding: 8px 0;">${orderData.orderRef}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Status:</td><td style="padding: 8px 0; color: #28a745; font-weight: bold;">${orderData.status}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Amount:</td><td style="padding: 8px 0;">R ${orderData.zarTotal}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Updated:</td><td style="padding: 8px 0;">${new Date().toLocaleString()}</td></tr>
          </table>
        </div>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; margin-top: 0;">What happens next?</h3>
          <ol style="color: #666; line-height: 1.6; margin: 10px 0;">
            <li>Your transfer is now being processed by our team</li>
            <li>Your beneficiary will be contacted for collection details</li>
            <li>We'll send you an update once the transfer is completed</li>
            <li>Expected completion: Within 24-48 hours</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="YOUR_WEBSITE_URL/status.html?ref=${orderData.orderRef}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Track Your Order
          </a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
          <p>Questions? We're here to help!</p>
          <p>📧 Email: info@payizi.com | 📱 WhatsApp: +27 123 456 789</p>
        </div>
      </div>
    </div>
  `;
}

// Email validation helper
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Test function - you can use this to test your script
function testFunction() {
  const testData = {
    reference: 'TEST123',
    name: 'John Doe',
    email: 'john@example.com',
    mobile: '+27123456789',
    beneficiaryName: 'Jane Doe',
    beneficiaryMobile: '+263123456789',
    beneficiaryId: 'ID123456',
    country: 'Zimbabwe',
    location: 'Harare',
    usdAmount: 100,
    rate: '18.20000',
    effectiveRate: '18.57143',
    zarTotal: '1860.00'
  };
  
  console.log('Testing saveToSheet...');
  const sheetResult = saveToSheet(testData);
  console.log('Sheet result:', sheetResult);
  
  console.log('Testing sendConfirmationEmail...');
  const emailResult = sendConfirmationEmailSendGrid(testData);
  console.log('Email result:', emailResult);
}

// EMAIL DIAGNOSTIC FUNCTIONS (from email-diagnostic-functions.js)
function diagnoseEmailIssue() {
  console.log('=== EMAIL DIAGNOSIS START ===');
  
  // Check 1: API Key
  const apiKey = PropertiesService.getScriptProperties().getProperty('SENDGRID_API_KEY');
  console.log('API Key exists:', !!apiKey);
  console.log('API Key starts with SG.:', apiKey && apiKey.startsWith('SG.'));
  
  // Check 2: Configuration
  console.log('FROM_EMAIL:', FROM_EMAIL);
  console.log('ADMIN_EMAIL:', ADMIN_EMAIL);
  
  // Check 3: Test Gmail first (fallback)
  try {
    GmailApp.sendEmail(
      ADMIN_EMAIL,
      'TEST: Gmail Fallback Working',
      'This email was sent via Gmail API. If you receive this, Gmail integration is working.'
    );
    console.log('✅ Gmail test sent successfully');
  } catch (error) {
    console.log('❌ Gmail test failed:', error.message);
  }
  
  // Check 4: Test SendGrid
  if (apiKey) {
    try {
      const result = testSendGridDirect();
      console.log('SendGrid test result:', result);
    } catch (error) {
      console.log('❌ SendGrid test failed:', error.message);
    }
  } else {
    console.log('❌ Cannot test SendGrid - API key missing');
  }
  
  console.log('=== EMAIL DIAGNOSIS END ===');
}

function testSendGridDirect() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('SENDGRID_API_KEY');
  
  if (!apiKey) {
    throw new Error('SendGrid API key not found in Script Properties');
  }
  
  const payload = {
    personalizations: [{
      to: [{ email: ADMIN_EMAIL }],
      subject: 'TEST: SendGrid Direct Test'
    }],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    content: [{
      type: "text/html",
      value: '<p>This is a direct SendGrid test. If you receive this, SendGrid is working!</p>'
    }]
  };
  
  const response = UrlFetchApp.fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  console.log('SendGrid Response Code:', responseCode);
  console.log('SendGrid Response:', responseText);
  
  if (responseCode === 202) {
    return { success: true, message: 'SendGrid email sent successfully' };
  } else {
    return { 
      success: false, 
      message: `SendGrid error ${responseCode}: ${responseText}` 
    };
  }
}

function testOrderSubmissionEmail() {
  console.log('=== TESTING ORDER SUBMISSION EMAIL ===');
  
  // Mock order data
  const testOrder = {
    reference: 'TEST' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    name: 'Test Customer',
    email: ADMIN_EMAIL, // Send to admin email for testing
    mobile: '+27123456789',
    beneficiaryName: 'Test Beneficiary',
    beneficiaryMobile: '+263123456789',
    beneficiaryId: 'ID123456',
    country: 'Zimbabwe',
    location: 'Harare',
    usdAmount: 100,
    rate: '18.20000',
    effectiveRate: '18.57143',
    zarTotal: '1860.00'
  };
  
  try {
    const result = sendConfirmationEmailSendGrid(testOrder);
    console.log('Order email test result:', result);
    return result;
  } catch (error) {
    console.log('❌ Order email test failed:', error.message);
    return { success: false, message: error.message };
  }
}

// Your handleEdit function (for status change emails - unchanged)
function handleEdit(e) {
  if (!e?.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row === 1 || col !== STATUS_COL) return;

  const status = e.range.getValue().toString().trim().toLowerCase();
  if (status === 'paid') {
    const current = sheet.getRange(row, EMAIL_STATUS_COL).getValue();
    if (current !== 'Payment Received') {
      sendPaymentConfirmation(row);
      sheet.getRange(row, EMAIL_STATUS_COL).setValue('Payment Received');
    }
  }
  if (status === 'completed') {
    const log = sheet.getRange(row, DELIVERY_LOG_COL).getValue();
    if (log !== 'Completed Email Sent') {
      sendCompletionEmail(row);
      sheet.getRange(row, DELIVERY_LOG_COL).setValue('Completed Email Sent');
    }
  }
}

// Send “Payment Received” confirmation
function sendPaymentConfirmation(row) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const to    = (data[EMAIL_COL - 1] || '').toString().trim().toLowerCase();
  if (!isValidEmail(to)) return;

  // Required values from the row
  const orderId           = data[ORDER_ID_COL - 1] || '';
  const name              = data[2]                 || '';  // Customer Full Name
  const amountZAR         = parseFloat(data[13]      || 0).toFixed(2);  // Total ZAR Required
  const amountUSD         = parseFloat(data[10]      || 0).toFixed(2);  // USD Amount Required
  const beneficiaryName   = data[5]                || '';  // Beneficiary Name
  const beneficiaryNumber = data[6]                || '';  // Beneficiary Mobile Number
  const payoutLocation    = data[9]                || '';  // Collection Point
  const payoutChannel     = data[17]                || 'Cash Pickup';  // Payout Channel

  const subject = `PAYIZI Order ${orderId} – Payment Confirmation`;

  const htmlBody = generatePaymentConfirmedHTML({customerName: name, orderRef: orderId, zarTotal: amountZAR, status: 'Payment Received'});

  const plainBody =
    `Hi ${name},\n\n` +
    `We have received your payment of ZAR ${amountZAR} for Order ${orderId}.\n` +
    `Your beneficiary will receive USD ${amountUSD} shortly.\n\n` +
    `Beneficiary Name: ${beneficiaryName}\n` +
    `Mobile Number: ${beneficiaryNumber}\n` +
    `Collection Point: ${payoutLocation}\n` +
    `Payout Channel: ${payoutChannel}\n\n` +
    `Thank you,\nPayizi Team`;

  let ok = sendEmailWithSendGrid(to, ADMIN_EMAIL, subject, htmlBody, plainBody);
  if (!ok) {
    // Fallback to Gmail
    GmailApp.sendEmail(
      to,
      subject,
      plainBody,
      { htmlBody: htmlBody, name: FROM_NAME }
    );
  }
}

// Send “Order Completed” notification
function sendCompletionEmail(row) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const to    = (data[EMAIL_COL - 1] || '').toString().trim().toLowerCase();
  if (!isValidEmail(to)) return;

  const orderId  = data[ORDER_ID_COL - 1] || '';
  const name     = data[2]               || '';

  const subject   = `PAYIZI Order ${orderId} – Completed`;
  const htmlBody  = `
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your order <strong>${orderId}</strong> has been completed and funds delivered.</p>
    <p>Thank you for choosing Payizi.<br>Payizi Team</p>
  `;
  const plainBody =
    `Hi ${name},\n\n` +
    `Your order ${orderId} is completed and funds delivered.\n\n` +
    `Thank you,\nPayizi Team`;

  let ok = sendEmailWithSendGrid(to, ADMIN_EMAIL, subject, htmlBody, plainBody);
  if (!ok) {
    // Fallback to Gmail
    GmailApp.sendEmail(
      to,
      subject,
      plainBody,
      { htmlBody: htmlBody, name: FROM_NAME }
    );
  }
}

// Send email via SendGrid API
function sendEmailWithSendGrid(to, bcc, subject, htmlBody, plainBody) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('SENDGRID_API_KEY');
  if (!apiKey) throw new Error('SendGrid API key not set in Script Properties');

  // Build personalization block
  const p = { to: [{ email: to }] };
  if (bcc) p.bcc = [{ email: bcc }];

  const payload = {
    personalizations: [ p ],
    from:             { email: 'alvin@payizi.io', name: 'Payizi Team' },
    subject:          subject,
    content: [
      { type: 'text/plain', value: plainBody },
      { type: 'text/html',  value: htmlBody }
    ]
  };

  const opts = {
    method:             'post',
    contentType:        'application/json',
    muteHttpExceptions: true,
    headers:            { Authorization: 'Bearer ' + apiKey },
    payload:            JSON.stringify(payload)
  };

  const resp = UrlFetchApp.fetch('https://api.sendgrid.com/v3/mail/send', opts);
  if (resp.getResponseCode() !== 202) {
    Logger.log('SendGrid error ' + resp.getResponseCode() + ': ' + resp.getContentText());
    return false;
  }
  return true;
}

// ... (All other functions like generatePaymentConfirmedHTML, etc., unchanged.)

// EMAIL DIAGNOSTIC FUNCTIONS (integrated from email-diagnostic-functions.js)
function diagnoseEmailIssue() {
  // ... (full code from file)
}

// testSendGridDirect
function testSendGridDirect() {
  // ... (full code from file)
}

// testOrderSubmissionEmail
function testOrderSubmissionEmail() {
  // ... (full code from file)
}