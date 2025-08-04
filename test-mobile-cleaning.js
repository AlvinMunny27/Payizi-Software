// Test script to verify mobile number cleaning fixes with country validation
// Run this in browser console to test the mobile cleaning function

console.log('🧪 Testing Mobile Number Cleaning with Country Validation...');

// Test the enhanced cleanMobileNumber function
function cleanMobileNumber(mobile, expectedCountry = null) {
  if (!mobile) return '';
  
  // Remove all non-numeric characters except +
  let cleaned = mobile.replace(/[^\d+]/g, '');
  
  // Country-specific validation patterns
  const patterns = {
    southAfrica: /^(\+27|0)[6-8][0-9]{8}$/,
    zimbabwe: /^(\+263|0)[7][0-9]{8}$/
  };
  
  // If expected country is specified, validate against it
  if (expectedCountry && patterns[expectedCountry]) {
    if (!patterns[expectedCountry].test(cleaned)) {
      console.warn(`Mobile number ${mobile} does not match expected ${expectedCountry} format`);
    }
  }
  
  // If it starts with +, keep it, otherwise ensure it's just numbers
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  return cleaned.replace(/\D/g, ''); // Remove any remaining non-digits
}

// Test cases for South African customer numbers
console.log('\n📱 SOUTH AFRICAN CUSTOMER NUMBERS:');
const saTestCases = [
  '+27 12 345 6789',
  '+27 82 123 4567', 
  '082 123 4567',
  '0711234567',
  '+27821234567',
  '27821234567'
];

saTestCases.forEach(test => {
  const cleaned = cleanMobileNumber(test, 'southAfrica');
  console.log(`"${test}" → "${cleaned}"`);
});

// Test cases for Zimbabwean beneficiary numbers
console.log('\n🇿🇼 ZIMBABWEAN BENEFICIARY NUMBERS:');
const zwTestCases = [
  '+263 77 123 4567',
  '+263 78 123 4567', 
  '077 123 4567',
  '0771234567',
  '+2637712345678',
  '2637712345678'
];

zwTestCases.forEach(test => {
  const cleaned = cleanMobileNumber(test, 'zimbabwe');
  console.log(`"${test}" → "${cleaned}"`);
});

// Test invalid combinations (should show warnings)
console.log('\n❌ INVALID COUNTRY COMBINATIONS (should show warnings):');
console.log('Zimbabwean number for SA customer:');
cleanMobileNumber('+263 77 123 4567', 'southAfrica');

console.log('South African number for ZW beneficiary:');
cleanMobileNumber('+27 82 123 4567', 'zimbabwe');

// Test the database formatting function
function cleanMobileForDatabase(mobile) {
  if (!mobile) return '';
  let cleaned = String(mobile).trim();
  if (cleaned.startsWith('+') || cleaned.startsWith('=')) {
    return "'" + cleaned;
  }
  return cleaned;
}

console.log('\n📊 Database formatting test:');
const dbTestCases = ['+27821234567', '+2637712345678', '=+27123456789', '0821234567'];
dbTestCases.forEach(test => {
  const formatted = cleanMobileForDatabase(test);
  console.log(`"${test}" → "${formatted}"`);
});

console.log('\n✅ Country-specific mobile number validation test completed!');
