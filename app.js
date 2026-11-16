'use strict';

/* Ganga v1 — Fase 0. Sin dependencias. Datos en deals.json.
   Puntos SOLO por entrar, votar, racha y compartir. NUNCA por clic en link de afiliado ni por comprar. */

var LS_KEY = 'ganga_puntos_v1';
var LEVELS_ASC = [
  { min: 0, name: 'NPC' },
  { min: 1000, name: 'FREE' },
  { min: 2500, name: 'TRY' },
  { min: 5000, name: 'MC' },
  { min: 10000, name: 'GOAT' },
  { min: 100000, name: 'BOSS' }
];
var ALL_CATS = ['Herramientas', 'Trabajo', 'Casa', 'Tecnología', 'Cocina', 'Cuidado personal'];
var CHEST_PRIZES = [5, 5, 10, 10, 10, 15, 15, 20, 25];

function defaults() {
  return {
    points: 0, streak: 0, lastCheckin: null, streakBonusGivenFor: null,
    voted: {}, worked: {}, reported: {}, visitDay: null, chestDay: null, sharedKeys: {}, alertCats: []
  };
}

function loadState() {
  var s = defaults();
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.points === 'number') {
        for (var k in s) { if (parsed[k] !== undefined) s[k] = parsed[k]; }
      }
    }
  } catch (e) { /* almacenamiento no disponible */ }
  return s;
}

function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { /* sin persistencia */ }
}

var state = loadState();
var DEALS = [];

function todayStr(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function levelInfo(points) {
  var cur = LEVELS_ASC[0], next = null;
  for (var i = 0; i < LEVELS_ASC.length; i++) {
    if (points >= LEVELS_ASC[i].min) { cur = LEVELS_ASC[i]; next = LEVELS_ASC[i + 1] || null; }
  }
  return { cur: cur, next: next };
}

function money(n) { return '$' + Number(n).toFixed(2); }

function offPct(deal) {
  var base = Number(deal.precioNormalReal) || 0;
  var price = Number(deal.precio) || 0;
  if (base > price && base > 0) return Math.round((1 - price / base) * 100);
  return 0;
}

function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function statusBadge(deal) {
  if (deal.estado === 'ejemplo') return 'EJEMPLO · POR VERIFICAR';
  if (deal.estado === 'vivo') return 'VERIFICADA';
  if (deal.estado === 'expirado') return 'EXPIRADA';
  return 'POR VERIFICAR';
}

function verifiedLine(deal) {
  if (deal.verificado) return '✅ Verificado: ' + deal.verificado;
  return '🕐 Sin verificar todavía — no cuenta como oferta viva hasta probarla.';
}

/* Sistema anti-expirados (regla de Dereck, 21:11 PT): con 2 reportes de «ya no funciona»
   la oferta entra en cuarentena: se marca y se oculta de la portada hasta re-probarla. */
function reportCount(deal) {
  return (Number(deal.reportes) || 0) + (state.reported[deal.id] ? 1 : 0);
}
function isQuarantined(deal) { return reportCount(deal) >= 2; }

function reportRow(deal) {
  var wrap = el('div', 'report-row');
  var btn = el('button', 'report-btn', state.reported[deal.id] ? '🚫 Ya reportaste que no funciona' : '🚫 Ya no funciona');
  btn.type = 'button';
  btn.disabled = !!state.reported[deal.id];
  btn.addEventListener('click', function (ev) {
    if (ev) ev.stopPropagation();
    if (state.reported[deal.id]) return;
    state.reported[deal.id] = true;
    saveState(state);
    renderDeals(DEALS);
    renderCodes(DEALS);
    renderAlerts(DEALS);
    renderPoints(isQuarantined(deal)
      ? '🧪 Con este reporte la oferta entró en CUARENTENA: se oculta hasta re-probarla. Gracias por cuidar la casa.'
      : '🚫 Reporte registrado. Con 2 reportes de la comunidad, esta oferta se oculta sola a revisión (cuarentena) hasta re-probarla.');
  });
  wrap.appendChild(btn);
  var n = reportCount(deal);
  wrap.appendChild(el('span', 'report-count', 'Reportes de «ya no funciona»: ' + n + ' (con 2 entra en cuarentena)'));
  if (state.reported[deal.id] || isQuarantined(deal)) {
    wrap.appendChild(el('p', 'report-note', isQuarantined(deal)
      ? '🧪 EN CUARENTENA: esta oferta fue reportada como muerta. Queda marcada y fuera de la portada hasta que pase una re-prueba en el carrito.'
      : 'Tu reporte quedó guardado en este aparato y cuenta para la cuarentena. Sin puntos por reportar: reportar es cuidar, no jugar.'));
  }
  return wrap;
}

function expiryLine(deal) {
  if (deal.expira) return '⏳ Expira: ' + deal.expira + ' (dato real de la tienda).';
  return '⏳ Vigencia por verificar — no inventamos horas de expiración.';
}

function renderPoints(msg) {
  document.getElementById('pointsTotal').textContent = String(state.points);
  var info = levelInfo(state.points);
  document.getElementById('pointsLevel').textContent = info.cur.name;
  document.getElementById('streakCount').textContent = String(state.streak);
  document.getElementById('pointsPill').textContent = '✨ ' + state.points + ' pts · ' + info.cur.name;
  document.getElementById('streakPill').textContent = '🔥 Racha: ' + state.streak + ' días';
  var fill = document.getElementById('levelProgressFill');
  var txt = document.getElementById('levelProgressText');
  if (info.next) {
    var span = info.next.min - info.cur.min;
    var done = state.points - info.cur.min;
    fill.style.width = Math.min(100, Math.round(done / span * 100)) + '%';
    txt.textContent = 'Te faltan ' + (info.next.min - state.points) + ' puntos para subir a ' + info.next.name + ' 👀';
  } else {
    fill.style.width = '100%';
    txt.textContent = 'Estás en el nivel máximo: BOSS 👑';
  }
  document.getElementById('checkinBtn').disabled = (state.lastCheckin === todayStr());
  var chestBtn = document.getElementById('chestBtn');
  var chestDone = (state.chestDay === todayStr());
  chestBtn.disabled = chestDone;
  chestBtn.textContent = chestDone ? 'Cofre de hoy ya abierto ✓' : 'Abrir el cofre de hoy';
  var alertBox = document.getElementById('streakAlert');
  var showAlert = state.streak > 0 && state.lastCheckin !== todayStr();
  alertBox.hidden = !showAlert;
  if (showAlert) document.getElementById('streakAlertDays').textContent = state.streak + ' días';
  if (msg) document.getElementById('pointsMsg').textContent = msg;
}

function addPoints(n) {
  state.points += n;
  saveState(state);
  renderPoints();
}

/* Entrada diaria automática: +10 la primera visita de cada día. */
(function dailyVisit() {
  var t = todayStr();
  if (state.visitDay !== t) {
    state.visitDay = t;
    state.points += 10;
    saveState(state);
  }
})();

function doCheckin() {
  var t = todayStr();
  if (state.lastCheckin === t) { renderPoints('Ya marcaste tu entrada de hoy ✅'); return; }
  var y = new Date();
  y.setDate(y.getDate() - 1);
  state.streak = (state.lastCheckin === todayStr(y)) ? state.streak + 1 : 1;
  state.lastCheckin = t;
  var msg = '¡Entrada marcada! Racha de ' + state.streak + ' día(s) 🔥';
  if (state.streak >= 7 && state.streakBonusGivenFor !== t) {
    state.streakBonusGivenFor = t;
    state.points += 75;
    msg += ' Bono de racha: +75 puntos ✨';
  }
  saveState(state);
  renderPoints(msg);
}

function openChest() {
  var t = todayStr();
  if (state.chestDay === t) return;
  var prize = CHEST_PRIZES[Math.floor(Math.random() * CHEST_PRIZES.length)];
  state.chestDay = t;
  state.points += prize;
  saveState(state);
  document.getElementById('chestMsg').textContent = '🎁 ¡El cofre traía +' + prize + ' puntos! Vuelve mañana por el siguiente.';
  renderPoints();
}

function renderSurprise(deals) {
  if (!deals.length) return;
  var now = new Date();
  var dayIndex = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  var deal = deals[dayIndex % deals.length];
  document.getElementById('surpriseTitle').textContent = (deal.icono || '🎁') + ' ' + deal.titulo + ' — ' + money(deal.precio);
  document.getElementById('surpriseText').textContent =
    'Elegida hoy entre las ofertas cargadas (rota cada día). Sigue marcada como ' + statusBadge(deal).toLowerCase() +
    ': la sorpresa es el descubrimiento, no un precio inventado. Está en la lista de abajo 👇';
  document.getElementById('surpriseCard').hidden = false;
}

function renderDeals(deals) {
  var grid = document.getElementById('dealsGrid');
  grid.innerHTML = '';
  document.getElementById('dealsEmpty').hidden = deals.length > 0;
  /* Las de cuarentena van al final: fuera de la portada, como manda la regla anti-expirados. */
  var ordered = deals.slice().sort(function (a, b) { return (isQuarantined(a) ? 1 : 0) - (isQuarantined(b) ? 1 : 0); });
  ordered.forEach(function (deal) {
    var card = el('article', 'card');
    if (isQuarantined(deal)) card.classList.add('quarantined');
    var photo = el('div', 'photo', deal.icono || '🛍️');
    photo.setAttribute('role', 'img');
    photo.setAttribute('aria-label', 'Espacio de foto del producto (placeholder, sin foto real todavía)');
    card.appendChild(photo);

    var body = el('div', 'card-body');
    var badges = el('div');
    badges.appendChild(el('span', 'badge', statusBadge(deal)));
    badges.appendChild(document.createTextNode(' '));
    badges.appendChild(el('span', 'badge badge-store', (deal.tienda || '') + ' · ' + (deal.categoria || '')));
    body.appendChild(badges);
    if (isQuarantined(deal)) {
      body.appendChild(el('p', 'quarantine-banner', '🧪 EN CUARENTENA — reportada como que ya no funciona. Fuera de la portada hasta re-probarla en el carrito.'));
    }

    body.appendChild(el('h3', null, deal.titulo));

    var pct = offPct(deal);
    var priceRow = el('div', 'price-row');
    priceRow.appendChild(el('span', 'price', money(deal.precio)));
    var normal = el('span', 'normal');
    normal.appendChild(document.createTextNode('Precio normal real: '));
    normal.appendChild(el('s', null, money(deal.precioNormalReal)));
    priceRow.appendChild(normal);
    if (pct > 0) priceRow.appendChild(el('span', 'off', '-' + pct + '%'));
    body.appendChild(priceRow);

    if (deal.precioListaMostrado && Number(deal.precioListaMostrado) !== Number(deal.precioNormalReal)) {
      body.appendChild(el('p', 'notes', 'La fuente mostraba lista de ' + money(deal.precioListaMostrado) + '; nosotros comparamos contra el precio normal real, no contra la lista.'));
    }

    var heat = Math.max(0, Number(deal.calor) || 0);
    var thermo = el('div', 'thermo');
    var track = el('div', 'thermo-track');
    var fill = el('div', 'thermo-fill');
    fill.style.width = Math.min(100, heat / 8) + '%';
    track.appendChild(fill);
    thermo.appendChild(track);
    thermo.appendChild(el('span', 'thermo-num', heat + '°'));
    body.appendChild(thermo);

    /* Prueba social: solo datos reales. Sin dato medido, se dice que el conteo arranca con la comunidad local. */
    var workedLocal = state.worked[deal.id] ? 1 : 0;
    var proof = (deal.aprovecharon != null)
      ? '✅ ' + deal.aprovecharon + ' personas aprovecharon esta oferta (dato medido).'
      : '🌡️ Calor de la captura original: ' + heat + '° · «Sí funcionó» en este aparato: ' + workedLocal + '. Los conteos reales se publican cuando son medidos, nunca inventados.';
    body.appendChild(el('p', 'social-proof', proof));

    if (deal.notas) body.appendChild(el('p', 'notes', deal.notas));
    body.appendChild(el('p', 'verified', verifiedLine(deal)));
    body.appendChild(el('p', 'expiry', expiryLine(deal)));

    var actions = el('div', 'card-actions');
    var vote = el('button', 'vote-btn', '👍 Votar +5');
    vote.type = 'button';
    if (state.voted[deal.id]) { vote.disabled = true; vote.textContent = '👍 Ya votaste'; }
    vote.addEventListener('click', function () {
      if (state.voted[deal.id]) return;
      state.voted[deal.id] = true;
      deal.calor = (Number(deal.calor) || 0) + 1;
      saveState(state);
      addPoints(5);
      renderDeals(DEALS);
      renderPoints('¡Voto registrado! +5 puntos ✨');
    });
    actions.appendChild(vote);

    var worked = el('button', 'vote-btn', '✅ Sí funcionó +5');
    worked.type = 'button';
    if (state.worked[deal.id]) { worked.disabled = true; worked.textContent = '✅ Ya dijiste que funcionó'; }
    worked.addEventListener('click', function () {
      if (state.worked[deal.id]) return;
      state.worked[deal.id] = true;
      saveState(state);
      addPoints(5);
      renderDeals(DEALS);
      renderPoints('¡Gracias! Tu «sí funcionó» ayuda a todos. +5 puntos ✨');
    });
    actions.appendChild(worked);

    if (deal.url) {
      var go = el('a', 'deal-btn', 'Ver oferta en ' + (deal.tienda || 'la tienda') + ' ↗');
      go.href = deal.url;
      go.target = '_blank';
      go.rel = 'noopener sponsored';
      actions.appendChild(go);
    } else {
      actions.appendChild(el('span', 'deal-btn disabled', 'Link de afiliado: pendiente (Fase 0)'));
    }
    body.appendChild(actions);
    body.appendChild(reportRow(deal));
    card.appendChild(body);
    grid.appendChild(card);
  });
}

function shareInvite(deal, box) {
  var key = todayStr() + ':' + deal.id;
  var text = '🔥 Mira esta ganga que encontré en Ganga: ' + deal.titulo + ' a ' + money(deal.precio) +
    (deal.codigo ? ' con el código ' + deal.codigo : '') + ' — ofertas verificadas en español, sin precios inflados.';
  var grant = function () {
    if (!state.sharedKeys[key]) {
      state.sharedKeys[key] = true;
      state.points += 10;
      saveState(state);
      renderPoints('¡Invitación compartida! +10 puntos 📣');
    } else {
      renderPoints('Ya ganaste los puntos por compartir este código hoy; puedes seguir invitando 💪');
    }
    box.querySelector('.share-msg').textContent = '¡Compartido! Así crece la comunidad 🙌';
  };
  if (navigator.share) {
    navigator.share({ title: 'Ganga', text: text }).then(grant, function () { /* cancelado: sin puntos */ });
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(grant, grant);
  } else { grant(); }
}

function renderCodes(deals) {
  var withCodes = deals.filter(function (d) { return d.codigo; });
  var grid = document.getElementById('codesGrid');
  grid.innerHTML = '';
  document.getElementById('codesEmpty').hidden = withCodes.length > 0;
  withCodes.forEach(function (deal) {
    /* article y no <button>: la caja de compartir lleva su propio botón, y un botón dentro de otro es HTML inválido */
    var btn = el('article', 'code-card');
    if (isQuarantined(deal)) btn.classList.add('quarantined');
    btn.appendChild(el('span', 'badge', statusBadge(deal)));
    if (isQuarantined(deal)) {
      btn.appendChild(el('p', 'quarantine-banner', '🧪 EN CUARENTENA — código reportado como muerto. A revisión antes de volver a mostrarse como vivo.'));
    }
    btn.appendChild(el('h3', null, deal.titulo));
    btn.appendChild(el('p', 'notes', money(deal.precio) + ' en ' + (deal.tienda || '') + ' con este código · Toca para ver el código y copiarlo 👇'));
    btn.appendChild(el('p', 'expiry', expiryLine(deal)));
    var reveal = el('div', 'code-reveal');
    reveal.hidden = true;
    reveal.appendChild(el('span', 'code-text', deal.codigo));
    reveal.appendChild(el('span', 'copy-hint', 'Toca de nuevo para copiar 📋'));
    btn.appendChild(reveal);

    var shareBox = el('div', 'share-box');
    shareBox.hidden = true;
    shareBox.appendChild(el('p', null, '🤩 Si este código te sirvió, ESTE es el momento: invita a alguien y ganan los dos. Compartir suma +10 puntos (1 vez al día por código).'));
    var shareBtn = el('button', 'gold-btn', '📣 Compartir e invitar +10');
    shareBtn.type = 'button';
    var shareMsg = el('p', 'share-msg points-msg');
    shareBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      shareInvite(deal, shareBox);
    });
    shareBox.appendChild(shareBtn);
    shareBox.appendChild(shareMsg);
    btn.appendChild(shareBox);
    btn.appendChild(reportRow(deal));

    btn.addEventListener('click', function () {
      if (reveal.hidden) { reveal.hidden = false; return; }
      var done = function () {
        shareBox.hidden = false;
        renderPoints('Código ' + deal.codigo + ' copiado 📋 Pégalo al pagar. Y abajo puedes invitar 👇');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(deal.codigo).then(done, done);
      } else { done(); }
    });
    grid.appendChild(btn);
  });
}

function renderAlertCats() {
  var row = document.getElementById('alertCats');
  row.innerHTML = '';
  ALL_CATS.forEach(function (cat) {
    var chip = el('button', 'chip' + (state.alertCats.indexOf(cat) >= 0 ? ' on' : ''), cat);
    chip.type = 'button';
    chip.addEventListener('click', function () {
      var i = state.alertCats.indexOf(cat);
      if (i >= 0) state.alertCats.splice(i, 1); else state.alertCats.push(cat);
      saveState(state);
      renderAlertCats();
      renderAlerts(DEALS);
    });
    row.appendChild(chip);
  });
}

function renderAlerts(deals) {
  var list = document.getElementById('alertsList');
  list.innerHTML = '';
  var withAlerts = deals.filter(function (d) { return d.alerta; });
  var sorted = withAlerts.slice().sort(function (a, b) {
    var am = state.alertCats.indexOf(a.categoria) >= 0 ? 0 : 1;
    var bm = state.alertCats.indexOf(b.categoria) >= 0 ? 0 : 1;
    return am - bm;
  });
  document.getElementById('alertsEmpty').hidden = sorted.length > 0;
  sorted.forEach(function (deal) {
    var mine = state.alertCats.indexOf(deal.categoria) >= 0;
    var li = el('li', mine ? 'mine' : null);
    li.appendChild(el('div', 'a-title', (mine ? '★ ' : '') + (deal.icono || '🔔') + ' ' + deal.titulo + ' — ' + money(deal.precio)));
    li.appendChild(el('div', 'a-meta', deal.categoria + (mine ? ' · de tus categorías' : '')));
    li.appendChild(el('div', 'a-meta', deal.alerta));
    li.appendChild(el('div', 'a-meta', verifiedLine(deal)));
    li.appendChild(el('div', 'a-meta', expiryLine(deal)));
    if (isQuarantined(deal)) li.appendChild(el('div', 'a-meta', '🧪 En cuarentena — reportada como que ya no funciona, a revisión.'));
    list.appendChild(li);
  });
}

function initTabs() {
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
      var name = tab.getAttribute('data-tab');
      var panel = document.getElementById('panel' + name.charAt(0).toUpperCase() + name.slice(1));
      if (panel) panel.classList.add('active');
    });
  });
}

function initInstall() {
  var deferred = null;
  var btn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  btn.addEventListener('click', function () {
    if (deferred) { deferred.prompt(); deferred = null; btn.hidden = true; }
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* la página funciona igual sin SW */ });
  }
}

document.addEventListener('DOMContentLoaded', function () {
  initTabs();
  initInstall();
  document.getElementById('checkinBtn').addEventListener('click', doCheckin);
  document.getElementById('streakAlertBtn').addEventListener('click', doCheckin);
  document.getElementById('chestBtn').addEventListener('click', openChest);
  renderPoints();
  renderAlertCats();
  fetch('deals.json')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      DEALS = (data && data.deals) || [];
      renderSurprise(DEALS);
      renderDeals(DEALS);
      renderCodes(DEALS);
      renderAlerts(DEALS);
    })
    .catch(function () {
      document.getElementById('dealsEmpty').hidden = false;
      document.getElementById('dealsEmpty').textContent = 'No se pudieron cargar las ofertas (deals.json). Sirve esta carpeta con un servidor local, no con doble clic.';
      document.getElementById('codesEmpty').hidden = false;
      document.getElementById('alertsEmpty').hidden = false;
    });
});
