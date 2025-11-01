const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const app = express();
const PORT = process.env.PORT || 3000;

// Sandbox secret key (in production, this should be stored securely)
const SANDBOX_SECRET_KEY = 'test_secret_key_123';

// Middleware
// Trust proxy for accurate protocol detection (important for dynamic URLs)
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// In-memory storage for transactions (in production, use a database)
const transactions = new Map();

// In-memory storage for IPN notifications
const ipnNotifications = new Map();

// Helper function to detect card brand
function detectCardBrand(cardNumber) {
  const number = cardNumber.replace(/\s/g, '');
  
  if (/^4/.test(number)) return 'VISA';
  if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'MASTERCARD';
  if (/^3[47]/.test(number)) return 'AMEX';
  
  return 'UNKNOWN';
}

// Helper function to validate card number (Luhn algorithm)
function validateCardNumber(cardNumber) {
  const number = cardNumber.replace(/\s/g, '');
  if (!/^\d{12,19}$/.test(number)) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

// Helper function to validate card expiry
function validateCardExpiry(month, year) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  if (month < 1 || month > 12) return false;
  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  
  return true;
}

// Mock 3DS authentication simulation
async function simulate3DS(trx) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate 3DS completion - randomly succeed or fail
      const success = Math.random() > 0.2; // 80% success rate
      resolve(success);
    }, 2000); // Simulate 2 second delay
  });
}

// POST /h2h/initiate - Initiate card payment
app.post('/h2h/initiate', async (req, res) => {
  try {
    // Get dynamic base URL from request
    const protocol = req.protocol || (req.secure ? 'https' : 'http');
    const host = req.get('host');
    if (!host) {
      return res.status(400).json({
        status: 'error',
        message: ['Host header is required']
      });
    }
    const baseUrl = `${protocol}://${host}`;
    
    const {
      public_key,
      amount,
      currency,
      payment_method_type,
      customer,
      card,
      billing_address,
      device_fingerprint,
      details,
      identifier,
      ipn_url,
      success_url,
      cancel_url,
      site_name
    } = req.body;

    // Validation
    const errors = [];

    if (!public_key) errors.push('public_key is required');
    if (!amount || amount <= 0) errors.push('amount must be greater than 0');
    if (!currency) errors.push('currency is required');
    if (payment_method_type !== 'card') errors.push('payment_method_type must be "card"');
    
    if (!customer || !customer.first_name || !customer.last_name || !customer.email || !customer.mobile) {
      errors.push('customer information is incomplete');
    }
    
    if (!card || !card.number || !card.expiry_month || !card.expiry_year || !card.cvv || !card.holder) {
      errors.push('card information is incomplete');
    }
    
    // Validate expiry_year format - must be 2 digits
    if (card && card.expiry_year !== undefined) {
      const yearStr = card.expiry_year.toString();
      if (!/^\d{2}$/.test(yearStr)) {
        errors.push('expiry_year must be 2 digits (e.g., 31 for 2031)');
      }
    }
    
    if (!billing_address || !billing_address.country) {
      errors.push('billing_address.country is required');
    }
    
    if (!device_fingerprint) errors.push('device_fingerprint is required');
    if (!details) errors.push('details is required');
    if (!identifier) errors.push('identifier is required');
    if (!ipn_url) errors.push('ipn_url is required');
    if (!success_url) errors.push('success_url is required');
    if (!cancel_url) errors.push('cancel_url is required');
    if (!site_name) errors.push('site_name is required');

    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: errors
      });
    }

    // Clean card number for validation
    const cardNumberClean = card.number.replace(/\s/g, '');
    
    // Skip Luhn validation for sandbox test cards
    const isSandboxTestCard = cardNumberClean === '5356222233334444' || 
                              cardNumberClean.endsWith('468') || 
                              cardNumberClean.endsWith('579');
    
    // Validate card number (skip Luhn for sandbox test cards)
    if (!isSandboxTestCard && !validateCardNumber(card.number)) {
      return res.status(400).json({
        status: 'error',
        message: ['Invalid card number']
      });
    }
    
    // Basic format validation for all cards
    if (!/^\d{12,19}$/.test(cardNumberClean)) {
      return res.status(400).json({
        status: 'error',
        message: ['Invalid card number format']
      });
    }

    // Convert 2-digit year to 4-digit for validation
    // expiry_year must be provided as 2 digits (e.g., 31 for 2031)
    let expiryYear = parseInt(card.expiry_year);
    if (expiryYear < 100) {
      // 2-digit year: add 2000 to convert to 4-digit (00-99 = 2000-2099)
      expiryYear = 2000 + expiryYear;
    }
    
    // Validate card expiry
    if (!validateCardExpiry(card.expiry_month, expiryYear)) {
      return res.status(400).json({
        status: 'error',
        message: ['Card has expired or invalid expiry date']
      });
    }

    // Validate CVV
    if (!/^\d{3,4}$/.test(card.cvv)) {
      return res.status(400).json({
        status: 'error',
        message: ['Invalid CVV']
      });
    }

    // Detect card brand if not provided
    const cardBrand = card.type || detectCardBrand(card.number);
    
    // Generate transaction ID
    const trx = uuidv4();

    // Test card numbers for sandbox scenarios (cardNumberClean already defined above)
    
    let paymentStatus;
    let requires3DS = false;
    let redirectUrl = null;
    let otpCode = null;

    // Special test cases based on card number
    if (cardNumberClean === '5356222233334444') {
      // Specific card - OK (success)
      paymentStatus = 'success';
      requires3DS = false;
      // For non-3DS payments, redirect_url should be null
      redirectUrl = null;
    } else if (cardNumberClean.endsWith('468')) {
      // Cards ending in 468 - 2D (instant success, no 3DS)
      paymentStatus = 'success';
      requires3DS = false;
      // For non-3DS payments, redirect_url should be null
      redirectUrl = null;
    } else if (cardNumberClean.endsWith('579')) {
      // Cards ending in 579 - 3D with OTP: 666666
      paymentStatus = 'pending';
      requires3DS = true;
      otpCode = '666666';
      // For 3DS, redirect to our 3DS page, then redirect to client URLs after auth
      // Use dynamic base URL from request
      redirectUrl = `${baseUrl}/3ds?trx=${trx}&success_url=${encodeURIComponent(success_url)}&cancel_url=${encodeURIComponent(cancel_url)}&otp=${otpCode}`;
    } else {
      // All other cards - return error
      return res.status(400).json({
        status: 'error',
        message: ['Card number not allowed in sandbox. Use test cards: 5356 2222 3333 4444, *468, or *579']
      });
    }

    // Store transaction
    const transaction = {
      trx,
      public_key,
      amount,
      currency,
      payment_method_type,
      customer,
      card: {
        ...card,
        number: card.number.replace(/\d(?=\d{4})/g, '*'), // Mask card number
        expiry_year: expiryYear, // Use converted 4-digit year for storage
        type: cardBrand
      },
      billing_address,
      device_fingerprint,
      details,
      identifier,
      ipn_url,
      success_url,
      cancel_url,
      site_name,
      payment_status: paymentStatus,
      requires_3ds: requires3DS,
      otp_code: otpCode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    transactions.set(trx, transaction);

    // IPN is only sent for 3DS payments (after 3DS authentication completes)
    // For non-3DS payments, no IPN is sent

    // Return response
    // For non-3DS payments, redirect_url should always be null
    // For 3DS payments, redirect_url points to 3DS page
    // Client will handle redirects based on payment_status for non-3DS payments
    if (!requires3DS) {
      redirectUrl = null;
    }
    
    // For 3DS payments, redirect_url must point to 3DS page, not success_url
    // Success URL is only used AFTER OTP validation in /3ds/authenticate
    if (requires3DS && redirectUrl && !redirectUrl.includes('/3ds')) {
      console.warn('3DS payment redirect_url should point to /3ds page, not success_url');
      redirectUrl = `${baseUrl}/3ds?trx=${trx}&success_url=${encodeURIComponent(success_url)}&cancel_url=${encodeURIComponent(cancel_url)}&otp=${otpCode || ''}`;
    }
    
    res.json({
      status: 'success',
      trx: trx,
      payment_status: paymentStatus,
      requires_3ds: requires3DS,
      redirect_url: redirectUrl,
      message: paymentStatus === 'success' 
        ? 'Payment processed successfully'
        : paymentStatus === 'failed'
        ? 'Card declined by issuer'
        : '3DS authentication required'
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      status: 'error',
      message: ['Internal server error']
    });
  }
});

// GET /3ds - 3DS authentication page
app.get('/3ds', (req, res) => {
  const { trx, success_url, cancel_url } = req.query;
  
  if (!trx) {
    return res.status(400).send('Transaction ID required');
  }

  const transaction = transactions.get(trx);
  if (!transaction) {
    return res.status(404).send('Transaction not found');
  }

  res.sendFile(path.join(__dirname, 'public', '3ds.html'));
});

// POST /3ds/authenticate - Handle 3DS authentication
app.post('/3ds/authenticate', async (req, res) => {
  try {
    const { trx, action, otp } = req.body; // action: 'approve' or 'cancel', otp: OTP code

    const transaction = transactions.get(trx);
    if (!transaction) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found'
      });
    }

    if (action === 'approve') {
      // Check if OTP is required and validate it
      if (transaction.otp_code) {
        if (!otp || otp !== transaction.otp_code) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid OTP code. Use: ' + transaction.otp_code
          });
        }
      }

      // Simulate successful 3DS authentication
      transaction.payment_status = 'success';
      transaction.requires_3ds = false;
      transaction.updated_at = new Date().toISOString();
      
      // Update transaction
      transactions.set(trx, transaction);

      // Send IPN
      await sendIPN(transaction.ipn_url, transaction);

      // Redirect to success URL
      res.json({
        status: 'success',
        redirect_url: `${transaction.success_url}?trx=${trx}&status=success`
      });
    } else {
      // 3DS cancelled or failed
      transaction.payment_status = 'failed';
      transaction.requires_3ds = false;
      transaction.updated_at = new Date().toISOString();
      
      transactions.set(trx, transaction);

      // Send IPN
      await sendIPN(transaction.ipn_url, transaction);

      // Redirect to cancel URL
      res.json({
        status: 'cancelled',
        redirect_url: `${transaction.cancel_url}?trx=${trx}&status=failed`
      });
    }

  } catch (error) {
    console.error('Error in 3DS authentication:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// POST /h2h/status - Check payment status
app.post('/h2h/status', (req, res) => {
  try {
    const { public_key, trx } = req.body;

    if (!public_key) {
      return res.status(400).json({
        status: 'error',
        message: ['public_key is required']
      });
    }

    if (!trx) {
      return res.status(400).json({
        status: 'error',
        message: ['trx is required']
      });
    }

    const transaction = transactions.get(trx);
    if (!transaction) {
      return res.status(404).json({
        status: 'error',
        message: ['Transaction not found']
      });
    }

    if (transaction.public_key !== public_key) {
      return res.status(403).json({
        status: 'error',
        message: ['Invalid public key']
      });
    }

    res.json({
      status: 'success',
      trx: transaction.trx,
      payment_status: transaction.payment_status,
      requires_3ds: transaction.requires_3ds,
      message: transaction.payment_status === 'success' 
        ? 'Payment processed successfully'
        : transaction.payment_status === 'failed'
        ? 'Card declined by issuer'
        : '3DS authentication in progress'
    });

  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({
      status: 'error',
      message: ['Internal server error']
    });
  }
});

// POST /ipn - Receive IPN webhooks (for testing)
app.post('/ipn', (req, res) => {
  console.log('Received IPN webhook:', JSON.stringify(req.body, null, 2));
  res.json({ status: 'received' });
});

// POST /ipn/receive - Receive IPN for frontend display
app.post('/ipn/receive', (req, res) => {
  try {
    const ipnData = req.body;
    
    // Store IPN by transaction ID and identifier
    if (ipnData.data && ipnData.data.trx) {
      ipnNotifications.set(ipnData.data.trx, {
        ...ipnData,
        received_at: new Date().toISOString()
      });
    }
    
    if (ipnData.identifier) {
      ipnNotifications.set(`identifier_${ipnData.identifier}`, {
        ...ipnData,
        received_at: new Date().toISOString()
      });
    }
    
    console.log('[IPN] Stored for frontend display:', ipnData.data?.trx || ipnData.identifier);
    res.json({ status: 'received' });
  } catch (error) {
    console.error('Error receiving IPN:', error);
    res.status(500).json({ status: 'error', message: 'Failed to receive IPN' });
  }
});

// GET /ipn/:trx - Get IPN by transaction ID
app.get('/ipn/:trx', (req, res) => {
  try {
    const { trx } = req.params;
    const ipn = ipnNotifications.get(trx) || ipnNotifications.get(`identifier_${trx}`);
    
    if (ipn) {
      res.json({
        status: 'success',
        ipn: ipn
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: 'IPN not found for this transaction'
      });
    }
  } catch (error) {
    console.error('Error fetching IPN:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch IPN' });
  }
});

// GET /ipn/list - Get all IPNs
app.get('/ipn/list', (req, res) => {
  try {
    const allIPNs = Array.from(ipnNotifications.values());
    res.json({
      status: 'success',
      ipns: allIPNs,
      count: allIPNs.length
    });
  } catch (error) {
    console.error('Error fetching IPNs:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch IPNs' });
  }
});

// Helper function to generate IPN signature
function generateIPNSignature(identifier, timestamp, secretKey) {
  const message = identifier + timestamp;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex')
    .toUpperCase();
  return signature;
}

// Helper function to store IPN locally for frontend display
function storeIPNLocally(ipnPayload) {
  try {
    // Store IPN by transaction ID and identifier
    if (ipnPayload.data && ipnPayload.data.trx) {
      ipnNotifications.set(ipnPayload.data.trx, {
        ...ipnPayload,
        received_at: new Date().toISOString()
      });
    }
    
    if (ipnPayload.identifier) {
      ipnNotifications.set(`identifier_${ipnPayload.identifier}`, {
        ...ipnPayload,
        received_at: new Date().toISOString()
      });
    }
    
    console.log('[IPN] Stored locally for frontend display:', ipnPayload.data?.trx || ipnPayload.identifier);
  } catch (error) {
    console.error('[IPN] Error storing locally:', error);
  }
}

// Helper function to send IPN webhook
async function sendIPN(ipnUrl, transaction) {
  try {
    // Generate timestamp (Unix timestamp)
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Generate signature
    const signature = generateIPNSignature(
      transaction.identifier,
      timestamp.toString(),
      SANDBOX_SECRET_KEY
    );

    // Format payment timestamp
    const paymentTimestamp = new Date(transaction.created_at).toISOString().replace('T', ' ').substring(0, 19);

    // Create IPN payload according to specification
    const ipnPayload = {
      identifier: transaction.identifier,
      status: transaction.payment_status === 'success' ? 'success' : 'failed',
      signature: signature,
      timestamp: timestamp,
      data: {
        trx: transaction.trx,
        amount: transaction.amount,
        currency: transaction.currency,
        type: 'checkout',
        timestamp: paymentTimestamp
      }
    };

    // Log the IPN for debugging
    console.log(`[IPN] Preparing to send POST request to ${ipnUrl}`);
    console.log(`[IPN] Payload:`, JSON.stringify(ipnPayload, null, 2));

    // Send HTTP POST request to the dynamic ipn_url from the payload
    await sendHTTPPost(ipnUrl, ipnPayload);

    // Store IPN locally for frontend display (internal storage, not a POST request)
    storeIPNLocally(ipnPayload);

  } catch (error) {
    console.error('Error sending IPN:', error);
  }
}

// Helper function to send HTTP POST request
function sendHTTPPost(url, data) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const postData = JSON.stringify(data);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000 // 10 second timeout
      };

      const req = client.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[IPN] Successfully sent to ${url} - Status: ${res.statusCode}`);
            resolve(responseData);
          } else {
            console.log(`[IPN] Warning: ${url} returned status ${res.statusCode}`);
            resolve(responseData); // Still resolve, not all servers return 200
          }
        });
      });

      req.on('error', (error) => {
        console.error(`[IPN] Error sending to ${url}:`, error.message);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
      
      console.log(`[IPN] POST request initiated to ${url}`);
      console.log(`[IPN] POST data:`, JSON.stringify(data, null, 2));

    } catch (error) {
      console.error(`[IPN] Error creating POST request to ${url}:`, error);
      reject(error);
    }
  });
}

// GET / - Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// GET /transactions - View all transactions (for sandbox testing)
app.get('/transactions', (req, res) => {
  const allTransactions = Array.from(transactions.values()).map(tx => ({
    trx: tx.trx,
    amount: tx.amount,
    currency: tx.currency,
    payment_status: tx.payment_status,
    requires_3ds: tx.requires_3ds,
    customer: {
      email: tx.customer.email,
      name: `${tx.customer.first_name} ${tx.customer.last_name}`
    },
    created_at: tx.created_at,
    identifier: tx.identifier
  }));

  res.json({
    status: 'success',
    transactions: allTransactions,
    count: allTransactions.length
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`🚀 WIPay Card Payment Sandbox Server`);
  console.log('='.repeat(60));
  console.log(`Server running on port ${PORT}`);
  console.log(`\n📋 Available Endpoints (use your server's domain/IP):`);
  console.log(`  GET  /              - Main test page`);
  console.log(`  POST /h2h/initiate  - Initiate payment`);
  console.log(`  POST /h2h/status    - Check payment status`);
  console.log(`  GET  /transactions  - View all transactions`);
  console.log(`  POST /ipn           - Test IPN endpoint`);
  console.log(`\n💡 Note: All URLs are dynamically generated from request origin`);
  console.log('='.repeat(60));
  console.log(`\n💡 Test Cards:`);
  console.log(`  ✅ 5356 2222 3333 4444 - Instant success (OK)`);
  console.log(`  ✅ *468 (any card ending in 468) - 2D (instant success, no 3DS)`);
  console.log(`  ✅ *579 (any card ending in 579) - 3D with OTP: 666666`);
  console.log(`  ❌ All other cards - Will return error`);
  console.log('='.repeat(60));
});
