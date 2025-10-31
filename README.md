# WIPay Card Payment Sandbox

A complete sandbox system for testing VISA and Mastercard card payments integration with 3D Secure (3DS) authentication and IPN (Instant Payment Notification) support.

## Features

- Express.js web server with payment processing
- Card payment initiation API
- 3D Secure (3DS) authentication simulation
- IPN (Instant Payment Notification) with signature verification
- Frontend test interface for card payments
- Real-time IPN display on success page

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

Start the server:
```bash
npm start
```

The server will run on `http://localhost:3000`

## Test Cards

The sandbox supports the following test card scenarios:

- ✅ **5356 2222 3333 4444** - Instant success (OK, no 3DS)
- ✅ **\*468** (any card ending in 468) - 2D Secure (instant success, no 3DS)
- ✅ **\*579** (any card ending in 579) - 3D Secure with OTP: **666666**
- ❌ All other cards - Will return error

### Example Test Cards:
- `5356 2222 3333 4444` - Direct success
- `4111 1111 1111 1468` - Instant success (ends in 468)
- `5555 5555 5555 4579` - Requires 3DS with OTP 666666

## API Endpoints

### POST /h2h/initiate
Initiate a card payment

**Request Body:**
```json
{
  "public_key": "sandbox_key_123",
  "amount": 100.00,
  "currency": "USD",
  "payment_method_type": "card",
  "customer": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "mobile": "+1234567890"
  },
  "card": {
    "number": "5356222233334444",
    "expiry_month": 12,
    "expiry_year": 2025,
    "cvv": "123",
    "holder": "John Doe"
  },
  "billing_address": {
    "country": "US",
    "address": "123 Main Street",
    "city": "New York",
    "postal_code": "10001"
  },
  "device_fingerprint": "unique_device_id",
  "details": "Test payment",
  "identifier": "order_123",
  "ipn_url": "https://yourdomain.com/ipn",
  "success_url": "https://yourdomain.com/success",
  "cancel_url": "https://yourdomain.com/cancel",
  "site_name": "Your Store"
}
```

**Response (Success - No 3DS):**
```json
{
  "status": "success",
  "trx": "transaction-uuid",
  "payment_status": "success",
  "requires_3ds": false,
  "redirect_url": null,
  "message": "Payment processed successfully"
}
```

**Response (3DS Required):**
```json
{
  "status": "success",
  "trx": "transaction-uuid",
  "payment_status": "pending",
  "requires_3ds": true,
  "redirect_url": "http://localhost:3000/3ds?trx=...",
  "message": "3DS authentication required"
}
```

### POST /h2h/status
Check payment status by transaction ID

**Request Body:**
```json
{
  "public_key": "sandbox_key_123",
  "trx": "transaction-uuid"
}
```

### GET /ipn/:trx
Get IPN notification for a transaction

### GET /ipn/list
Get all IPN notifications

### POST /ipn
Test endpoint to receive IPN webhooks

### GET /transactions
View all transactions (for sandbox testing)

## IPN (Instant Payment Notification)

When a payment is successfully processed (including after correct OTP validation), an IPN is sent to the `ipn_url` specified in the payment initiation.

### IPN Format

```json
{
  "identifier": "order_123",
  "status": "success",
  "signature": "HMAC_SHA256_SIGNATURE",
  "timestamp": 1631533200,
  "data": {
    "trx": "transaction-uuid",
    "amount": 100.00,
    "currency": "USD",
    "type": "checkout",
    "timestamp": "2021-09-10 12:00:00"
  }
}
```

### Signature Verification

The signature is generated using:
```
HMAC-SHA256(identifier + timestamp, secret_key)
```

Convert to uppercase. The sandbox uses `sandbox_secret_key_123` as the secret key.

### IPN Display

After successful payment (including 3DS completion), the success page automatically fetches and displays the IPN data.

## Frontend Pages

- `/` - Main payment form for testing card payments
- `/3ds` - 3D Secure authentication page (OTP entry)
- `/success.html` - Payment success page with IPN display
- `/cancel.html` - Payment failed/cancelled page

## Payment Flow

1. **Initiate Payment**: Submit card details via `/h2h/initiate`
2. **3DS Check**: 
   - If `requires_3ds: true`, redirect to 3DS page
   - Enter OTP code (666666 for \*579 cards)
3. **Authentication**: Validate OTP and process payment
4. **IPN Sent**: IPN notification sent to `ipn_url`
5. **Redirect**: Customer redirected to success/cancel URL
6. **IPN Display**: Success page fetches and displays IPN data

## Example cURL Requests

**Initiate Payment:**
```bash
curl -X POST http://localhost:3000/h2h/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "public_key": "sandbox_key_123",
    "amount": 100.00,
    "currency": "USD",
    "payment_method_type": "card",
    "customer": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "mobile": "+1234567890"
    },
    "card": {
      "number": "5356222233334444",
      "expiry_month": 12,
      "expiry_year": 2025,
      "cvv": "123",
      "holder": "John Doe"
    },
    "billing_address": {
      "country": "US"
    },
    "device_fingerprint": "device_123",
    "details": "Test payment",
    "identifier": "order_123",
    "ipn_url": "http://localhost:3000/ipn",
    "success_url": "http://localhost:3000/success.html",
    "cancel_url": "http://localhost:3000/cancel.html",
    "site_name": "Sandbox Store"
  }'
```

**Check Status:**
```bash
curl -X POST http://localhost:3000/h2h/status \
  -H "Content-Type: application/json" \
  -d '{
    "public_key": "sandbox_key_123",
    "trx": "transaction-uuid"
  }'
```

## Project Structure

```
.
├── index.js              # Main server with payment APIs
├── package.json          # Dependencies
├── README.md             # This file
├── .gitignore            # Git ignore rules
└── public/               # Frontend files
    ├── index.html        # Payment form
    ├── 3ds.html          # 3DS authentication page
    ├── success.html      # Success page with IPN
    └── cancel.html       # Cancel page
```

## Security Notes

- This is a **sandbox/testing environment** - do not use in production
- Card numbers are masked in transaction storage (only last 4 digits visible)
- IPN signatures are generated for testing purposes
- All sensitive data should be encrypted in production

## Development

The sandbox uses in-memory storage. For production:
- Replace with database (PostgreSQL, MongoDB, etc.)
- Use secure secret key management
- Implement proper logging and monitoring
- Add rate limiting and fraud detection
- Use HTTPS only
- Implement proper error handling and retries
