const form = document.getElementById('unlock-form');
const passwordInput = document.getElementById('password');
const error = document.getElementById('error');
const unlockView = document.getElementById('unlock-view');
const contentView = document.getElementById('content-view');
const title = document.getElementById('title');
const datePicker = document.getElementById('date-picker');
const entriesList = document.getElementById('entries');
const newEntry = document.getElementById('new-entry');
const addEntry = document.getElementById('add-entry');
const summary = document.getElementById('summary');
const saveSummary = document.getElementById('save-summary');

let password = '';

const renderEntries = (entries) => {
  entriesList.innerHTML = '';
  entries.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'w3-bar';
    const span = document.createElement('span');
    span.className = 'w3-bar-item';
    span.textContent = entry.content;
    const btn = document.createElement('button');
    btn.className = 'w3-bar-item w3-button w3-small w3-right';
    btn.textContent = 'Edit';
    btn.addEventListener('click', async () => {
      const updated = prompt('Edit entry', entry.content);
      if (updated && updated !== entry.content) {
        await fetch(`/api/entries/${entry.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Password': password,
          },
          body: JSON.stringify({content: updated}),
        });
        loadDay(datePicker.value);
      }
    });
    li.appendChild(span);
    li.appendChild(btn);
    entriesList.appendChild(li);
  });
};

const loadDay = async (date) => {
  try {
    const res = await fetch(`/api/entries?date=${date}`, {
      headers: {'X-Password': password},
    });
    if (res.ok) {
      const day = await res.json();
      summary.value = day.summary || '';
      renderEntries(day.entries || []);
    } else {
      summary.value = '';
      entriesList.innerHTML = '';
    }
  } catch {
    summary.value = '';
    entriesList.innerHTML = '';
  }
};

datePicker.addEventListener('change', () => {
  loadDay(datePicker.value);
});

addEntry.addEventListener('click', async () => {
  const content = newEntry.value.trim();
  if (!content) return;
  await fetch('/api/entries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Password': password,
    },
    body: JSON.stringify({date: datePicker.value, content}),
  });
  newEntry.value = '';
  loadDay(datePicker.value);
});

saveSummary.addEventListener('click', async () => {
  await fetch(`/api/summary/${datePicker.value}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Password': password,
    },
    body: JSON.stringify({summary: summary.value}),
  });
  loadDay(datePicker.value);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.textContent = '';
  const pwd = passwordInput.value;
  try {
    const res = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    });
    if (res.ok) {
      const data = await res.json();
      title.textContent = data.payload.title;
      unlockView.style.display = 'none';
      contentView.style.display = 'block';
      password = pwd;
      // prefill with the user's local date in YYYY-MM-DD format
      datePicker.value = new Date().toLocaleDateString('en-CA');
      loadDay(datePicker.value);
    } else if (res.status === 400) {
      const data = await res.json().catch(() => ({}));
      error.textContent = data.error || 'Password required';
    } else if (res.status >= 500) {
      error.textContent = 'Server error. Please try again later.';
    } else {
      error.textContent = 'Unexpected error.';
    }
  } catch {
    error.textContent = 'Network error.';
  }
});
