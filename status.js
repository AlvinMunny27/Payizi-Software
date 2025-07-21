console.log('🚀 Status.js loaded successfully');

// Google Sheets Configuration
const GOOGLE_SHEETS_CONFIG = {
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbyOdpYNrOHTpbXIVVL1AaSlbaPUKxNpCB5bE42BG4IMSj0TBXNg_PmWVhTZAH6b3c-nyQ/exec'
};

// Polling state
let pollingInterval = null;
const POLLING_INTERVAL_MS = 10000; // Poll every 10 seconds

// Test direct URL access
function testDirectURL() {
  console.log('🧪 Testing direct URL access...');
  const testUrl = `${GOOGLE_SHEETS_CONFIG.WEB_APP_URL}?orderId=DE3CJ35G&action=getOrder`;
  console.log('🔗 Test URL:', testUrl);
  window.open(testUrl, '_blank');
}

// Check HTML elements
function checkElements() {
  const trackButton = document.getElementById('trackBtn');
  const orderIdInput = document.getElementById('orderRef');
  const loadingSection = document.getElementById('loadingSection');
  const statusSection = document.getElementById('statusSection');
  const errorSection = document.getElementById('errorSection');
  
  console.log('📋 Element check:', {
    trackButton: !!trackButton,
    orderIdInput: !!orderIdInput,
    loadingSection: !!loadingSection,
    statusSection: !!statusSection,
    errorSection: !!errorSection
  });
  
  if (!trackButton) console.error('❌ trackBtn not found');
  if (!orderIdInput) console.error('❌ orderRef not found');
  if (!loadingSection) console.error('❌ loadingSection not found');
  if (!statusSection) console.error('❌ statusSection not found');
  if (!errorSection) console.error('❌ errorSection not found');
  
  return { trackButton, orderIdInput, loadingSection, statusSection, errorSection };
}

// Fetch order data
async function fetchOrder(orderId) {
  const url = `${GOOGLE_SHEETS_CONFIG.WEB_APP_URL}?orderId=${encodeURIComponent(orderId)}&action=getOrder`;
  console.log('📡 URL:', url);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      mode: 'cors',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('📡 Response status:', response.status, response.statusText);
    console.log('📡 Response headers:', [...response.headers.entries()]);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    console.log('📄 Raw response:', text);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('🚨 JSON parse error:', parseError);
      throw new Error('Invalid response format from server');
    }
    
    console.log('📊 Parsed data:', data);
    return data;
  } catch (error) {
    console.error('🚨 Fetch error:', error.name, error.message);
    throw error;
  }
}

// Enhanced trackOrder with polling
async function trackOrder() {
  console.log('🔍 trackOrder function called');
  
  const { trackButton, orderIdInput, loadingSection, statusSection, errorSection } = checkElements();
  
  if (!trackButton || !orderIdInput) {
    console.error('❌ Missing required elements');
    alert('Error: Required page elements not found');
    return;
  }
  
  const orderId = orderIdInput.value.trim();
  console.log('📝 Order ID entered:', orderId);
  
  if (!orderId) {
    console.error('❌ No order ID provided');
    alert('Please enter an order ID');
    return;
  }
  
  // Stop any existing polling
  stopPolling();
  
  // Show loading state
  showLoading();
  
  try {
    const data = await fetchOrder(orderId);
    
    if (data.success) {
      displayOrderStatus(data.data);
      // Start polling if status is not terminal
      if (data.data.status.toLowerCase() !== 'completed' && data.data.status.toLowerCase() !== 'failed') {
        startPolling(orderId);
      }
    } else {
      console.error('🚨 Server returned error:', data.error);
      showError(data.error || 'Order not found');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      showError('Request timed out. Please try again or contact support.');
    } else {
      showError(`Failed to connect to server: ${error.message}. Please check your connection or contact support.`);
    }
  } finally {
    hideLoading();
  }
}

// Start polling for status updates
function startPolling(orderId) {
  console.log('🔄 Starting polling for order:', orderId);
  const pollingStatus = document.getElementById('pollingStatus');
  if (pollingStatus) {
    pollingStatus.textContent = 'Checking for updates...';
    pollingStatus.style.display = 'block';
  }
  
  pollingInterval = setInterval(async () => {
    try {
      const data = await fetchOrder(orderId);
      if (data.success) {
        console.log('🔄 Polling update:', data.data);
        displayOrderStatus(data.data);
        // Stop polling if status is terminal
        if (data.data.status.toLowerCase() === 'completed' || data.data.status.toLowerCase() === 'failed') {
          stopPolling();
          if (pollingStatus) {
            pollingStatus.textContent = 'Order status finalized. Updates stopped.';
          }
        }
      } else {
        console.error('🚨 Polling error:', data.error);
        stopPolling();
        showError(data.error || 'Order not found during update');
      }
    } catch (error) {
      console.error('🚨 Polling fetch error:', error.message);
      stopPolling();
      showError(`Failed to fetch update: ${error.message}. Updates stopped.`);
    }
  }, POLLING_INTERVAL_MS);
}

// Stop polling
function stopPolling() {
  if (pollingInterval) {
    console.log('🛑 Stopping polling');
    clearInterval(pollingInterval);
    pollingInterval = null;
    const pollingStatus = document.getElementById('pollingStatus');
    if (pollingStatus) {
      pollingStatus.style.display = 'none';
    }
  }
}

// Show loading state
function showLoading() {
  console.log('⏳ Showing loading state');
  const { trackButton, loadingSection, statusSection, errorSection } = checkElements();
  if (trackButton) {
    trackButton.innerHTML = '⏳ Searching...';
    trackButton.disabled = true;
  }
  if (loadingSection) loadingSection.style.display = 'block';
  if (statusSection) statusSection.style.display = 'none';
  if (errorSection) errorSection.style.display = 'none';
}

// Hide loading state
function hideLoading() {
  console.log('✅ Hiding loading state');
  const { trackButton, loadingSection } = checkElements();
  if (trackButton) {
    trackButton.innerHTML = 'Track Order';
    trackButton.disabled = false;
  }
  if (loadingSection) loadingSection.style.display = 'none';
}

// Display order status
function displayOrderStatus(orderData) {
  console.log('🎨 Displaying order:', orderData);
  
  const { statusSection, errorSection } = checkElements();
  
  if (errorSection) errorSection.style.display = 'none';
  if (statusSection) statusSection.style.display = 'block';
  
  updateElement('statusOrderRef', orderData.orderId);
  updateElement('statusCustomerName', orderData.customerName);
  updateElement('statusEmail', orderData.customerEmail);
  updateElement('statusLastUpdated', formatDate(orderData.createdAt));
  updateElement('statusUsdAmount', `$${orderData.amount}`);
  updateElement('statusZarTotal', `R ${orderData.zarTotal}`);
  updateElement('statusRate', orderData.exchangeRate);
  updateElement('statusBeneficiary', orderData.recipient);
  updateElement('statusLocation', `${orderData.location}, ${orderData.destination}`);
  updateElement('paymentRef', orderData.orderId);
  
  const statusBadge = document.getElementById('statusBadge');
  if (statusBadge) {
    statusBadge.textContent = orderData.status.toUpperCase();
    statusBadge.className = `badge ${getStatusBadgeClass(orderData.status)}`;
  }
  
  updateProgress(orderData.status);
  
  const paymentInstructions = document.getElementById('paymentInstructions');
  if (paymentInstructions) {
    paymentInstructions.style.display = orderData.status.toLowerCase() === 'pending' ? 'block' : 'none';
  }
}

// Helper function to update element text content
function updateElement(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value || '-';
  }
}

// Get Bootstrap badge class for status
function getStatusBadgeClass(status) {
  const statusClasses = {
    'pending': 'bg-warning',
    'processing': 'bg-info',
    'completed': 'bg-success',
    'failed': 'bg-danger'
  };
  return statusClasses[status.toLowerCase()] || 'bg-secondary';
}

// Update progress bar and timeline
function updateProgress(status) {
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  
  let progressPercent = 0;
  let progressLabel = '';
  
  switch (status.toLowerCase()) {
    case 'pending':
      progressPercent = 20;
      progressLabel = 'Pending Payment';
      updateTimelineStep('step1', 'active');
      break;
    case 'processing':
      progressPercent = 60;
      progressLabel = 'Processing Transfer';
      updateTimelineStep('step1', 'completed');
      updateTimelineStep('step2', 'completed');
      updateTimelineStep('step3', 'active');
      break;
    case 'completed':
      progressPercent = 100;
      progressLabel = 'Transfer Completed';
      updateTimelineStep('step1', 'completed');
      updateTimelineStep('step2', 'completed');
      updateTimelineStep('step3', 'completed');
      updateTimelineStep('step4', 'completed');
      updateTimelineStep('step5', 'completed');
      break;
    case 'failed':
      progressPercent = 20;
      progressLabel = 'Transfer Failed';
      updateTimelineStep('step1', 'failed');
      break;
  }
  
  if (progressBar) {
    progressBar.style.width = `${progressPercent}%`;
    progressBar.setAttribute('aria-valuenow', progressPercent);
  }
  
  if (progressText) {
    progressText.textContent = progressLabel;
  }
}

// Update timeline step appearance
function updateTimelineStep(stepId, status) {
  const step = document.getElementById(stepId);
  if (step) {
    step.className = `col timeline-step ${status}`;
    
    const icon = step.querySelector('.timeline-icon');
    if (icon) {
      switch (status) {
        case 'completed':
          icon.style.background = '#28a745';
          icon.style.color = 'white';
          break;
        case 'active':
          icon.style.background = '#007bff';
          icon.style.color = 'white';
          break;
        case 'failed':
          icon.style.background = '#dc3545';
          icon.style.color = 'white';
          break;
        default:
          icon.style.background = '#6c757d';
          icon.style.color = 'white';
      }
    }
  }
}

// Show error message
function showError(message) {
  console.log('🚨 Showing error:', message);
  const { statusSection, errorSection } = checkElements();
  if (statusSection) statusSection.style.display = 'none';
  if (errorSection) {
    errorSection.style.display = 'block';
    const errorText = errorSection.querySelector('p');
    if (errorText && message !== 'Order not found') {
      errorText.textContent = message;
    }
  }
  stopPolling();
}

// Format date helper
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM loaded, initializing...');
  
  setTimeout(() => {
    const { trackButton, orderIdInput } = checkElements();
    
    if (trackButton) {
      console.log('✅ Adding click listener to track button');
      trackButton.addEventListener('click', function(e) {
        console.log('🖱️ Track button clicked');
        e.preventDefault();
        trackOrder();
      });
    }
    
    if (orderIdInput) {
      console.log('✅ Adding enter key listener to input');
      orderIdInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          console.log('⌨️ Enter pressed');
          e.preventDefault();
          trackOrder();
        }
      });
    }
    
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() {
        console.log('🔄 Refresh button clicked');
        trackOrder();
      });
    }
    
    const stopPollingBtn = document.getElementById('stopPollingBtn');
    if (stopPollingBtn) {
      stopPollingBtn.addEventListener('click', function() {
        console.log('🛑 Stop polling button clicked');
        stopPolling();
      });
    }
    
    const downloadReceiptBtn = document.getElementById('downloadReceiptBtn');
    if (downloadReceiptBtn) {
      downloadReceiptBtn.addEventListener('click', function() {
        console.log('📥 Download receipt button clicked');
        downloadReceipt();
      });
    }
    
    console.log('🎉 Status tracking initialized successfully');
  }, 500);
});

// Test connection
function testConnection() {
  console.log('🧪 Testing connection...');
  fetch(`${GOOGLE_SHEETS_CONFIG.WEB_APP_URL}?orderId=TEST&action=getOrder`)
    .then(response => response.text())
    .then(text => console.log('📡 Test response:', text))
    .catch(error => console.error('🚨 Test error:', error));
}

// Download receipt as PDF
function downloadReceipt() {
  const orderData = {}; // Populate this from displayOrderStatus state or current data
  const { statusSection } = checkElements();
  
  if (!statusSection || statusSection.style.display === 'none') {
    alert('No order data available to download. Track an order first.');
    return;
  }
  
  // Extract data from current UI elements or maintain state
  orderData.orderId = document.getElementById('statusOrderRef').textContent;
  orderData.customerName = document.getElementById('statusCustomerName').textContent;
  orderData.email = document.getElementById('statusEmail').textContent;
  orderData.status = document.getElementById('statusBadge').textContent.toLowerCase();
  orderData.usdAmount = document.getElementById('statusUsdAmount').textContent.replace('$', '');
  orderData.zarTotal = document.getElementById('statusZarTotal').textContent.replace('R ', '');
  orderData.exchangeRate = document.getElementById('statusRate').textContent;
  orderData.beneficiary = document.getElementById('statusBeneficiary').textContent;
  orderData.location = document.getElementById('statusLocation').textContent;
  orderData.lastUpdated = document.getElementById('statusLastUpdated').textContent;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Payizi Global - Receipt', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Order Reference: ${orderData.orderId}`, 20, 40);
  doc.text(`Customer: ${orderData.customerName}`, 20, 50);
  doc.text(`Email: ${orderData.email}`, 20, 60);
  doc.text(`Status: ${orderData.status.toUpperCase()}`, 20, 70);
  doc.text(`Last Updated: ${orderData.lastUpdated}`, 20, 80);
  doc.text(`USD Amount: ${orderData.usdAmount}`, 20, 90);
  doc.text(`ZAR Total: ${orderData.zarTotal}`, 20, 100);
  doc.text(`Exchange Rate: ${orderData.exchangeRate}`, 20, 110);
  doc.text(`Beneficiary: ${orderData.beneficiary}`, 20, 120);
  doc.text(`Location: ${orderData.location}`, 20, 130);

  doc.setFontSize(10);
  doc.text('Thank you for using Payizi Global!', 105, 150, { align: 'center' });
  doc.text('© 2025 Payizi Global. All rights reserved.', 105, 160, { align: 'center' });

  doc.save(`${orderData.orderId}_receipt.pdf`);
}

// Global error handler
window.addEventListener('error', function(e) {
  console.error('🌍 Global error:', e.error);
  stopPolling();
});

console.log('✅ Status.js setup complete with dynamic updates');