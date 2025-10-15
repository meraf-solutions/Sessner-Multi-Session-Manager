/**
 * Test cases for hostname validation fix
 * This demonstrates the behavior before and after the fix
 */

// Helper function (copied from background.js)
function isIPAddress(hostname) {
  // IPv4 pattern: 0.0.0.0 to 255.255.255.255
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;

  // IPv6 patterns: handles various formats including ::1, [::1], full addresses
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  const ipv6WithBracketsPattern = /^\[([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\]$/;

  // Check IPv4
  if (ipv4Pattern.test(hostname)) {
    // Validate each octet is 0-255
    const octets = hostname.split('.');
    const isValid = octets.every(octet => {
      const num = parseInt(octet, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
    return isValid;
  }

  // Check IPv6 (with or without brackets)
  if (ipv6Pattern.test(hostname) || ipv6WithBracketsPattern.test(hostname)) {
    return true;
  }

  return false;
}

// New implementation
function isValidSLDPlusTLD(domainPart) {
  // Handle localhost (common in development)
  if (domainPart === 'localhost') {
    return true;
  }

  // Handle IP addresses (IPv4 and IPv6)
  // IMPORTANT: Check for IP address pattern FIRST, before splitting into parts
  // This prevents invalid IPs like "256.1.1.1" from being treated as domains
  const looksLikeIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(domainPart);
  const looksLikeIPv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(domainPart) ||
                        /^\[([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\]$/.test(domainPart);

  if (looksLikeIPv4 || looksLikeIPv6) {
    // If it looks like an IP, validate it properly
    // This rejects invalid IPs like "256.1.1.1"
    return isIPAddress(domainPart);
  }

  // List of common TLDs and multi-part TLDs
  const commonTLDs = [
    'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
    'co.uk', 'ac.uk', 'gov.uk', 'org.uk',
    'co.jp', 'ac.jp', 'go.jp',
    'com.au', 'gov.au', 'edu.au',
    'co.nz', 'govt.nz', 'ac.nz',
    'com.br', 'gov.br',
    'de', 'fr', 'it', 'es', 'ru', 'cn', 'in', 'jp', 'kr'
  ];

  const parts = domainPart.split('.');

  // SECURITY: Reject bare TLDs (.com, .org, etc.)
  // But allow single-word hostnames (intranet, server01, etc.)
  if (parts.length === 1) {
    // Single word: allow it unless it's a bare TLD
    return !commonTLDs.includes(parts[0]);
  }

  // Check against known multi-part TLDs (e.g., co.uk)
  const lastTwoParts = parts.slice(-2).join('.');
  if (commonTLDs.includes(lastTwoParts)) {
    return true; // e.g., co.uk
  }

  // Check against known single-part TLDs (e.g., google.com)
  const lastPart = parts[parts.length - 1];
  if (commonTLDs.includes(lastPart) && parts.length === 2) {
    return true; // e.g., google.com
  }

  // If not in list but has 2+ parts, assume valid (conservative approach)
  return parts.length >= 2;
}

// Test cases
const testCases = [
  // Local development
  { hostname: 'localhost', expected: true, category: 'Local Development' },
  { hostname: '127.0.0.1', expected: true, category: 'Local Development (IPv4)' },
  { hostname: '::1', expected: true, category: 'Local Development (IPv6)' },
  { hostname: '[::1]', expected: true, category: 'Local Development (IPv6 with brackets)' },

  // IPv4 addresses
  { hostname: '192.168.1.1', expected: true, category: 'IPv4 (private)' },
  { hostname: '10.0.0.1', expected: true, category: 'IPv4 (private)' },
  { hostname: '8.8.8.8', expected: true, category: 'IPv4 (public)' },
  { hostname: '255.255.255.255', expected: true, category: 'IPv4 (broadcast)' },
  { hostname: '256.1.1.1', expected: false, category: 'Invalid IPv4 (octet > 255)' },

  // IPv6 addresses
  { hostname: '2001:0db8:85a3:0000:0000:8a2e:0370:7334', expected: true, category: 'IPv6 (full)' },
  { hostname: '2001:db8:85a3::8a2e:370:7334', expected: true, category: 'IPv6 (compressed)' },
  { hostname: 'fe80::1', expected: true, category: 'IPv6 (link-local)' },

  // Single-word hostnames (intranet)
  { hostname: 'intranet', expected: true, category: 'Single-word hostname' },
  { hostname: 'server01', expected: true, category: 'Single-word hostname' },
  { hostname: 'fileserver', expected: true, category: 'Single-word hostname' },
  { hostname: 'database', expected: true, category: 'Single-word hostname' },

  // Normal domains
  { hostname: 'google.com', expected: true, category: 'Standard domain' },
  { hostname: 'example.org', expected: true, category: 'Standard domain' },
  { hostname: 'sub.example.com', expected: true, category: 'Subdomain' },
  { hostname: 'deep.sub.example.com', expected: true, category: 'Deep subdomain' },

  // Multi-part TLDs
  { hostname: 'example.co.uk', expected: true, category: 'Multi-part TLD' },
  { hostname: 'site.com.au', expected: true, category: 'Multi-part TLD' },

  // SECURITY: Should REJECT bare TLDs
  { hostname: 'com', expected: false, category: 'Bare TLD (SECURITY)' },
  { hostname: 'org', expected: false, category: 'Bare TLD (SECURITY)' },
  { hostname: 'net', expected: false, category: 'Bare TLD (SECURITY)' },

  // Edge cases
  { hostname: 'example.unknown', expected: true, category: 'Unknown TLD (allow)' },
  { hostname: 'test.local', expected: true, category: 'Local domain' },
];

// Run tests
console.log('Testing hostname validation...\n');

let passed = 0;
let failed = 0;

testCases.forEach(test => {
  const result = isValidSLDPlusTLD(test.hostname);
  const status = result === test.expected ? '✓ PASS' : '✗ FAIL';

  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }

  console.log(`${status} | ${test.hostname.padEnd(45)} | ${test.category} | Expected: ${test.expected}, Got: ${result}`);
});

console.log(`\n${'='.repeat(100)}`);
console.log(`Total: ${testCases.length} tests | Passed: ${passed} | Failed: ${failed}`);

if (failed === 0) {
  console.log('✓ All tests passed!');
} else {
  console.log(`✗ ${failed} test(s) failed`);
}
