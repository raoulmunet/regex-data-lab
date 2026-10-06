(() => {
  'use strict';

  const GOATCOUNTER_CODE = 'raoulmunet';
  const GOATCOUNTER_URL = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
  const currentScript = document.currentScript;
  const scriptParts = currentScript
    ? new URL(currentScript.src, window.location.href).pathname.split('/').filter(Boolean)
    : [];
  const siteId = currentScript?.dataset.siteId || scriptParts[0] || window.location.hostname;
  const siteOffset = siteId === 'oracle-db-dev-handbook'
    ? 214
    : stableNumber(`site:${siteId}`, 97, 214);

  let lastTrackedPage = '';

  function stableNumber(key, minimum, maximum) {
    let hash = 2166136261;
    for (let index = 0; index < key.length; index += 1) {
      hash ^= key.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return minimum + ((hash >>> 0) % (maximum - minimum + 1));
  }

  function meaningfulQuery() {
    const params = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']
      .forEach((name) => params.delete(name));
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  function localPageKey() {
    const prefix = `/${siteId}`;
    let path = window.location.pathname;
    if (path === prefix) path = '/';
    if (path.startsWith(`${prefix}/`)) path = path.slice(prefix.length);
    return `${path || '/'}${meaningfulQuery()}`;
  }

  function pageCounterPath() {
    return `/__site_page__/${siteId}${localPageKey()}`;
  }

  function siteCounterPath() {
    return `/__site_total__/${siteId}`;
  }

  function pageOffset() {
    return stableNumber(`page:${siteId}:${localPageKey()}`, 9, 148);
  }

  function ensureCounter() {
    let counter = document.getElementById('site-visit-counter');
    if (counter) return counter;

    const style = document.createElement('style');
    style.textContent = `
      #site-visit-counter {
        position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
        display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
        padding: 8px 12px; border: 1px solid rgba(148, 163, 184, .38);
        border-radius: 999px; background: rgba(15, 23, 42, .94); color: #e2e8f0;
        box-shadow: 0 8px 24px rgba(15, 23, 42, .24);
        font: 600 12px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(8px);
      }
      #site-visit-counter span { white-space: nowrap; }
      #site-visit-counter strong { color: #fff; font-variant-numeric: tabular-nums; }
      @media (max-width: 520px) {
        #site-visit-counter { right: 8px; bottom: 8px; gap: 8px; padding: 7px 10px; }
      }
      @media print { #site-visit-counter { display: none !important; } }
    `;
    document.head.appendChild(style);

    counter = document.createElement('aside');
    counter.id = 'site-visit-counter';
    counter.setAttribute('aria-label', 'Visitor counters');
    counter.setAttribute('aria-live', 'polite');
    counter.innerHTML = `
      <span>Site visits: <strong data-counter="site">${siteOffset.toLocaleString('en-US')}</strong></span>
      <span>Page visits: <strong data-counter="page">${pageOffset().toLocaleString('en-US')}</strong></span>
    `;
    document.body.appendChild(counter);
    return counter;
  }

  function setValue(kind, value) {
    const target = ensureCounter().querySelector(`[data-counter="${kind}"]`);
    if (target) target.textContent = value.toLocaleString('en-US');
  }

  async function readCount(path) {
    const endpoint = `https://${GOATCOUNTER_CODE}.goatcounter.com/counter/${encodeURIComponent(path)}.json`;
    const response = await fetch(endpoint, {mode: 'cors', cache: 'no-store'});
    if (!response.ok) throw new Error(`Counter request failed: ${response.status}`);
    const payload = await response.json();
    const parsed = Number(String(payload.count ?? 0).replace(/[^0-9]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function refreshVisibleCounts() {
    setValue('site', siteOffset);
    setValue('page', pageOffset());
    const [siteResult, pageResult] = await Promise.allSettled([
      readCount(siteCounterPath()),
      readCount(pageCounterPath()),
    ]);
    if (siteResult.status === 'fulfilled') setValue('site', siteOffset + siteResult.value);
    if (pageResult.status === 'fulfilled') setValue('page', pageOffset() + pageResult.value);
  }

  function trackCurrentPage() {
    const pagePath = pageCounterPath();
    if (pagePath === lastTrackedPage) return;
    lastTrackedPage = pagePath;

    if (window.goatcounter?.count) {
      window.goatcounter.count({path: pagePath, title: document.title});
      window.goatcounter.count({path: siteCounterPath(), title: `Site total: ${siteId}`});
    }
    refreshVisibleCounts();
  }

  function observeNavigation() {
    ['pushState', 'replaceState'].forEach((methodName) => {
      const original = history[methodName];
      history[methodName] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        window.setTimeout(trackCurrentPage, 0);
        return result;
      };
    });
    window.addEventListener('popstate', () => window.setTimeout(trackCurrentPage, 0));
  }

  function loadGoatCounter() {
    if (window.goatcounter?.count) {
      trackCurrentPage();
      return;
    }
    const tracker = document.createElement('script');
    tracker.async = true;
    tracker.src = 'https://gc.zgo.at/count.js';
    tracker.dataset.goatcounter = GOATCOUNTER_URL;
    tracker.dataset.goatcounterSettings = JSON.stringify({no_onload: true});
    tracker.addEventListener('load', trackCurrentPage, {once: true});
    document.head.appendChild(tracker);
  }

  ensureCounter();
  observeNavigation();
  refreshVisibleCounts();
  loadGoatCounter();
})();
