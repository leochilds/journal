const form = document.getElementById('unlock-form');
const passwordInput = document.getElementById('password');
const error = document.getElementById('error');
const unlockView = document.getElementById('unlock-view');
const contentView = document.getElementById('content-view');
const title = document.getElementById('title');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.textContent = '';
  const password = passwordInput.value;
  try {
    const res = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const data = await res.json();
      title.textContent = data.payload.title;
      unlockView.style.display = 'none';
      contentView.style.display = 'block';
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
