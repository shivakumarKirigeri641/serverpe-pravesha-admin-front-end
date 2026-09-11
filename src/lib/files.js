/**
 * Hand a fetched file to the person: open it, print it, or save it.
 *
 * Files come from the API as blobs (fetched with the session token), so each of
 * the three is done through an object URL that is released a minute later.
 */
export function deliver({ blob, filename }, action = 'save') {
  const url = URL.createObjectURL(blob);
  if (action === 'open') {
    window.open(url, '_blank', 'noopener');
  } else if (action === 'print') {
    const frame = document.createElement('iframe');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    frame.src = url;
    frame.onload = () => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { window.open(url, '_blank', 'noopener'); }
    };
    document.body.appendChild(frame);
    setTimeout(() => frame.remove(), 60000);
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
