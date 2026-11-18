/* ============================================================
   Corporación Norte — marketplace mayorista
   Catálogo + pedido + cierre por WhatsApp. Sin dependencias.
   Datos: data/productos.js · Ajustes: js/config.js
   ============================================================ */
(() => {
  'use strict';
  const D = window.NORTE, CFG = window.NORTE_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const money = n => '$ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = n => n.toLocaleString('es-VE');
  const plural = (u, n) => n === 1 ? u : (/s$/.test(u) ? u : (/[lrdnz]$/.test(u) && u !== 'blister' ? u + 'es' : u + 's'));
  const ACR = new Set(['led', 'pvc', 'ppr', 'usb', 'sds', 'hdmi', 'cpvc', 'ac', 'dc', 'uv', 'tv', 'lcd', 'rgb', 'wifi', 'pet', 'abs', 'hdd', 'sata', 'rj45', 'gfci', 'sae', 'npt', 'hss', 'rca', 'crv', 'cr-v', 'epp', 'pp', 'pu', 'pe']);
  // "BROCA PARA CONCRETO" → "Broca para concreto" (conserva siglas y medidas)
  const nice = s => {
    const t = s.toLowerCase().replace(/(^|[\s(\/-])([a-záéíóúñ])/g, (m, a, b, off) => off === 0 ? a + b.toUpperCase() : m);
    return t.split(/(\s+)/).map(w => (/\d/.test(w) || ACR.has(w.toLowerCase().replace(/[^a-z0-9-]/g, ''))) ? w.toUpperCase() : w).join('');
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* modo privado */ } }
  };

  /* ---------- datos ---------- */
  const ITEMS = D.items.map((r, i) => {
    const [cod, mk, nombre, precio, min, unit, nuevo, cat, img] = r;
    const parts = nombre.split('|').map(s => s.trim()).filter(Boolean);
    const marca = mk >= 0 ? D.marcas[mk] : '';
    return {
      i, cod, marca, mk, nombre, title: nice(parts[0] || nombre), spec: parts.slice(1).join(' · '),
      precio, min, unit, nuevo: !!nuevo, cat, img,
      hay: norm(cod + ' ' + nombre + ' ' + marca + ' ' + D.cats[cat])
    };
  });
  const BYCOD = new Map(ITEMS.map(it => [it.cod, it]));
  const catCount = new Array(D.cats.length).fill(0);
  ITEMS.forEach(it => catCount[it.cat]++);
  const catByName = n => D.cats.findIndex(c => norm(c).startsWith(norm(n)));
  const withImg = list => list.filter(it => it.img);
  const slug = t => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const CATSLUG = D.cats.map(slug);
  const pHref = it => '#/p/' + encodeURIComponent(it.cod);
  function go(h) { if (location.hash === h) route(); else location.hash = h; }

  /* ---------- estado ---------- */
  const S = { browse: false, q: '', cat: -1, marca: -1, sort: 'rel', pmin: null, pmax: null, nuevo: false, list: [], shown: 0, view: store.get('norte_vista', 'grid') };
  const PAGE = 36;
  let cart = store.get('norte_pedido_v1', {});
  Object.keys(cart).forEach(k => { if (!BYCOD.has(k) || !(cart[k] > 0)) delete cart[k]; });
  const saveCart = () => store.set('norte_pedido_v1', cart);
  const orderNo = (() => { const d = new Date(); return 'N.º ' + String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(); })();
  const isActive = () => !!(S.browse || S.q || S.cat >= 0 || S.marca >= 0 || S.nuevo || S.pmin != null || S.pmax != null);

  /* ---------- tarjetas ---------- */
  function stepper(it, q) {
    return `<div class="step" role="group" aria-label="Cantidad">
      <button type="button" data-act="dec" aria-label="Quitar uno">−</button>
      <input class="qty" type="number" inputmode="numeric" min="${it.min}" value="${q}" aria-label="Cantidad de ${esc(it.title)}">
      <button type="button" data-act="inc" aria-label="Agregar uno">+</button></div>`;
  }
  function buyControls(it) {
    const q = cart[it.cod];
    if (!q) return `<button class="add" type="button" data-act="add"><svg aria-hidden="true"><use href="#i-cart"/></svg>Agregar${it.min > 1 ? ' ' + it.min : ''}</button>`;
    return stepper(it, q) + `<p class="card__sub">En tu pedido · ${money(it.precio * q)}</p>`;
  }
  function card(it) {
    return `<article class="card${cart[it.cod] ? ' in-cart' : ''}" data-i="${it.i}">
      <a class="card__ph${it.img ? '' : ' nophoto'}" href="${pHref(it)}" aria-label="Ver ${esc(it.title)}">
        ${it.img ? `<img src="img/${it.img}" alt="${esc(it.title)}" loading="lazy" decoding="async" width="320" height="320">` : ''}
        ${it.nuevo ? '<span class="card__new">NUEVO</span>' : ''}
      </a>
      <div class="card__body">
        <p class="card__brand">${esc(it.marca) || '&nbsp;'}</p>
        <h3 class="card__name"><a href="${pHref(it)}" title="${esc(it.title)}">${esc(it.title)}</a></h3>
        <p class="card__spec">${esc(it.spec) || '&nbsp;'}</p>
        <p class="card__cod">Cód. ${esc(it.cod)}</p>
        <div class="card__price">${money(it.precio)}<small>/ ${esc(it.unit)}</small></div>
        <p class="card__moq">Pedido mín.: <b>${it.min} ${esc(plural(it.unit, it.min))}</b></p>
      </div>
      <div class="card__buy ctl">${buyControls(it)}</div>
    </article>`;
  }

  /* ---------- resultados ---------- */
  function applyFilters() {
    const toks = norm(S.q).split(/\s+/).filter(Boolean);
    const out = ITEMS.filter(it =>
      (S.cat < 0 || it.cat === S.cat) &&
      (S.marca < 0 || it.mk === S.marca) &&
      (!S.nuevo || it.nuevo) &&
      (S.pmin == null || it.precio >= S.pmin) &&
      (S.pmax == null || it.precio <= S.pmax) &&
      toks.every(t => it.hay.includes(t)));
    if (S.sort === 'asc') out.sort((a, b) => a.precio - b.precio);
    else if (S.sort === 'desc') out.sort((a, b) => b.precio - a.precio);
    else if (S.sort === 'az') out.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    S.list = out; S.shown = 0;
    $('#grid').innerHTML = '';
    renderMore();
    renderMeta(toks);
  }
  function renderMore() {
    const next = S.list.slice(S.shown, S.shown + PAGE);
    $('#grid').insertAdjacentHTML('beforeend', next.map(card).join(''));
    S.shown += next.length;
    $('#more').hidden = S.shown >= S.list.length;
    $('#empty').hidden = S.list.length > 0;
  }
  function renderMeta(toks) {
    const act = isActive();
    document.body.classList.toggle('is-search', act);
    const n = S.list.length;
    $('#count').innerHTML = `<b>${num(n)}</b> ${n === 1 ? 'producto' : 'productos'}`;
    const head = S.cat >= 0 && !S.q;
    $('#resTitle').textContent = !act || (S.browse && !S.q && !S.nuevo && S.marca < 0 && S.pmin == null && S.pmax == null) ? 'Todos los productos' : head ? 'Productos del pasillo' : S.q ? `Resultados para “${S.q}”` : S.nuevo ? 'Novedades' : 'Productos filtrados';
    renderCatHead(head);
    // ruta
    const crumb = $('#crumb');
    crumb.hidden = !act;
    if (act) {
      const bits = ['<a href="#/" data-home>Inicio</a>'];
      if (S.cat >= 0) bits.push(S.q ? `<a href="#/c/${CATSLUG[S.cat]}">${esc(D.cats[S.cat])}</a>` : `<b>${esc(D.cats[S.cat])}</b>`);
      if (S.q) bits.push(`<b>Resultados para “${esc(S.q)}”</b>`);
      if (S.cat < 0 && !S.q) bits.push(`<b>${S.nuevo ? 'Novedades' : 'Todos los productos'}</b>`);
      crumb.innerHTML = bits.join('<svg aria-hidden="true"><use href="#i-chev"/></svg>');
    }
    // contadores por pasillo (respetan la búsqueda)
    const base = ITEMS.filter(it => toks.every(t => it.hay.includes(t)));
    const counts = new Array(D.cats.length).fill(0);
    base.forEach(it => counts[it.cat]++);
    $$('#catList button').forEach(b => {
      const c = +b.dataset.c, k = c < 0 ? base.length : counts[c];
      b.querySelector('span').textContent = num(k);
      b.classList.toggle('zero', k === 0 && c >= 0);
      b.setAttribute('aria-pressed', String(c === S.cat));
    });
    // sincroniza controles
    if (document.activeElement !== $('#q')) $('#q').value = S.q;
    $('#qCat').value = String(S.cat);
    // etiquetas de filtros
    const chips = [];
    if (S.q) chips.push(['q', `Búsqueda: ${S.q}`]);
    if (S.marca >= 0) chips.push(['marca', D.marcas[S.marca]]);
    if (S.pmin != null || S.pmax != null) chips.push(['precio', `Precio ${S.pmin != null ? '$' + S.pmin : '…'} – ${S.pmax != null ? '$' + S.pmax : '…'}`]);
    if (S.nuevo) chips.push(['nuevo', 'Novedades']);
    $('#chips').innerHTML = chips.map(([k, t]) => `<button class="chip" type="button" data-chip="${k}">${esc(t)} <svg aria-hidden="true"><use href="#i-x"/></svg></button>`).join('');
  }
  function resetFilters() {
    Object.assign(S, { q: '', cat: -1, marca: -1, pmin: null, pmax: null, nuevo: false });
    $('#fMarca').value = '-1'; $('#pMin').value = ''; $('#pMax').value = ''; $('#fNuevo').checked = false; $('#q').value = '';
  }
  function goHome() { closeMega(); go('#/'); }
  function goResults() {
    closeMega();
    const y = $('#resultados').getBoundingClientRect().top + scrollY - $('#top').offsetHeight - 10;
    scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }
  function showCat(k) { go('#/c/' + CATSLUG[k]); }
  function showNuevos() { go('#/novedades'); }
  function setView(v) {
    S.view = v; store.set('norte_vista', v);
    $('#grid').classList.toggle('list', v === 'list');
    $('#vGrid').setAttribute('aria-pressed', String(v === 'grid'));
    $('#vList').setAttribute('aria-pressed', String(v === 'list'));
  }

  /* ---------- pedido ---------- */
  const lines = () => Object.keys(cart).map(c => ({ it: BYCOD.get(c), q: cart[c] }));
  const total = () => lines().reduce((s, l) => s + l.it.precio * l.q, 0);
  function setQty(cod, q) {
    const it = BYCOD.get(cod);
    q = Math.floor(+q) || 0;
    if (q < it.min) q = 0;                 // por debajo de la venta mínima sale del pedido
    if (q > 99999) q = 99999;
    if (q) cart[cod] = q; else delete cart[cod];
    saveCart(); syncCart(cod);
  }
  function syncCart(cod) {
    const n = Object.keys(cart).length, t = total();
    $('#cartN').textContent = n; $('#cartT').textContent = money(t);
    $('#dockN').textContent = n; $('#dockT').textContent = money(t);
    $('#dock').hidden = n === 0; $('#dock').classList.toggle('on', n > 0);
    if (cod) {
      const it = BYCOD.get(cod);
      $$(`[data-i="${it.i}"]`).forEach(c => {
        const ctl = c.querySelector('.ctl'); if (!ctl) return;
        c.classList.toggle('in-cart', !!cart[cod]);
        ctl.innerHTML = buyControls(it);
      });
    }
    if ($('#slip').classList.contains('open')) renderSlip();
  }
  function renderSlip() {
    const L = lines();
    $('#slip').classList.toggle('is-empty', L.length === 0);
    $('#slipNo').textContent = orderNo;
    if (!L.length) {
      $('#slipBody').innerHTML = `<div class="slip__empty">
        <svg viewBox="0 0 80 80" aria-hidden="true"><rect x="10" y="26" width="60" height="44" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M10 26l10-14h40l10 14M30 40h20" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>
        <b>Tu pedido está vacío</b><p>Agrega productos del catálogo y aquí verás el total en tiempo real.</p>
        <button class="btn btn--primary" type="button" data-act="shop">Ver productos</button></div>`;
      return;
    }
    const keep = $('#slipBody').scrollTop;
    $('#slipBody').innerHTML = L.map(({ it, q }) => `
      <div class="line" data-i="${it.i}">
        ${it.img ? `<img src="img/${it.img}" alt="" width="68" height="68">` : '<div class="line__ph"></div>'}
        <div><p class="line__t">${esc(it.title)}</p>
          <p class="line__c">${esc(it.cod)}${it.spec ? ' · ' + esc(it.spec) : ''}</p></div>
        <div class="line__r">
          ${stepper(it, q)}
          <div class="line__sum">${money(it.precio * q)}<small>${q} × ${money(it.precio)}</small></div>
          <button class="line__x" type="button" data-act="del" aria-label="Quitar del pedido"><svg><use href="#i-x"/></svg></button>
        </div>
      </div>`).join('');
    $('#slipBody').scrollTop = keep;
    $('#totLines').textContent = L.length + ' (' + num(L.reduce((s, l) => s + l.q, 0)) + ' uds.)';
    $('#totMoney').textContent = money(total());
  }
  let lastFocus = null;
  function openCart() {
    lastFocus = document.activeElement;
    $('#slip').classList.add('open'); $('#slip').setAttribute('aria-hidden', 'false');
    $('#scrim').hidden = false; document.body.classList.add('locked');
    renderSlip(); setTimeout(() => $('#slip').focus(), 30);
  }
  function closeCart() {
    $('#slip').classList.remove('open'); $('#slip').setAttribute('aria-hidden', 'true');
    $('#scrim').hidden = true; document.body.classList.remove('locked');
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  /* ---------- WhatsApp ---------- */
  function buildMessage() {
    const L = lines(), name = $('#cName').value.trim(), note = $('#cNote').value.trim();
    const out = [`*PEDIDO · ${CFG.negocio || 'Corporación Norte'}*`, `Nota ${orderNo}`];
    if (name) out.push(`Cliente: ${name}`);
    out.push('');
    L.forEach(({ it, q }, k) => {
      out.push(`${k + 1}) ${it.title}${it.spec ? ' — ' + it.spec : ''}`);
      out.push(`    Cód. ${it.cod} · ${q} ${plural(it.unit, q)} × ${money(it.precio)} = *${money(it.precio * q)}*`);
    });
    out.push('', `*TOTAL: ${money(total())}*  (${L.length} ${L.length === 1 ? 'producto' : 'productos'})`);
    if (note) out.push('', `Notas: ${note}`);
    out.push('', 'Quedo atento para confirmar disponibilidad, pago y entrega. ¡Gracias!');
    return out.join('\n');
  }
  function sendWhatsApp() {
    if (!Object.keys(cart).length) return;
    const phone = String(CFG.whatsapp || '').replace(/\D/g, '');
    const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
    let msg = buildMessage();
    if (encodeURIComponent(msg).length > 6500) {
      // pedido muy largo: va al portapapeles y se abre el chat con un aviso corto
      copyText(msg).then(() => toast('Pedido largo: lo copiamos. Pégalo en el chat de WhatsApp.'));
      msg = `Hola, te envío mi pedido ${orderNo} (${Object.keys(cart).length} productos, total ${money(total())}). Lo pego a continuación:`;
    }
    window.open(`${base}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).catch(() => legacyCopy(t));
    return Promise.resolve(legacyCopy(t));
  }
  function legacyCopy(t) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { } ta.remove();
  }
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }
  function bumpCart() { const b = $('#openCart'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }

  /* ---------- menú de pasillos ---------- */
  const mega = $('#mega'), megaBtn = $('#megaBtn');
  function closeMega() { mega.hidden = true; megaBtn.setAttribute('aria-expanded', 'false'); }
  megaBtn.addEventListener('click', e => { e.stopPropagation(); const open = mega.hidden; mega.hidden = !open; megaBtn.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', e => { if (!mega.hidden && !e.target.closest('#mega') && !e.target.closest('#megaBtn')) closeMega(); });

  /* ---------- sugerencias de búsqueda ---------- */
  let sugIdx = -1;
  function suggest() {
    const toks = norm($('#q').value).split(/\s+/).filter(Boolean), box = $('#suggest');
    if ($('#q').value.trim().length < 2) { box.hidden = true; return; }
    const cat = +$('#qCat').value;
    const m = []; for (const it of ITEMS) { if ((cat < 0 || it.cat === cat) && toks.every(t => it.hay.includes(t))) { m.push(it); if (m.length === 6) break; } }
    if (!m.length) { box.hidden = true; return; }
    sugIdx = -1;
    box.innerHTML = m.map(it => `<button type="button" data-sug="${esc(it.title)}">${esc(it.title)}<small>${esc(D.cats[it.cat])}</small></button>`).join('');
    box.hidden = false;
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', e => {
    const home = e.target.closest('[data-home]'); if (home) { e.preventDefault(); goHome(); return; }
        const btn = e.target.closest('[data-act]'); if (!btn) return;
    const host = btn.closest('[data-i]');
    const it = host ? ITEMS[+host.dataset.i] : null;
    switch (btn.dataset.act) {
      case 'add': setQty(it.cod, it.min); bumpCart(); toast(`Agregado · ${it.title} ×${it.min}`); break;
      case 'inc': setQty(it.cod, (cart[it.cod] || 0) + 1); break;
      case 'dec': setQty(it.cod, (cart[it.cod] || 0) - 1); break;
      case 'del': setQty(it.cod, 0); break;
      case 'shop': closeCart(); if (document.body.classList.contains('is-product')) go('#/catalogo'); else goResults(); break;
    }
  });
  document.addEventListener('change', e => {
    if (!e.target.classList.contains('qty')) return;
    const it = ITEMS[+e.target.closest('[data-i]').dataset.i];
    setQty(it.cod, e.target.value);
  });
  $('#openCart').addEventListener('click', openCart);
  $('#dock').addEventListener('click', openCart);
  $('#sideCart').addEventListener('click', openCart);
  $('#closeCart').addEventListener('click', closeCart);
  $('#scrim').addEventListener('click', closeCart);
  $('#sendWa').addEventListener('click', sendWhatsApp);
  $('#copyOrder').addEventListener('click', () => copyText(buildMessage()).then(() => toast('Pedido copiado')));
  $('#clearCart').addEventListener('click', () => {
    if (!confirm('¿Vaciar todo el pedido?')) return;
    const keys = Object.keys(cart); cart = {}; saveCart(); keys.forEach(syncCart); syncCart(); renderSlip();
  });
  const savedCli = store.get('norte_cliente', null);
  if (savedCli) { $('#cName').value = savedCli.n || ''; $('#cNote').value = savedCli.t || ''; }
  ['cName', 'cNote'].forEach(id => $('#' + id).addEventListener('input', () => store.set('norte_cliente', { n: $('#cName').value, t: $('#cNote').value })));

  // búsqueda
  $('#finder').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('#q').value.trim(), c = +$('#qCat').value;
    $('#suggest').hidden = true; $('#q').blur();
    if (!q && c < 0) { goHome(); return; }
    go(!q ? '#/c/' + CATSLUG[c] : '#/buscar/' + encodeURIComponent(q) + (c >= 0 ? '?c=' + CATSLUG[c] : ''));
  });
  let sT; $('#q').addEventListener('input', () => { clearTimeout(sT); sT = setTimeout(suggest, 120); });
  $('#q').addEventListener('keydown', e => {
    const box = $('#suggest'); if (box.hidden) return;
    const items = $$('button', box); if (!items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((b, k) => b.classList.toggle('on', k === sugIdx));
      $('#q').value = items[sugIdx].dataset.sug;
    }
  });
  $('#suggest').addEventListener('mousedown', e => {
    const b = e.target.closest('[data-sug]'); if (!b) return; e.preventDefault();
    $('#q').value = b.dataset.sug; $('#suggest').hidden = true; $('#finder').requestSubmit();
  });
  document.addEventListener('click', e => { if (!e.target.closest('#finder')) $('#suggest').hidden = true; });
  addEventListener('keydown', e => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); $('#q').focus(); }
    if (e.key === 'Escape') { if ($('#slip').classList.contains('open')) closeCart(); else { closeFilters(); closeMega(); $('#suggest').hidden = true; } }
  });

  // filtros
  $('#catList').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const c = +b.dataset.c; closeFilters(); go(c < 0 ? '#/catalogo' : '#/c/' + CATSLUG[c]); });
  $('#fMarca').addEventListener('change', e => { S.marca = +e.target.value; applyFilters(); });
  $('#sort').addEventListener('change', e => { S.sort = e.target.value; applyFilters(); });
  $('#fNuevo').addEventListener('change', e => { S.nuevo = e.target.checked; applyFilters(); });
  const price = () => { const a = parseFloat($('#pMin').value), b = parseFloat($('#pMax').value); S.pmin = isNaN(a) ? null : a; S.pmax = isNaN(b) ? null : b; applyFilters(); };
  let pT; ['pMin', 'pMax'].forEach(id => $('#' + id).addEventListener('input', () => { clearTimeout(pT); pT = setTimeout(price, 250); }));
  $('#clearAll').addEventListener('click', () => { const c = S.cat; resetFilters(); S.cat = c; applyFilters(); });
  $('#emptyClear').addEventListener('click', goHome);
  $('#chips').addEventListener('click', e => {
    const c = e.target.closest('[data-chip]'); if (!c) return;
    const k = c.dataset.chip;
    if (k === 'q') { S.q = ''; $('#q').value = ''; }
    if (k === 'marca') { S.marca = -1; $('#fMarca').value = '-1'; }
    if (k === 'precio') { S.pmin = S.pmax = null; $('#pMin').value = $('#pMax').value = ''; }
    if (k === 'nuevo') { S.nuevo = false; $('#fNuevo').checked = false; }
    applyFilters();
  });
  const openFilters = () => { $('#filters').classList.add('open'); document.body.classList.add('sheet'); };
  function closeFilters() { $('#filters').classList.remove('open'); document.body.classList.remove('sheet'); }
  $('#openFilters').addEventListener('click', openFilters);
  $('#closeFilters').addEventListener('click', closeFilters);
  $('#applyFilters').addEventListener('click', () => { closeFilters(); goResults(); });
  document.addEventListener('click', e => { if (document.body.classList.contains('sheet') && !e.target.closest('#filters') && !e.target.closest('#openFilters')) closeFilters(); });
  $('#vGrid').addEventListener('click', () => setView('grid'));
  $('#vList').addEventListener('click', () => setView('list'));

  // cargar más (botón + scroll infinito)
  $('#moreBtn').addEventListener('click', renderMore);
  new IntersectionObserver(es => { if (es[0].isIntersecting && S.shown < S.list.length) renderMore(); }, { rootMargin: '900px' }).observe($('#more'));

  /* ============ construcción de la portada ============ */
  const byCount = D.cats.map((c, k) => k).sort((a, b) => catCount[b] - catCount[a]);

  // selectores y listas de pasillos
  $('#qCat').insertAdjacentHTML('beforeend', D.cats.map((c, k) => `<option value="${k}">${esc(c)}</option>`).join(''));
  $('#catList').innerHTML = `<li><button type="button" data-c="-1" aria-pressed="true">Todos <span></span></button></li>` +
    D.cats.map((c, k) => `<li><button type="button" data-c="${k}" aria-pressed="false">${esc(c)} <span></span></button></li>`).join('');
  $('#fMarca').insertAdjacentHTML('beforeend', D.marcas.map((m, k) => `<option value="${k}">${esc(m)}</option>`).join(''));
  $('#megaGrid').innerHTML = D.cats.map((c, k) => `<a href="#/c/${CATSLUG[k]}">${esc(c)} <span>${num(catCount[k])}</span></a>`).join('');
  $('#footCats').innerHTML = byCount.slice(0, 12).map(k => `<li><a href="#/c/${CATSLUG[k]}">${esc(D.cats[k])}</a></li>`).join('');
  const chevron = '<svg aria-hidden="true"><use href="#i-chev"/></svg>';
  $('#heroCats').innerHTML = byCount.slice(0, 11).map(k => `<li><a href="#/c/${CATSLUG[k]}">${esc(D.cats[k])} ${chevron}</a></li>`).join('') +
    `<li class="cats__all"><a href="#" id="heroAllCats">Ver todos los pasillos ${chevron}</a></li>`;
  $('#heroAllCats').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); scrollTo({ top: 0, behavior: 'smooth' }); mega.hidden = false; megaBtn.setAttribute('aria-expanded', 'true'); });
  $('#navLinks').innerHTML = `<a href="#/novedades" id="navNuevos" class="hot">Novedades</a>` +
    byCount.slice(0, 9).map(k => `<a href="#/c/${CATSLUG[k]}">${esc(D.cats[k])}</a>`).join('');
  
  // estadísticas
  const stat = { items: ITEMS.length, cats: D.cats.length, marcas: D.marcas.length };
  $$('[data-stat]').forEach(el => el.textContent = num(stat[el.dataset.stat]));
  $('#yr').textContent = new Date().getFullYear();

  // carrusel
  const nuevos = withImg(ITEMS.filter(it => it.nuevo));
  const spread = (list, n) => { const out = [], step = Math.max(1, Math.floor(list.length / n)); for (let k = 0; k < list.length && out.length < n; k += step) out.push(list[k]); return out; };
  const kPlom = catByName('Plomer'), kHM = catByName('Herramientas manuales');
  const imgs3 = arr => arr.slice(0, 3).map(it => `<img src="img/${it.img}" alt="" width="320" height="320">`).join('');
  const heroPick = ['Z-1203-20', 'YSP218', 'EBT203'].map(c => BYCOD.get(c)).filter(it => it && it.img);
  const slides = [
    { cls: 'a', k: 'Catálogo completo', h: 'Todo para tu obra, al mayor', p: `${num(ITEMS.length)} productos en ${D.cats.length} pasillos. Arma tu pedido y ciérralo por WhatsApp.`, cta: 'Ver todos los productos', go: () => go('#/catalogo'), imgs: imgs3(heroPick.length === 3 ? heroPick : withImg(spread(withImg(ITEMS), 3))) },
    nuevos.length >= 3 && { cls: 'b', k: 'Recién llegados', h: 'Novedades del catálogo', p: `${num(ITEMS.filter(i => i.nuevo).length)} productos nuevos para surtir tu negocio.`, cta: 'Ver novedades', go: showNuevos, imgs: imgs3(spread(nuevos, 3)) },
    kPlom >= 0 && { cls: 'c', k: 'El pasillo más grande', h: D.cats[kPlom], p: `${num(catCount[kPlom])} productos: grifería, tuberías, sanitarios y más.`, cta: 'Ver el pasillo', go: () => showCat(kPlom), imgs: imgs3(spread(withImg(ITEMS.filter(i => i.cat === kPlom)), 3)) }
  ].filter(Boolean);
  $('#slides').innerHTML = slides.map((s, k) => `<div class="slide slide--${s.cls}" role="group" aria-roledescription="diapositiva" aria-label="${k + 1} de ${slides.length}">
      <div><span class="slide__k">${esc(s.k)}</span><h2>${esc(s.h)}</h2><p>${esc(s.p)}</p><button class="btn" type="button" data-slide="${k}">${esc(s.cta)}</button></div>
      <div class="slide__imgs" aria-hidden="true">${s.imgs}</div></div>`).join('');
  $('#slDots').innerHTML = slides.map((s, k) => `<button type="button" aria-label="Ir a la diapositiva ${k + 1}" data-dot="${k}"></button>`).join('');
  $('#slides').addEventListener('click', e => { const b = e.target.closest('[data-slide]'); if (b) slides[+b.dataset.slide].go(); });
  let cur = 0, auto;
  function slide(to) {
    cur = (to + slides.length) % slides.length;
    $('#slides').style.transform = `translateX(-${cur * 100}%)`;
    $$('#slDots button').forEach((b, k) => b.setAttribute('aria-current', String(k === cur)));
  }
  const play = () => { stop(); if (!matchMedia('(prefers-reduced-motion:reduce)').matches) auto = setInterval(() => slide(cur + 1), 6000); };
  const stop = () => clearInterval(auto);
  $('#slPrev').addEventListener('click', () => { slide(cur - 1); play(); });
  $('#slNext').addEventListener('click', () => { slide(cur + 1); play(); });
  $('#slDots').addEventListener('click', e => { const b = e.target.closest('[data-dot]'); if (b) { slide(+b.dataset.dot); play(); } });
  $('#slider').addEventListener('mouseenter', stop); $('#slider').addEventListener('mouseleave', play);
  $('#slider').addEventListener('focusin', stop); $('#slider').addEventListener('focusout', play);
  slide(0); play();

  // novedades
  if (nuevos.length >= 4) {
    $('#novRow').innerHTML = nuevos.slice(0, 24).map(card).join('');
        const row = $('#novRow');
    $('#novP').addEventListener('click', () => row.scrollBy({ left: -row.clientWidth * .8, behavior: 'smooth' }));
    $('#novN').addEventListener('click', () => row.scrollBy({ left: row.clientWidth * .8, behavior: 'smooth' }));
  } else $('#novedades').hidden = true;

  // pisos por pasillo
  const floorDefs = [
    ['Plomer', '#0f3a5a', '#1b6c9c'], ['Herramientas manuales', '#8a2d00', '#e5560b'], ['Herramientas el', '#222226', '#4b4b55'],
    ['Electricidad', '#5a3a00', '#c98400'], ['Iluminaci', '#3b2d6b', '#6a54c4'], ['Construcci', '#1f4d2f', '#3d8a58'],
    ['Cerrajer', '#5a1f2b', '#a33448'], ['Pintura', '#0f4d4d', '#1f8f8f']
  ];
  $('#floors').innerHTML = floorDefs.map(([n, c1, c2]) => {
    const k = catByName(n); if (k < 0) return '';
    const pool = withImg(ITEMS.filter(it => it.cat === k)); if (pool.length < 4) return '';
    const items = spread(pool, 8), promo = pool[Math.floor(pool.length / 3)];
    return `<section class="floor" aria-label="${esc(D.cats[k])}">
      <header class="blk-h"><h2>${esc(D.cats[k])}</h2><a href="#/c/${CATSLUG[k]}" class="blk-h__more">Ver todo ${chevron}</a></header>
      <div class="floor__body">
        <a href="#/c/${CATSLUG[k]}" class="floor__promo" style="--c1:${c1};--c2:${c2}">
          <div><small>${num(catCount[k])} productos</small><h3>${esc(D.cats[k])}</h3><p>Todo el pasillo, con venta mínima en cada producto.</p></div>
          <img src="img/${promo.img}" alt="" loading="lazy" width="150" height="150">
          <span class="btn">Entrar al pasillo</span>
        </a>
        <div class="floor__items">${items.map(card).join('')}</div>
      </div></section>`;
  }).join('');


  /* ============ pasillos como secciones ============ */
  const GRADS = [['#0f3a5a', '#1b6c9c'], ['#8a2d00', '#e5560b'], ['#222226', '#4b4b55'], ['#5a3a00', '#c98400'], ['#3b2d6b', '#6a54c4'], ['#1f4d2f', '#3d8a58'], ['#5a1f2b', '#a33448'], ['#0f4d4d', '#1f8f8f']];
  function renderCatHead(on) {
    const box = $('#catHead'); box.hidden = !on; if (!on) { box.innerHTML = ''; return; }
    const k = S.cat, [c1, c2] = GRADS[k % GRADS.length];
    const inCat = ITEMS.filter(it => it.cat === k), bc = {};
    inCat.forEach(it => { if (it.mk >= 0) bc[it.mk] = (bc[it.mk] || 0) + 1; });
    const top = Object.entries(bc).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const pics = withImg(inCat); const sp = spread(pics, 3);
    box.innerHTML = `<div class="cathead" style="--c1:${c1};--c2:${c2}">
      <div class="cathead__t"><small>Pasillo ${String(k + 1).padStart(2, '0')}</small><h1>${esc(D.cats[k])}</h1>
        <p>${num(inCat.length)} productos · ${num(Object.keys(bc).length)} marcas</p></div>
      <div class="cathead__img" aria-hidden="true">${sp.map(it => `<img src="img/${it.img}" alt="" width="320" height="320">`).join('')}</div>
      ${top.length > 1 ? `<div class="cathead__brands"><span>Marcas</span>
        <button type="button" data-bm="-1" aria-pressed="${S.marca < 0}">Todas</button>
        ${top.map(([m, n]) => `<button type="button" data-bm="${m}" aria-pressed="${S.marca === +m}">${esc(D.marcas[m])} <i>${n}</i></button>`).join('')}</div>` : ''}
    </div>`;
  }
  $('#catHead').addEventListener('click', e => {
    const b = e.target.closest('[data-bm]'); if (!b) return;
    S.marca = +b.dataset.bm; $('#fMarca').value = String(S.marca); applyFilters();
  });
  // mosaico "explora por pasillo"
  $('#aisleGrid').innerHTML = D.cats.map((c, k) => {
    const pool = withImg(ITEMS.filter(it => it.cat === k)), p = pool[Math.floor(pool.length / 2)];
    return `<a class="atile" href="#/c/${CATSLUG[k]}"><span class="atile__ph">${p ? `<img src="img/${p.img}" alt="" loading="lazy" width="320" height="320">` : ''}</span>
      <b>${esc(c)}</b><small>${num(catCount[k])} productos</small></a>`;
  }).join('');

  /* ============ ficha de producto ============ */
  function askWhatsApp(it) {
    const phone = String(CFG.whatsapp || '').replace(/\D/g, '');
    const msg = `Hola, quiero consultar por este producto:\n*${it.title}*${it.spec ? ' — ' + it.spec : ''}\nCód. ${it.cod} · ${money(it.precio)} por ${it.unit}\n¿Tienen disponibilidad?`;
    window.open(`${phone ? 'https://wa.me/' + phone : 'https://wa.me/'}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  }
  function showProduct(cod) {
    const it = BYCOD.get(cod); if (!it) { go('#/'); return; }
    document.body.classList.remove('is-search'); document.body.classList.add('is-product');
    const specs = it.spec ? it.spec.split(' · ') : [];
    const rel = ITEMS.filter(o => o.cat === it.cat && o.i !== it.i && o.img).sort((a, b) => Math.abs(a.i - it.i) - Math.abs(b.i - it.i)).slice(0, 8);
    const row = (k, v) => v ? `<tr><th scope="row">${k}</th><td>${v}</td></tr>` : '';
    const box = $('#product'); box.hidden = false;
    box.setAttribute('data-i', it.i);
    box.innerHTML = `
      <nav class="crumb" aria-label="Ruta"><a href="#/" data-home>Inicio</a>${chevron}<a href="#/c/${CATSLUG[it.cat]}">${esc(D.cats[it.cat])}</a>${chevron}<b>${esc(it.title)}</b></nav>
      <div class="pv">
        <div class="pv__gal"><div class="pv__ph${it.img ? '' : ' nophoto'}">${it.img ? `<img src="img/${it.img}" alt="${esc(it.title)}" width="320" height="320">` : ''}${it.nuevo ? '<span class="card__new">NUEVO</span>' : ''}</div></div>
        <div class="pv__info">
          ${it.marca ? `<p class="pv__brand">${esc(it.marca)}</p>` : ''}
          <h1>${esc(it.title)}</h1>
          ${it.spec ? `<p class="pv__spec">${esc(it.spec)}</p>` : ''}
          <p class="pv__cod">Código <b>${esc(it.cod)}</b></p>
          <div class="pv__price">${money(it.precio)}<small>por ${esc(it.unit)}</small></div>
          <ul class="pv__facts">
            <li><svg aria-hidden="true"><use href="#i-box"/></svg> Pedido mínimo: <b>${it.min} ${esc(plural(it.unit, it.min))}</b></li>
            <li><svg aria-hidden="true"><use href="#i-wa"/></svg> Disponibilidad y entrega se confirman por WhatsApp</li>
          </ul>
        </div>
        <aside class="pv__buy">
          <p class="pv__buyt">Agrega al pedido</p>
          <div class="ctl">${buyControls(it)}</div>
          <button class="btn btn--line btn--block" type="button" id="askWa"><svg aria-hidden="true"><use href="#i-wa"/></svg> Consultar este producto</button>
          <button class="link" type="button" data-act="shop-open">Ver mi pedido</button>
        </aside>
      </div>
      <section class="ptabs">
        <div class="ptabs__bar" role="tablist" aria-label="Información del producto">
          <button role="tab" id="t1" aria-selected="true" aria-controls="tp1" data-tab="1">Información</button>
          <button role="tab" id="t2" aria-selected="false" aria-controls="tp2" data-tab="2" tabindex="-1">Especificaciones</button>
          <button role="tab" id="t3" aria-selected="false" aria-controls="tp3" data-tab="3" tabindex="-1">Condiciones de pedido</button>
        </div>
        <div class="ptabs__p" id="tp1" role="tabpanel" aria-labelledby="t1">
          <table class="ptable"><tbody>
            ${row('Producto', esc(it.title))}${row('Código', esc(it.cod))}${row('Marca', esc(it.marca))}
            ${row('Pasillo', `<a href="#/c/${CATSLUG[it.cat]}">${esc(D.cats[it.cat])}</a>`)}
            ${row('Unidad de venta', esc(it.unit))}${row('Pedido mínimo', `${it.min} ${esc(plural(it.unit, it.min))}`)}
            ${row('Precio por ' + esc(it.unit), money(it.precio))}${row('Estado', it.nuevo ? 'Novedad del catálogo' : 'Catálogo vigente')}
          </tbody></table>
        </div>
        <div class="ptabs__p" id="tp2" role="tabpanel" aria-labelledby="t2" hidden>
          ${specs.length ? `<table class="ptable"><tbody>${specs.map((v, k) => row(k === 0 && specs.length === 1 ? 'Detalle' : 'Detalle ' + (k + 1), esc(v))).join('')}</tbody></table>`
            : '<p class="ptabs__none">Este producto no tiene especificaciones adicionales en el catálogo. Si necesitas más detalles, consúltalo por WhatsApp.</p>'}
        </div>
        <div class="ptabs__p" id="tp3" role="tabpanel" aria-labelledby="t3" hidden>
          <ul class="ptabs__list">
            <li>El precio de <b>${money(it.precio)}</b> es por ${esc(it.unit)}.</li>
            <li>La cantidad mínima de venta es <b>${it.min} ${esc(plural(it.unit, it.min))}</b>.</li>
            <li>Precios en dólares ($) según el catálogo vigente.</li>
            <li>El pedido se cierra por WhatsApp; ahí se confirman disponibilidad, pago y entrega.</li>
          </ul>
        </div>
      </section>
      ${rel.length ? `<section class="related"><header class="blk-h"><h2>Más de ${esc(D.cats[it.cat])}</h2><a class="blk-h__more" href="#/c/${CATSLUG[it.cat]}">Ver todo ${chevron}</a></header><div class="related__row">${rel.map(card).join('')}</div></section>` : ''}`;
    document.title = `${it.title} — Corporación Norte`;
  }
  $('#product').addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t) { $$('[data-tab]', $('#product')).forEach(b => { const on = b === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $('#tp' + b.dataset.tab).hidden = !on; }); return; }
    if (e.target.closest('#askWa')) askWhatsApp(ITEMS[+$('#product').dataset.i]);
    if (e.target.closest('[data-act="shop-open"]')) openCart();
  });

  /* ============ rutas ============ */
  const BASE_TITLE = document.title;
  function route() {
    closeMega(); closeFilters();
    const raw = location.hash.replace(/^#\/?/, ''), [path, query = ''] = raw.split('?');
    const seg = path.split('/').map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } });
    document.body.classList.remove('is-product'); $('#product').hidden = true;
    resetFilters(); S.browse = false;
    document.title = BASE_TITLE;
    if (seg[0] === 'p') { scrollTo(0, 0); showProduct(seg.slice(1).join('/')); return; }
    if (seg[0] === 'c') { const k = CATSLUG.indexOf(seg[1]); if (k >= 0) S.cat = k; else S.browse = true; }
    else if (seg[0] === 'buscar') { S.q = seg[1] || ''; const m = /c=([^&]+)/.exec(query); if (m) S.cat = CATSLUG.indexOf(m[1]); S.browse = !S.q; }
    else if (seg[0] === 'novedades') S.nuevo = true;
    else if (seg[0] === 'catalogo') S.browse = true;
    applyFilters();
    if (S.cat >= 0 && !S.q) document.title = `${D.cats[S.cat]} — Corporación Norte`;
    else if (S.q) document.title = `${S.q} — Corporación Norte`;
    scrollTo(0, 0);
  }

  if (matchMedia('(max-width:760px)').matches) $('#q').placeholder = 'Buscar productos';

  setView(S.view);
  addEventListener('hashchange', route);
  route();
  syncCart();
})();
