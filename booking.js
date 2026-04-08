(function () {
  const roomMap = {
    "Deluxe": ["202", "205"],
    "Executive Deluxe": ["201", "203", "204"],
    "Royal Deluxe": ["206", "207", "208"]
  };

  const priceMap = {
    "Deluxe": 15000,
    "Executive Deluxe": 20000,
    "Royal Deluxe": 25000
  };

  const API_URL = '/api';
  const entriesEl = document.getElementById('entries');
  const form = document.getElementById('booking-form');
  const result = document.getElementById('result');

  // --- MODAL ELEMENTS ---
  const confirmationModal = document.getElementById('confirmation-modal');
  const confirmationDetails = document.getElementById('confirmation-details');
  const confirmBtn = document.getElementById('confirm-booking-btn');
  const cancelBtn = document.getElementById('cancel-booking-btn');
  const closeModalSpan = document.querySelector('.close-modal');
  let pendingBooking = null;

  function showConfirmationModal(data) {
    let html = `<p><strong>Name:</strong> ${data.customer.name}</p>`;
    html += `<p><strong>Email:</strong> ${data.customer.email}</p>`;
    html += `<h3>Rooms:</h3><ul>`;
    
    let total = 0;
    data.entries.forEach(en => {
        let price = priceMap[en.type] || 0;
        let typeLabel = en.type;
        if (data.isServiceApartment && en.type === 'Royal Deluxe') {
            price = 45000;
            typeLabel += ' Service Apartment';
        }
        const subtotal = price * en.qty * (en.nights || 0);
        total += subtotal;
        html += `<li>${en.qty} x ${typeLabel} (Room ${en.number})<br>
                 ${en.checkIn} to ${en.checkOut} (${en.nights} nights)<br>
                 Price: ₦${subtotal.toLocaleString()}</li>`;
    });
    html += `</ul>`;
    html += `<p><strong>Total Estimated Price:</strong> ₦${total.toLocaleString()}</p>`;
    
    confirmationDetails.innerHTML = html;
    confirmationModal.style.display = 'block';
  }

  function hideConfirmationModal() {
    confirmationModal.style.display = 'none';
  }

  if (closeModalSpan) closeModalSpan.onclick = hideConfirmationModal;
  if (cancelBtn) cancelBtn.onclick = hideConfirmationModal;
  window.onclick = function(event) {
    if (event.target == confirmationModal) {
        hideConfirmationModal();
    }
  }

  // --- API HELPER FUNCTIONS ---

  async function loadBookings() {
    try {
      const res = await fetch(`${API_URL}/bookings`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('Failed to load bookings', e);
      return [];
    }
  }

  async function saveBooking(record) {
    try {
      await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
    } catch (e) {
      console.error('Failed to save booking', e);
      alert('Connection error: Could not save booking. Please contact support.');
    }
  }

  // Check overlap (Helper)
  function overlaps(aStart, aEnd, bStart, bEnd) {
    const sA = new Date(aStart); const eA = new Date(aEnd);
    const sB = new Date(bStart); const eB = new Date(bEnd);
    return !(eA <= sB || sA >= eB);
  }

  // --- UI LOGIC ---

  function updateServiceApartmentState() {
    const saCheckbox = document.getElementById('serviceApartment');
    if (!saCheckbox) return;

    const entries = Array.from(entriesEl.children);
    const hasRoyal = entries.some(wrap => {
      const sel = wrap.querySelector('select[name="roomType"]');
      return sel && sel.value === 'Royal Deluxe';
    });

    if (!hasRoyal) {
      saCheckbox.checked = false;
      saCheckbox.disabled = true;
      saCheckbox.parentElement.style.opacity = '0.5';
      saCheckbox.parentElement.title = "Only available for Royal Deluxe rooms";
    } else {
      saCheckbox.disabled = false;
      saCheckbox.parentElement.style.opacity = '1';
      saCheckbox.parentElement.title = "";
    }
  }

  function createEntry(prefill) {
    const idx = Date.now() + Math.random();
    const wrap = document.createElement('div');
    wrap.className = 'entry';
    wrap.dataset.id = idx;

    const typeLabel = document.createElement('label'); typeLabel.textContent = 'Room Type';
    const typeSel = document.createElement('select'); typeSel.name = 'roomType';
    for (const t of Object.keys(roomMap)) {
      const o = document.createElement('option'); o.value = t; o.textContent = t; typeSel.appendChild(o);
    }
    if (prefill && prefill.type) typeSel.value = prefill.type;

    const numLabel = document.createElement('label'); numLabel.textContent = 'Room Number';
    const numSel = document.createElement('select'); numSel.name = 'roomNumber';

    const checkInLabel = document.createElement('label'); checkInLabel.textContent = 'Check In';
    const checkIn = document.createElement('input'); checkIn.type = 'date'; checkIn.name = 'checkIn';
    if (prefill && prefill.checkIn) checkIn.value = prefill.checkIn;

    const checkOutLabel = document.createElement('label'); checkOutLabel.textContent = 'Check Out';
    const checkOut = document.createElement('input'); checkOut.type = 'date'; checkOut.name = 'checkOut';
    if (prefill && prefill.checkOut) checkOut.value = prefill.checkOut;

    const qtyLabel = document.createElement('label'); qtyLabel.textContent = 'Number of Rooms';
    const qty = document.createElement('input'); qty.type = 'number'; qty.name = 'quantity'; qty.min = 1; qty.value = (prefill && prefill.qty) ? prefill.qty : 1;

    const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.textContent = 'Remove'; removeBtn.className = 'btn'; removeBtn.style.background = '#c0392b';

    const leftCol = document.createElement('div');
    leftCol.appendChild(typeLabel);
    leftCol.appendChild(typeSel);
    leftCol.appendChild(checkInLabel);
    leftCol.appendChild(checkIn);

    const rightCol = document.createElement('div');
    rightCol.appendChild(numLabel);
    rightCol.appendChild(numSel);
    rightCol.appendChild(checkOutLabel);
    rightCol.appendChild(checkOut);

    const bottomRow = document.createElement('div');
    bottomRow.style.display = 'flex'; bottomRow.style.gap = '8px'; bottomRow.style.alignItems = 'center';
    bottomRow.appendChild(qtyLabel);
    bottomRow.appendChild(qty);
    bottomRow.appendChild(removeBtn);

    wrap.appendChild(leftCol);
    wrap.appendChild(rightCol);
    const container = document.createElement('div'); container.style.gridColumn = '1/-1'; container.appendChild(bottomRow);
    wrap.appendChild(container);

    function populateNumbers() {
      const type = typeSel.value;
      numSel.innerHTML = '';
      for (const n of roomMap[type]) {
        const o = document.createElement('option'); o.value = n; o.textContent = n; numSel.appendChild(o);
      }
      if (prefill && prefill.number) numSel.value = prefill.number;
    }

    typeSel.addEventListener('change', () => {
      populateNumbers();
      updateServiceApartmentState();
    });
    removeBtn.addEventListener('click', () => {
      wrap.remove();
      updateServiceApartmentState();
    });

    entriesEl.appendChild(wrap);
    populateNumbers();
    updateServiceApartmentState();

    return { wrap, typeSel, numSel, checkIn, checkOut, qty };
  }

  createEntry();
  document.getElementById('add-entry').addEventListener('click', () => createEntry());

  function prefillFromQuery() {
    const params = new URLSearchParams(location.search);
    const type = params.get('roomType');
    const number = params.get('roomNumber');

    if (params.get('serviceApartment') === 'true') {
      const saCheckbox = document.getElementById('serviceApartment');
      if (saCheckbox) saCheckbox.checked = true;
    }

    if (type) { entriesEl.innerHTML = ''; createEntry({ type, number }); }
  }
  prefillFromQuery();

  function daysBetween(a, b) {
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = (new Date(b) - new Date(a));
    if (isNaN(diff)) return null;
    return Math.max(0, Math.round(diff / oneDay));
  }

  async function checkAvailability(entries) {
    const existing = await loadBookings();

    // Check conflicts
    for (const en of entries) {
      for (const e of existing) {
        // Ensure we check against confirmed/pending bookings (ignoring 'cancelled' logic if added later)
        if (e.status !== 'cancelled' && e.number === en.number) {
          if (overlaps(en.checkIn, en.checkOut, e.checkIn, e.checkOut)) {
            // Format dates for display
            return { ok: false, message: `Room ${en.number} is already booked from ${e.checkIn} to ${e.checkOut}` };
          }
        }
      }
    }
    return { ok: true };
  }

  function renderPaymentOptions(totalAmount, entries, customer) {
    let html = `<h3>Payment</h3><p><strong>Total:</strong> ₦${totalAmount.toLocaleString()}</p>`;
    html += `<p>Select payment provider to pay now:</p>`;
    html += `<div style="display:flex;gap:10px;flex-wrap:wrap">`;
    html += `<button id="pay-paystack" class="btn secondary">Pay with Paystack</button>`;
    html += `<button id="pay-flutter" class="btn secondary">Pay with Flutterwave</button>`;
    html += `</div>`;
    html += `<p style="margin-top:12px">Or send booking request by email: <button id="send-mail" class="btn">Send Email Request</button> <button id="print-booking" class="btn" style="background: #555; margin-left: 10px;">Print Details</button></p>`;

    result.style.display = 'block'; result.innerHTML = html;

    document.getElementById('print-booking').addEventListener('click', () => {
      window.print();
    });

    document.getElementById('send-mail').addEventListener('click', async () => {
      const subject = encodeURIComponent('Booking Request - Julsona Hotels');
      let body = 'Booking request%0A%0A';
      // Note: en.type includes "(Service Apartment)" if applicable, as it is updated in the confirm logic
      for (const en of entries) { body += `${en.qty} x ${en.type} (Room ${en.number}) — ${en.checkIn} to ${en.checkOut} (${en.nights} nights)%0A`; }
      body += `%0ACustomer: ${customer.name} (${customer.email})%0A%0APlease contact me to confirm and arrange payment.%0A`;
      body += `%0AView booking online: ${window.location.origin}%0A`;

      // Save as pending booking before email
      for (const en of entries) {
        await saveBooking({ ...en, customer, paid: false, provider: 'email', status: 'pending' });
      }

      location.href = `mailto:julsonahotelssuites@gmail.com?subject=${subject}&body=${body}`;

      alert('Booking request saved! Opening your email client...');
      window.location.reload();
    });

    document.getElementById('pay-paystack').addEventListener('click', () => {
      payWithPaystack(totalAmount, entries, customer);
    });

    document.getElementById('pay-flutter').addEventListener('click', () => {
      payWithFlutterwave(totalAmount, entries, customer);
    });
  }

  // Ensure Paystack SDK is globally loaded when this page initializes
  if (!window.PaystackPop) {
      const script = document.createElement('script');
      script.src = "https://js.paystack.co/v1/inline.js";
      document.head.appendChild(script);
  }

  function payWithPaystack(amountNaira, entries, customer) {
    const PAYSTACK_KEY = 'pk_test_e8cee5063d1fc536fccfa92ed4a80a403651e814';
    
    if (!window.PaystackPop) {
        alert("Payment gateway is still loading. Please check your internet connection or disable any strict AdBlockers, then click Pay again.");
        return;
    }
    
    launchPaystack(PAYSTACK_KEY, amountNaira, entries, customer);
  }

  function launchPaystack(PAYSTACK_KEY, amountNaira, entries, customer) {
    const handler = PaystackPop.setup({
      key: PAYSTACK_KEY,
      email: customer.email,
      amount: amountNaira * 100,
      currency: 'NGN',
      metadata: { custom_fields: [{ display_name: 'Customer', variable_name: 'customer_name', value: customer.name }] },
      callback: async function (response) {
        for (const en of entries) {
          await saveBooking({ ...en, customer, paid: true, provider: 'paystack', txref: response.reference, status: 'confirmed' });
        }
        result.innerHTML = '<h3>Payment successful</h3><p>Reference: ' + response.reference + '</p><p>Booking Confirmed! We have received your payment.</p>';
      },
      onClose: function () { alert('Payment window closed'); }
    });
    handler.openIframe();
  }

  function payWithFlutterwave(amountNaira, entries, customer) {
    const FLW_KEY = 'FLUTTERWAVE_PUBLIC_KEY_HERE';
    if (!window.FlutterWaveCheckout && !window.getpaidSetup) { alert('Flutterwave SDK not loaded'); return; }
    FlutterwaveCheckout({
      public_key: FLW_KEY,
      tx_ref: 'JULSONA_' + Date.now(),
      amount: amountNaira,
      currency: 'NGN',
      payment_options: 'card,banktransfer,ussd',
      customer: { email: customer.email, name: customer.name },
      callback: async function (data) {
        for (const en of entries) {
          await saveBooking({ ...en, customer, paid: true, provider: 'flutterwave', txref: data.tx_ref || data.transaction_id, status: 'confirmed' });
        }
        result.innerHTML = '<h3>Payment successful</h3><p>Reference: ' + (data.tx_ref || data.transaction_id) + '</p><p>Booking Confirmed! We have received your payment.</p>';
      },
      onclose: function () { alert('Payment window closed'); },
      customizations: { title: 'Julsona Hotels Booking' }
    });
  }

  // Handle Confirm Button Click
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async function() {
        hideConfirmationModal();
        if (!pendingBooking) return;

        const { entries, customer, isServiceApartment } = pendingBooking;
        
        // Show loading...
        const btn = form.querySelector('button[type="submit"]');
        const oldText = btn.textContent;
        btn.textContent = 'Checking availability...';
        btn.disabled = true;

        try {
            const avail = await checkAvailability(entries);

            btn.textContent = oldText;
            btn.disabled = false;

            if (!avail.ok) { alert(avail.message); return; }

            let totalRooms = 0; let totalRoomNights = 0; let totalAmount = 0;
            let summary = '<h3>Booking Summary</h3><ul>';

            for (const en of entries) {
                let price = priceMap[en.type] || 0;
                if (isServiceApartment && en.type === 'Royal Deluxe') {
                    price = 45000;
                    en.type += ' Service Apartment';
                }

                summary += `<li>${en.qty} x ${en.type} (Room ${en.number}) — ${en.checkIn} → ${en.checkOut} (${en.nights} night(s))</li>`;
                totalRooms += en.qty; totalRoomNights += (en.nights || 0) * en.qty; totalAmount += price * en.qty * (en.nights || 0);
            }
            summary += '</ul>';
            summary += `<p><strong>Total rooms booked:</strong> ${totalRooms}</p>`;
            summary += `<p><strong>Total room-nights:</strong> ${totalRoomNights}</p>`;
            summary += `<p><strong>Amount due (NGN):</strong> ₦${totalAmount.toLocaleString()}</p>`;
            result.style.display = 'block'; result.innerHTML = summary;

            renderPaymentOptions(totalAmount, entries, customer);
        } catch (err) {
            btn.textContent = oldText;
            btn.disabled = false;
            alert('Error: Could not check availability with server.');
            console.error(err);
        }
    });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const customerName = document.getElementById('customerName').value.trim();
    const customerEmail = document.getElementById('customerEmail').value.trim();
    if (!customerName || !customerEmail) { alert('Please enter your name and email'); return; }

    const entries = [];
    for (const wrap of entriesEl.children) {
      const selType = wrap.querySelector('select[name="roomType"]').value;
      const selNumber = wrap.querySelector('select[name="roomNumber"]').value;
      const checkIn = wrap.querySelector('input[name="checkIn"]').value;
      const checkOut = wrap.querySelector('input[name="checkOut"]').value;
      const qty = parseInt(wrap.querySelector('input[name="quantity"]').value || 1, 10);
      const nights = (checkIn && checkOut) ? daysBetween(checkIn, checkOut) : null;
      entries.push({ type: selType, number: selNumber, checkIn, checkOut, qty, nights });
    }

    if (entries.length === 0) { alert('Please add at least one room'); return; }
    for (const en of entries) {
      if (!en.checkIn || !en.checkOut) { alert('Please provide check-in and check-out dates for all entries'); return; }
      if (new Date(en.checkOut) <= new Date(en.checkIn)) { alert('Check-out must be after check-in'); return; }
    }

    const isServiceApartmentChecked = document.getElementById('serviceApartment') && document.getElementById('serviceApartment').checked;
    if (isServiceApartmentChecked) {
      const hasRoyal = entries.some(en => en.type === 'Royal Deluxe');
      if (!hasRoyal) {
        alert('The "Book as Service Apartment" option is only available for Royal Deluxe rooms. Please select a Royal Deluxe room or uncheck the option.');
        return;
      }
    }

    // Show Confirmation Modal
    pendingBooking = { entries, customer: { name: customerName, email: customerEmail }, isServiceApartment: isServiceApartmentChecked };
    showConfirmationModal(pendingBooking);
  });

})();