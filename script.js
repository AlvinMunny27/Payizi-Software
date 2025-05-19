document.addEventListener('DOMContentLoaded', () => {
  const usdAmountInput = document.getElementById('usdAmount');
  const rateSpan = document.getElementById('rate');
  const effectiveRateSpan = document.getElementById('effectiveRate');
  const zarTotalSpan = document.getElementById('zarTotal');
  let displayRate = 0;
  let effectiveRate = 0;

  // Disable input until rate is loaded
  usdAmountInput.disabled = true;

  // Fetch live exchange rate from API
  fetch('https://open.er-api.com/v6/latest/USD')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      return response.json();
    })
    .then(data => {
      const apiRate = parseFloat(data.rates.ZAR);
      if (isNaN(apiRate)) throw new Error('Invalid rate');
      displayRate = apiRate;
      effectiveRate = displayRate / 0.98; // Calculate effective rate
      rateSpan.textContent = displayRate.toFixed(5);
      effectiveRateSpan.textContent = effectiveRate.toFixed(5);
      usdAmountInput.disabled = false;
    })
    .catch(error => {
      console.error(`Rate fetch error: ${error.message}`);
      displayRate = 18.20; // Fallback rate
      effectiveRate = displayRate / 0.98;
      rateSpan.textContent = displayRate.toFixed(5);
      effectiveRateSpan.textContent = effectiveRate.toFixed(5);
      usdAmountInput.disabled = false;
    });

  // Update ZAR total on USD amount input
  usdAmountInput.addEventListener('input', () => {
    const usdAmount = parseFloat(usdAmountInput.value) || 0;
    const zarTotal = Math.ceil((usdAmount * effectiveRate) / 10) * 10;
    zarTotalSpan.textContent = zarTotal.toFixed(2);
  });

  // Handle form submission
  const form = document.getElementById('orderForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const usdAmount = parseFloat(usdAmountInput.value);
    if (usdAmount % 10 !== 0) {
      alert('USD amount must be a multiple of 10.');
      return;
    }

    // Collect all form data
    const data = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      mobile: document.getElementById('mobile').value,
      beneficiaryName: document.getElementById('beneficiaryName').value,
      beneficiaryMobile: document.getElementById('beneficiaryMobile').value,
      beneficiaryId: document.getElementById('beneficiaryId').value,
      country: document.getElementById('country').value,
      location: document.getElementById('location').value,
      usdAmount: usdAmount,
      rate: displayRate.toFixed(5),
      effectiveRate: effectiveRate.toFixed(5),
      zarTotal: zarTotalSpan.textContent
    };

    // Submit via hidden form to avoid CORS
    const hiddenForm = document.createElement('form');
    hiddenForm.method = 'POST';
    hiddenForm.action = 'https://script.google.com/macros/s/AKfycbwr-ff3DRG557Y2StZIkC8VIvl8saZVCwi-L4MkV_kxMyE1z0NC-HdDGTTyJC8Yh77s/exec'; // Replace with your Web App URL
    hiddenForm.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify(data);
    hiddenForm.appendChild(input);
    document.body.appendChild(hiddenForm);

    hiddenForm.submit();
    document.getElementById('confirmation').style.display = 'block';
    setTimeout(() => {
      form.reset();
      zarTotalSpan.textContent = '0.00';
      document.getElementById('confirmation').style.display = 'none';
      document.body.removeChild(hiddenForm);
    }, 3000);
  });
});