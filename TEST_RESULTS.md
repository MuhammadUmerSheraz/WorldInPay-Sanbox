# WIPay Card Payment Sandbox - Test Results

## Test Execution Date
October 31, 2025

## Test Summary
All test cases passed successfully ✅

---

## Test Cases

### ✅ Test Case 1: Card 5356 2222 3333 4444 (Instant Success)
**Expected:** Instant payment success, redirect to client `success_url`

**Result:** ✅ PASSED
- Payment status: `success`
- Requires 3DS: `false`
- Redirect URL: `https://www.dubaibiglottery.ae/success_url?trx=...&status=success`
- IPN sent with correct signature

---

### ✅ Test Case 2: Card ending in 468 (Instant Success - 2D)
**Expected:** Instant payment success without 3DS, redirect to client `success_url`

**Result:** ✅ PASSED
- Payment status: `success`
- Requires 3DS: `false`
- Redirect URL: `https://www.dubaibiglottery.ae/success_url?trx=...&status=success`
- IPN sent successfully

---

### ✅ Test Case 3: Card ending in 579 (3DS Required)
**Expected:** Payment requires 3DS authentication with OTP 666666

**Result:** ✅ PASSED
- Payment status: `pending`
- Requires 3DS: `true`
- Redirect URL: `http://localhost:3000/3ds?trx=...&success_url=...&cancel_url=...&otp=666666`
- Contains client URLs in query parameters

---

### ✅ Test Case 4: Invalid Card Number
**Expected:** Should return error for cards not matching test patterns

**Result:** ✅ PASSED
- Status: `error`
- Message: `["Card number not allowed in sandbox. Use test cards: 5356 2222 3333 4444, *468, or *579"]`

---

### ✅ Test Case 5: Status Check
**Expected:** Should return current payment status

**Result:** ✅ PASSED
- Status endpoint working correctly
- Returns transaction details and current payment status
- Correctly identifies pending 3DS transactions

---

### ✅ Test Case 6: 3DS Completion with Correct OTP
**Expected:** After entering correct OTP (666666), payment should complete and redirect to client `success_url`

**Result:** ✅ PASSED
- OTP validation: ✅ Correct
- Payment status updated to: `success`
- Redirect URL: `https://www.dubaibiglottery.ae/success_url?trx=...&status=success`
- IPN sent with correct signature
- Final status shows: `payment_status: "success"`, `requires_3ds: false`

---

### ✅ Test Case 7: Wrong OTP Code
**Expected:** Should reject incorrect OTP and return error

**Result:** ✅ PASSED
- Status: `error`
- Message: `"Invalid OTP code. Use: 666666"`
- Payment status remains `pending`

---

### ✅ Test Case 8: Cancel 3DS Authentication
**Expected:** Cancel action should redirect to client `cancel_url`

**Result:** ✅ PASSED
- Status: `cancelled`
- Redirect URL: `https://www.dubaibiglottery.ae/cancel_url?trx=...&status=failed`
- Payment status updated to: `failed`
- IPN sent with failed status

---

### ✅ Test Case 9: View All Transactions
**Expected:** Should list all transactions in the system

**Result:** ✅ PASSED
- Endpoint working correctly
- Returns transaction list with details

---

### ✅ Test Case 10: IPN Retrieval
**Expected:** Should retrieve IPN notification by transaction ID

**Result:** ✅ PASSED
- IPN structure correct:
  - `identifier`: Matches payment identifier
  - `status`: `success`
  - `signature`: Valid HMAC-SHA256 signature (uppercase)
  - `timestamp`: Unix timestamp
  - `data`: Contains transaction details
    - `trx`: Transaction ID
    - `amount`: Payment amount
    - `currency`: Currency code
    - `type`: `"checkout"`
    - `timestamp`: Payment timestamp

---

## Key Features Verified

✅ **Card Payment Processing**
- Test card 5356 2222 3333 4444 works correctly
- Cards ending in 468 work correctly (2D - instant success)
- Cards ending in 579 require 3DS with OTP 666666
- Invalid cards are rejected with appropriate error messages

✅ **3D Secure Authentication**
- 3DS page loads correctly
- OTP validation works (accepts correct, rejects incorrect)
- Cancel action works correctly
- After 3DS completion, redirects to client URLs

✅ **Client URL Redirection**
- Success URLs come from payload: `success_url`
- Cancel URLs come from payload: `cancel_url`
- All redirects include transaction ID and status in query parameters
- Instant success redirects directly to client `success_url`
- 3DS completion redirects to client `success_url`
- Cancel redirects to client `cancel_url`

✅ **IPN (Instant Payment Notification)**
- IPN sent after successful payment (instant or after 3DS)
- IPN sent after failed/cancelled payment
- IPN format matches specification:
  - Correct signature generation (HMAC-SHA256, uppercase)
  - All required fields present
  - Timestamps correctly formatted
- IPN can be retrieved by transaction ID
- IPN stored for frontend display

✅ **API Endpoints**
- `/h2h/initiate` - Payment initiation ✅
- `/h2h/status` - Status checking ✅
- `/3ds/authenticate` - 3DS authentication ✅
- `/ipn/:trx` - IPN retrieval ✅
- `/transactions` - Transaction listing ✅

---

## IPN Signature Verification

The IPN signature is generated using:
```
HMAC-SHA256(identifier + timestamp, secret_key)
```

Example IPN structure:
```json
{
  "identifier": "test_order_1",
  "status": "success",
  "signature": "29B69BFA4AA8A0A27A3CD0829CBD767AEDC44472B703F336E1EDE984DBC139BB",
  "timestamp": 1761952498,
  "data": {
    "trx": "e6864421-daad-4f9e-bfb5-47aa6c7a9444",
    "amount": 100,
    "currency": "USD",
    "type": "checkout",
    "timestamp": "2025-10-31 23:14:57"
  }
}
```

---

## Conclusion

All test cases passed successfully. The sandbox system correctly:
1. Processes different card payment scenarios
2. Handles 3DS authentication with OTP validation
3. Redirects to client-provided URLs (`success_url` and `cancel_url`) from payload
4. Sends properly formatted IPN notifications with valid signatures
5. Validates inputs and returns appropriate error messages

The system is ready for integration testing with client applications.

