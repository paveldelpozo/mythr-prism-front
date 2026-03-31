import { createSlaveWindowHtml } from '../services/slaveWindowHtml';

const query = new URLSearchParams(window.location.search);
const monitorId = query.get('monitorId')?.trim() ?? '';
const instanceToken = query.get('instanceToken')?.trim() ?? '';

if (monitorId.length === 0 || instanceToken.length === 0) {
  document.body.innerHTML =
    '<main style="font-family: sans-serif; padding: 20px;">Faltan parametros de sesion para inicializar la ventana esclava.</main>';
} else {
  const html = createSlaveWindowHtml({
    monitorId,
    instanceToken
  });
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const inlineScript = parsed.querySelector('script')?.textContent ?? '';

  document.title = parsed.title || document.title;

  const styleNodes = parsed.head.querySelectorAll('style');
  styleNodes.forEach((styleNode) => {
    document.head.appendChild(styleNode.cloneNode(true));
  });

  document.body.innerHTML = parsed.body.innerHTML;

  if (inlineScript.length > 0) {
    new Function(inlineScript)();
  }
}
