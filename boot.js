/* Boot helpers kept out of index.html so the page can run under a strict
   script-src 'self' CSP. (1) Make the async font stylesheet apply once loaded.
   (2) Register the service worker only on http(s): file:// stays build-free. */
(function () {
  var fonts = document.getElementById('fontcss');
  if (fonts) {
    if (fonts.sheet) fonts.media = 'all';
    else fonts.addEventListener('load', function () { fonts.media = 'all'; });
  }
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
