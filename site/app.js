const btn = document.getElementById('genBtn');
const box = document.getElementById('result');
const contextEl = document.getElementById('contextText');
const captchaEl = document.getElementById('captchaText');
const answerEl = document.getElementById('answerText');

btn?.addEventListener('click', async () => {
  btn.disabled = true;
  btn.textContent = 'Generating...';

  try {
    const res = await fetch('https://api.proofofclaw.lol/generate', { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    contextEl.textContent = data?.context ?? '(missing context)';
    captchaEl.textContent = data?.captcha ?? '(missing captcha)';
    answerEl.textContent = data?.answer ?? '(missing answer)';
    box.classList.remove('hidden');
  } catch (e) {
    contextEl.textContent = 'Failed to fetch from API';
    captchaEl.textContent = 'Check Worker deployment / CORS / domain routing.';
    answerEl.textContent = String(e?.message || e);
    box.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate captcha';
  }
});
