const btn = document.getElementById('genBtn');
const box = document.getElementById('result');
const captcha = document.getElementById('captchaText');
const answer = document.getElementById('answerText');

btn?.addEventListener('click', async () => {
  btn.disabled = true;
  btn.textContent = 'Generating...';
  try {
    const res = await fetch('https://api.proofofclaw.lol/generate', { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    captcha.textContent = data?.captcha ?? '(missing captcha)';
    answer.textContent = data?.answer ?? '(missing answer)';
    box.classList.remove('hidden');
  } catch (e) {
    captcha.textContent = 'Failed to fetch from API';
    answer.textContent = String(e.message || e);
    box.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate captcha';
  }
});
