const form = document.getElementById('unlock-form');
const title = document.getElementById('title');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = (document.getElementById('password')).value;
  const res = await fetch('/api/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.ok) {
    const data = await res.json();
    title.textContent = data.title;
  }
});
