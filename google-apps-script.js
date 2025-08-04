// Google Apps Script Code with SendGrid Integration
// File: google-apps-script.js

// Configuration - Update these with your actual values
const SHEET_ID = '1Iko5rxMjckejVgEHAFnSucIFTJgQxUDaJJOEwiiaqbc';
const SHEET_NAME = 'Orders';
// SECURITY: API key should be stored in Script Properties, not hardcoded
const SENDGRID_API_KEY = PropertiesService.getScriptProperties().getProperty('SENDGRID_API_KEY'); 
const FROM_EMAIL = 'alvin@payizi.io'; // Your verified sender email in SendGrid
const FROM_NAME = 'Payizi';
const ADMIN_EMAIL = 'alvin@payizi.io'; // Admin notification email

function doPost(e) {
  try {
    const data = JSON.parse(e.parameter.data);
    
    // Save to Google Sheets
    const saveResult = saveToSheet(data);
    
    // Send confirmation email via SendGrid
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

// Handle GET requests for order status updates
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
      if (newStatus === 'Payment Confirmed') {
        sendPaymentConfirmedEmail(orderRef);
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

function saveToSheet(data) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    
    // If sheet doesn't exist, create it with headers
    if (!sheet) {
      const newSheet = SpreadsheetApp.openById(SHEET_ID).insertSheet(SHEET_NAME);
      const headers = [
        'Timestamp', 'Order Reference', 'Customer Name', 'Email', 'Mobile',
        'Beneficiary Name', 'Beneficiary Mobile', 'Beneficiary ID', 
        'Country', 'Location', 'USD Amount', 'Rate', 'Effective Rate', 
        'ZAR Total', 'Status', 'Payment Proof', 'Status Updated', 'Notes'
      ];
      newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      newSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      
      // Add data validation for status column
      const statusRange = newSheet.getRange(2, 15, 1000, 1); // Status column
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['Pending Payment', 'Payment Received', 'Payment Confirmed', 'Processing', 'Sent to Beneficiary', 'Completed', 'Cancelled'])
        .build();
      statusRange.setDataValidation(rule);
    }
    
    const targetSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    
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
    
    // Prepare data row with cleaned mobile numbers
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
      '', // Payment Proof
      '', // Status Updated
      'Order created via web form' // Notes
    ];
    
    // Add the data to the sheet
    targetSheet.appendRow(rowData);
    
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
      if (data[i][1] === orderRef) { // Order Reference column
        return {
          orderRef: data[i][1],
          customerName: data[i][2],
          email: data[i][3],
          status: data[i][14], // Status column
          zarTotal: data[i][13],
          lastUpdated: data[i][16] || 'N/A'
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
      if (data[i][1] === orderRef) { // Order Reference column
        sheet.getRange(i + 1, 15).setValue(newStatus); // Status column
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
  const emailResult = sendConfirmationEmail(testData);
  console.log('Email result:', emailResult);
}

// Test function
function testSendGridFunction() {
  const testData = {
    reference: 'TEST123',
    name: 'John Doe',
    email: 'test@example.com',
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
  
  console.log('Testing SaveToSheet...');
  const sheetResult = saveToSheet(testData);
  console.log('Sheet result:', sheetResult);
  
  console.log('Testing SendGrid email...');
  const emailResult = sendConfirmationEmailSendGrid(testData);
  console.log('Email result:', emailResult);
}

// ============================================================================
// EMAIL DIAGNOSTIC FUNCTIONS - Use these to troubleshoot email issues
// ============================================================================

/**
 * MAIN DIAGNOSTIC FUNCTION - Run this first to identify email issues
 * This will test your entire email setup and provide detailed feedback
 */
function runEmailDiagnosis() {
  console.log('🔍 STARTING COMPREHENSIVE EMAIL DIAGNOSIS...');
  console.log('='.repeat(60));
  
  // Check 1: Script Properties (API Key)
  console.log('\n📋 CHECKING CONFIGURATION...');
  const apiKey = PropertiesService.getScriptProperties().getProperty('SENDGRID_API_KEY');
  console.log('✅ API Key exists:', !!apiKey);
  console.log('✅ API Key format correct:', apiKey && apiKey.startsWith('SG.'));
  console.log('📧 FROM_EMAIL:', FROM_EMAIL);
  console.log('📧 ADMIN_EMAIL:', ADMIN_EMAIL);
  
  if (!apiKey) {
    console.log('\n❌ CRITICAL ISSUE: SendGrid API key missing!');
    console.log('🔧 FIX: Go to Project Settings → Script Properties');
    console.log('   Add: Key="SENDGRID_API_KEY", Value="your_sendgrid_api_key"');
    return { success: false, issue: 'Missing API Key' };
  }
  
  // Check 2: Test Gmail (fallback system)
  console.log('\n🧪 TESTING GMAIL FALLBACK...');
  let gmailWorking = false;
  try {
    GmailApp.sendEmail(
      ADMIN_EMAIL,
      '✅ DIAGNOSIS: Gmail Test Successful',
      'This email confirms that Gmail integration is working properly as a fallback system.',
      { name: FROM_NAME }
    );
    console.log('✅ Gmail test sent successfully');
    gmailWorking = true;
  } catch (error) {
    console.log('❌ Gmail failed:', error.message);
    console.log('🔧 FIX: Authorize Gmail permissions in Google Apps Script');
  }
  
  // Check 3: Test SendGrid API
  console.log('\n🧪 TESTING SENDGRID API...');
  const sendGridResult = testSendGridAPI();
  
  // Check 4: Test Complete Order Flow
  console.log('\n🧪 TESTING COMPLETE ORDER FLOW...');
  const orderFlowResult = testCompleteOrderSubmission();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSIS SUMMARY:');
  console.log('✅ API Key Configured:', !!apiKey);
  console.log('✅ Gmail Working:', gmailWorking);
  console.log('✅ SendGrid Working:', sendGridResult.success);
  console.log('✅ Order Flow Working:', orderFlowResult.success);
  
  if (sendGridResult.success && gmailWorking) {
    console.log('🎉 ALL SYSTEMS WORKING! Emails should be delivered.');
  } else {
    console.log('⚠️  ISSUES FOUND - Check the logs above for specific problems.');
  }
  
  return {
    success: sendGridResult.success || gmailWorking,
    apiKey: !!apiKey,
    gmail: gmailWorking,
    sendgrid: sendGridResult.success,
    orderFlow: orderFlowResult.success
  };
}

/**
 * Test SendGrid API directly with detailed error reporting
 */
function testSendGridAPI() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('SENDGRID_API_KEY');
  
  if (!apiKey) {
    console.log('❌ Cannot test SendGrid - API key missing');
    return { success: false, error: 'API key missing' };
  }
  
  const payload = {
    personalizations: [{
      to: [{ email: ADMIN_EMAIL, name: 'Test Recipient' }],
      subject: '✅ DIAGNOSIS: SendGrid API Test Successful'
    }],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    content: [{
      type: "text/html",
      value: `
        <h2>🎉 SendGrid Test Successful!</h2>
        <p>Your SendGrid integration is working properly.</p>
        <p><strong>Test Details:</strong></p>
        <ul>
          <li>API Key: Configured ✅</li>
          <li>Sender: ${FROM_EMAIL} ✅</li>
          <li>Timestamp: ${new Date().toISOString()}</li>
        </ul>
        <p>You can now process real orders with confidence!</p>
      `
    }]
  };
  
  try {
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
    
    console.log('📨 SendGrid Response Code:', responseCode);
    
    if (responseCode === 202) {
      console.log('✅ SendGrid test sent successfully');
      return { success: true, code: responseCode };
    } else {
      console.log('❌ SendGrid Error Response:', responseText);
      
      // Detailed error analysis
      if (responseCode === 401) {
        console.log('🔧 FIX: Invalid API key - check Script Properties');
      } else if (responseCode === 403) {
        console.log('🔧 FIX: Sender not verified - check SendGrid sender authentication');
      } else if (responseCode === 400) {
        console.log('🔧 FIX: Bad request - check email format and payload');
      }
      
      return { success: false, code: responseCode, error: responseText };
    }
    
  } catch (error) {
    console.log('❌ SendGrid API call failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test complete order submission flow
 */
function testCompleteOrderSubmission() {
  console.log('🧪 Testing complete order submission...');
  
  const testOrder = {
    reference: 'DIAG' + Date.now(),
    name: 'Test Customer',
    email: ADMIN_EMAIL, // Send to admin for testing
    mobile: '+27123456789',
    beneficiaryName: 'Test Beneficiary',
    beneficiaryMobile: '+263123456789',
    beneficiaryId: 'ID123456',
    beneficiaryRelation: 'Friend',
    country: 'Zimbabwe',
    city: 'Harare',
    usdAmount: '100',
    zarRate: '18.50',
    zarTotal: '1850',
    timestamp: new Date().toISOString()
  };
  
  try {
    // Test 1: Save to Google Sheets
    console.log('📊 Testing sheet save...');
    const saveResult = saveToSheet(testOrder);
    console.log('✅ Sheet save successful:', saveResult);
    
    // Test 2: Send confirmation email
    console.log('📧 Testing email send...');
    const emailResult = sendConfirmationEmailSendGrid(testOrder);
    console.log('✅ Email send result:', emailResult);
    
    console.log('🎉 Complete order flow test successful!');
    console.log('📋 Test Order Reference:', testOrder.reference);
    
    return { 
      success: true, 
      orderRef: testOrder.reference,
      sheetSaved: true,
      emailSent: emailResult.success
    };
    
  } catch (error) {
    console.log('❌ Order flow test failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Quick API key check function
 */
function checkScriptProperties() {
  console.log('📋 CHECKING SCRIPT PROPERTIES...');
  const properties = PropertiesService.getScriptProperties().getProperties();
  
  console.log('All Script Properties:');
  for (const [key, value] of Object.entries(properties)) {
    if (key === 'SENDGRID_API_KEY') {
      console.log(`${key}: ${value ? value.substring(0, 10) + '...' : 'NOT SET'}`);
    } else {
      console.log(`${key}: ${value}`);
    }
  }
  
  const apiKey = properties.SENDGRID_API_KEY;
  if (!apiKey) {
    console.log('\n❌ SENDGRID_API_KEY not found!');
    console.log('🔧 TO FIX:');
    console.log('1. Go to Project Settings (⚙️ icon)');
    console.log('2. Scroll to "Script properties"');
    console.log('3. Click "Add script property"');
    console.log('4. Key: SENDGRID_API_KEY');
    console.log('5. Value: Your SendGrid API key');
    console.log('6. Click Save');
  } else if (!apiKey.startsWith('SG.')) {
    console.log('\n⚠️ API key format looks incorrect');
    console.log('SendGrid API keys should start with "SG."');
  } else {
    console.log('\n✅ SendGrid API key looks correct');
  }
}

/**
 * Test Gmail permissions and functionality
 */
function testGmailFunctionality() {
  console.log('📧 TESTING GMAIL FUNCTIONALITY...');
  
  try {
    // Test basic Gmail send
    GmailApp.sendEmail(
      ADMIN_EMAIL,
      '✅ Gmail Permission Test',
      'This email confirms Gmail API access is working properly.',
      {
        name: FROM_NAME,
        htmlBody: `
          <h2>Gmail API Test Successful</h2>
          <p>Gmail integration is working as a fallback system.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        `
      }
    );
    
    console.log('✅ Gmail test email sent successfully');
    
    // Check Gmail quota
    const quota = GmailApp.getGmailQuota();
    console.log('📊 Gmail quota remaining:', quota);
    
    return { success: true, quota: quota };
    
  } catch (error) {
    console.log('❌ Gmail test failed:', error.message);
    console.log('🔧 FIX: Re-authorize the script and grant Gmail permissions');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// END DIAGNOSTIC FUNCTIONS
// ============================================================================
