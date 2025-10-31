#!/bin/bash

BASE_URL="http://localhost:3000"
CLIENT_SUCCESS_URL="https://www.dubaibiglottery.ae/success_url"
CLIENT_CANCEL_URL="https://www.dubaibiglottery.ae/cancel_url"

echo "=========================================="
echo "Testing WIPay Card Payment Sandbox"
echo "=========================================="
echo ""

# Test Case 1: Card 5356 2222 3333 4444 (Instant Success)
echo "=== TEST CASE 1: Card 5356 2222 3333 4444 (Instant Success) ==="
RESPONSE1=$(curl -s -X POST "$BASE_URL/h2h/initiate" \
  -H "Content-Type: application/json" \
  -d "{
    \"public_key\": \"sandbox_key_123\",
    \"amount\": 100.00,
    \"currency\": \"USD\",
    \"payment_method_type\": \"card\",
    \"customer\": {
      \"first_name\": \"John\",
      \"last_name\": \"Doe\",
      \"email\": \"john@example.com\",
      \"mobile\": \"+1234567890\"
    },
    \"card\": {
      \"number\": \"5356222233334444\",
      \"expiry_month\": 12,
      \"expiry_year\": 2025,
      \"cvv\": \"123\",
      \"holder\": \"John Doe\"
    },
    \"billing_address\": {
      \"country\": \"US\",
      \"address\": \"123 Main St\",
      \"city\": \"New York\",
      \"postal_code\": \"10001\"
    },
    \"device_fingerprint\": \"device_test_1\",
    \"details\": \"Test payment case 1\",
    \"identifier\": \"test_order_1\",
    \"ipn_url\": \"$CLIENT_SUCCESS_URL/ipn\",
    \"success_url\": \"$CLIENT_SUCCESS_URL\",
    \"cancel_url\": \"$CLIENT_CANCEL_URL\",
    \"site_name\": \"Test Store\"
  }")

echo "$RESPONSE1" | jq .
echo ""

TRX1=$(echo "$RESPONSE1" | jq -r '.trx')
echo "Transaction ID: $TRX1"
echo ""

# Test Case 2: Card ending in 468 (Instant Success)
echo "=== TEST CASE 2: Card ending in 468 (Instant Success) ==="
RESPONSE2=$(curl -s -X POST "$BASE_URL/h2h/initiate" \
  -H "Content-Type: application/json" \
  -d "{
    \"public_key\": \"sandbox_key_123\",
    \"amount\": 250.50,
    \"currency\": \"EUR\",
    \"payment_method_type\": \"card\",
    \"customer\": {
      \"first_name\": \"Jane\",
      \"last_name\": \"Smith\",
      \"email\": \"jane@example.com\",
      \"mobile\": \"+9876543210\"
    },
    \"card\": {
      \"number\": \"4111111111111468\",
      \"expiry_month\": 6,
      \"expiry_year\": 2026,
      \"cvv\": \"456\",
      \"holder\": \"Jane Smith\"
    },
    \"billing_address\": {
      \"country\": \"GB\",
      \"address\": \"456 High St\",
      \"city\": \"London\",
      \"postal_code\": \"SW1A 1AA\"
    },
    \"device_fingerprint\": \"device_test_2\",
    \"details\": \"Test payment case 2\",
    \"identifier\": \"test_order_2\",
    \"ipn_url\": \"$CLIENT_SUCCESS_URL/ipn\",
    \"success_url\": \"$CLIENT_SUCCESS_URL\",
    \"cancel_url\": \"$CLIENT_CANCEL_URL\",
    \"site_name\": \"Test Store\"
  }")

echo "$RESPONSE2" | jq .
echo ""

TRX2=$(echo "$RESPONSE2" | jq -r '.trx')
echo "Transaction ID: $TRX2"
echo ""

# Test Case 3: Card ending in 579 (3DS Required)
echo "=== TEST CASE 3: Card ending in 579 (3DS Required) ==="
RESPONSE3=$(curl -s -X POST "$BASE_URL/h2h/initiate" \
  -H "Content-Type: application/json" \
  -d "{
    \"public_key\": \"sandbox_key_123\",
    \"amount\": 75.25,
    \"currency\": \"GBP\",
    \"payment_method_type\": \"card\",
    \"customer\": {
      \"first_name\": \"Bob\",
      \"last_name\": \"Wilson\",
      \"email\": \"bob@example.com\",
      \"mobile\": \"+447911123456\"
    },
    \"card\": {
      \"number\": \"5555555555555579\",
      \"expiry_month\": 9,
      \"expiry_year\": 2027,
      \"cvv\": \"789\",
      \"holder\": \"Bob Wilson\"
    },
    \"billing_address\": {
      \"country\": \"DE\",
      \"address\": \"789 Berlin St\",
      \"city\": \"Berlin\",
      \"postal_code\": \"10115\"
    },
    \"device_fingerprint\": \"device_test_3\",
    \"details\": \"Test payment case 3\",
    \"identifier\": \"test_order_3\",
    \"ipn_url\": \"$CLIENT_SUCCESS_URL/ipn\",
    \"success_url\": \"$CLIENT_SUCCESS_URL\",
    \"cancel_url\": \"$CLIENT_CANCEL_URL\",
    \"site_name\": \"Test Store\"
  }")

echo "$RESPONSE3" | jq .
echo ""

TRX3=$(echo "$RESPONSE3" | jq -r '.trx')
REDIRECT3=$(echo "$RESPONSE3" | jq -r '.redirect_url')
echo "Transaction ID: $TRX3"
echo "3DS Redirect URL: $REDIRECT3"
echo ""

# Test Case 4: Invalid Card (Should return error)
echo "=== TEST CASE 4: Invalid Card (Should return error) ==="
RESPONSE4=$(curl -s -X POST "$BASE_URL/h2h/initiate" \
  -H "Content-Type: application/json" \
  -d "{
    \"public_key\": \"sandbox_key_123\",
    \"amount\": 50.00,
    \"currency\": \"USD\",
    \"payment_method_type\": \"card\",
    \"customer\": {
      \"first_name\": \"Alice\",
      \"last_name\": \"Brown\",
      \"email\": \"alice@example.com\",
      \"mobile\": \"+1555123456\"
    },
    \"card\": {
      \"number\": \"1234567890123456\",
      \"expiry_month\": 12,
      \"expiry_year\": 2025,
      \"cvv\": \"123\",
      \"holder\": \"Alice Brown\"
    },
    \"billing_address\": {
      \"country\": \"US\",
      \"address\": \"999 Test Ave\",
      \"city\": \"Boston\",
      \"postal_code\": \"02101\"
    },
    \"device_fingerprint\": \"device_test_4\",
    \"details\": \"Test payment case 4\",
    \"identifier\": \"test_order_4\",
    \"ipn_url\": \"$CLIENT_SUCCESS_URL/ipn\",
    \"success_url\": \"$CLIENT_SUCCESS_URL\",
    \"cancel_url\": \"$CLIENT_CANCEL_URL\",
    \"site_name\": \"Test Store\"
  }")

echo "$RESPONSE4" | jq .
echo ""

# Test Case 5: Check status of Test Case 3 (3DS transaction)
echo "=== TEST CASE 5: Check Status of 3DS Transaction ==="
if [ ! -z "$TRX3" ] && [ "$TRX3" != "null" ]; then
  STATUS_RESPONSE=$(curl -s -X POST "$BASE_URL/h2h/status" \
    -H "Content-Type: application/json" \
    -d "{
      \"public_key\": \"sandbox_key_123\",
      \"trx\": \"$TRX3\"
    }")
  echo "$STATUS_RESPONSE" | jq .
  echo ""
fi

# Test Case 6: Test 3DS Authentication (if we have a 3DS transaction)
echo "=== TEST CASE 6: Complete 3DS Authentication (OTP: 666666) ==="
if [ ! -z "$TRX3" ] && [ "$TRX3" != "null" ]; then
  AUTH_RESPONSE=$(curl -s -X POST "$BASE_URL/3ds/authenticate" \
    -H "Content-Type: application/json" \
    -d "{
      \"trx\": \"$TRX3\",
      \"action\": \"approve\",
      \"otp\": \"666666\"
    }")
  echo "$AUTH_RESPONSE" | jq .
  echo ""
  
  # Check final status after 3DS
  echo "=== Final Status After 3DS ==="
  FINAL_STATUS=$(curl -s -X POST "$BASE_URL/h2h/status" \
    -H "Content-Type: application/json" \
    -d "{
      \"public_key\": \"sandbox_key_123\",
      \"trx\": \"$TRX3\"
    }")
  echo "$FINAL_STATUS" | jq .
  echo ""
fi

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "✅ Test Case 1: Card 5356 2222 3333 4444 - Should show instant success with redirect_url to client success_url"
echo "✅ Test Case 2: Card ending in 468 - Should show instant success with redirect_url to client success_url"
echo "✅ Test Case 3: Card ending in 579 - Should show requires_3ds=true with redirect_url to 3DS page"
echo "✅ Test Case 4: Invalid card - Should return error"
echo "✅ Test Case 5: Status check - Should work correctly"
echo "✅ Test Case 6: 3DS completion - Should redirect to client success_url"
echo "=========================================="

