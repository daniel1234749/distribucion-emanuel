// app.js - Logica principal de la aplicacion Stock & Ventas

(() => {
  /* =====================
     STATE
  ===================== */
  let PRODUCTOS = [];
  let filtered  = [];
  let selected  = new Map();
  let sortCol   = null;
  let sortDir   = 'asc';
  let panelOpen = false;

  var LS_KEY = 'sv_selected_codigos';

  function saveToStorage() {
    try {
      var codigos = Array.from(selected.keys());
      localStorage.setItem(LS_KEY, JSON.stringify(codigos));
    } catch(e) {}
  }

  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch(e) { return []; }
  }

  function restoreFromStorage() {
    var codigos = loadFromStorage();
    if (!codigos.length) return;
    codigos.forEach(function(cod) {
      var p = null;
      for (var i = 0; i < PRODUCTOS.length; i++) {
        if (String(PRODUCTOS[i].codigos) === String(cod)) { p = PRODUCTOS[i]; break; }
      }
      if (p) selected.set(String(cod), p);
    });
  }

  /* =====================
     DOM REFS
  ===================== */
  const searchInput         = document.getElementById('searchInput');
  const clearSearch         = document.getElementById('clearSearch');
  const familiaFilter       = document.getElementById('familiaFilter');
  const stockFilter         = document.getElementById('stockFilter');
  const tableBody           = document.getElementById('tableBody');
  const filterStats         = document.getElementById('filterStats');
  const badgeCount          = document.getElementById('badgeCount');
  const panelBadge          = document.getElementById('panelBadge');
  const selectedPanel       = document.getElementById('selectedPanel');
  const panelBody           = document.getElementById('panelBody');
  const btnVerSeleccionados = document.getElementById('btnVerSeleccionados');
  const btnClosePanel       = document.getElementById('btnClosePanel');
  const btnClearAll         = document.getElementById('btnClearAll');
  const btnPrint            = document.getElementById('btnPrint');
  const lastUpdate          = document.getElementById('lastUpdate');
  const printArea           = document.getElementById('printArea');

  /* =====================
     INIT - carga el JSON
  ===================== */
  function init() {
    lastUpdate.textContent = 'Cargando datos...';

    fetch('data.json')
      .then(function(r) {
        if (!r.ok) throw new Error('No se pudo cargar data.json (status ' + r.status + ')');
        return r.json();
      })
      .then(function(data) {
        PRODUCTOS = data.map(function(p) {
          p.total_stock = (p.fair_stock||0)+(p.burza_stock||0)+(p.korn_stock||0)+(p.tucu_stock||0)+(p.cd_stock||0);
          return p;
        });
        filtered  = PRODUCTOS.slice();
        sortCol = 'total_stock';
        sortDir = 'desc';
        lastUpdate.textContent = 'Ultima actualizacion: ' +
          new Date().toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' });
        populateFamilias();
        restoreFromStorage();
        applySort();
        renderPanel();
        bindEvents();
      })
      .catch(function(err) {
        tableBody.innerHTML =
          '<tr><td colspan="14"><div class="empty-state">' +
          '<div class="icon">&#9888;</div>' +
          '<p>Error: ' + err.message + '.<br>' +
          'Abri el archivo desde un servidor local (ej: Live Server en VSCode).</p>' +
          '</div></td></tr>';
        lastUpdate.textContent = 'Error al cargar datos';
      });
  }

  /* =====================
     POPULATE FAMILIA
  ===================== */
  function populateFamilias() {
    var familias = [];
    PRODUCTOS.forEach(function(p) {
      if (familias.indexOf(p.familia) === -1) familias.push(p.familia);
    });
    familias.sort().forEach(function(f) {
      var opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      familiaFilter.appendChild(opt);
    });
  }

  /* =====================
     FILTERS
  ===================== */
  function applyFilters() {
    var q       = searchInput.value.trim().toLowerCase();
    var familia = familiaFilter.value;
    var stock   = stockFilter.value;

    filtered = PRODUCTOS.filter(function(p) {
      if (q) {
        var match = String(p.codigos).toLowerCase().indexOf(q) >= 0
          || String(p.productos).toLowerCase().indexOf(q) >= 0
          || String(p.familia).toLowerCase().indexOf(q) >= 0;
        if (!match) return false;
      }
      if (familia && p.familia !== familia) return false;
      if (stock === 'con_stock' && totalStock(p) <= 0) return false;
      if (stock === 'sin_stock' && totalStock(p) !== 0) return false;
      if (stock === 'negativo') {
        var stocks = [p.fair_stock, p.burza_stock, p.korn_stock, p.tucu_stock, p.cd_stock];
        if (!stocks.some(function(s){ return s < 0; })) return false;
      }
      return true;
    });

    applySort();
  }

  function totalStock(p) {
    return p.fair_stock + p.burza_stock + p.korn_stock + p.tucu_stock + p.cd_stock;
  }

  function applySort() {
    if (sortCol) {
      filtered.sort(function(a, b) {
        var va = a[sortCol], vb = b[sortCol];
        if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ?  1 : -1;
        return 0;
      });
    }
    render();
  }

  /* =====================
     RENDER TABLE
  ===================== */
  function render() {
    filterStats.textContent = filtered.length + ' producto' + (filtered.length !== 1 ? 's' : '');

    if (filtered.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="14"><div class="empty-state">' +
        '<div class="icon">&#128269;</div><p>No se encontraron productos.</p>' +
        '</div></td></tr>';
      return;
    }

    tableBody.innerHTML = filtered.map(function(p) {
      var isSel = selected.has(String(p.codigos));
      return '<tr class="' + (isSel ? 'row-selected' : '') + '" data-cod="' + p.codigos + '">' +
        '<td class="col-familia">' + p.familia + '</td>' +
        '<td class="col-cod">'    + p.codigos + '</td>' +
        '<td class="col-producto">' + p.productos + '</td>' +
        '<td class="num ' + nc(p.uxb)        + '">' + fmt(p.uxb)        + '</td>' +
        '<td class="num ' + nc(p.fair_vta)   + '">' + fmt(p.fair_vta)   + '</td>' +
        '<td class="num ' + nc(p.burza_vta)  + '">' + fmt(p.burza_vta)  + '</td>' +
        '<td class="num ' + nc(p.korn_vta)   + '">' + fmt(p.korn_vta)   + '</td>' +
        '<td class="num ' + nc(p.tucu_vta)   + '">' + fmt(p.tucu_vta)   + '</td>' +
        '<td class="num stock-col ' + nc(p.fair_stock)   + '">' + fmt(p.fair_stock)   + '</td>' +
        '<td class="num stock-col ' + nc(p.burza_stock)  + '">' + fmt(p.burza_stock)  + '</td>' +
        '<td class="num stock-col ' + nc(p.korn_stock)   + '">' + fmt(p.korn_stock)   + '</td>' +
        '<td class="num stock-col ' + nc(p.tucu_stock)   + '">' + fmt(p.tucu_stock)   + '</td>' +
        '<td class="num stock-col ' + nc(p.cd_stock)     + '">' + fmt(p.cd_stock)     + '</td>' +
        '<td class="num total-stk ' + nc(p.total_stock) + '">' + fmt(p.total_stock) + '</td>' +
        '<td style="text-align:right">' +
          '<button class="btn-elegir ' + (isSel ? 'added' : '') + '" data-cod="' + p.codigos + '">' +
            (isSel ? '&#10003; Agregado' : 'Elegir') +
          '</button>' +
        '</td></tr>';
    }).join('');
  }

  function fmt(n) {
    if (n === 0 || n == null) return '0,0';
    return n.toLocaleString('es-AR', { minimumFractionDigits:1, maximumFractionDigits:2 });
  }

  function nc(n) {
    if (n < 0) return 'neg';
    if (n > 0) return 'pos';
    return 'zero';
  }

  /* =====================
     SELECTED PANEL
  ===================== */
  function renderPanel() {
    var count = selected.size;
    badgeCount.textContent = count;
    panelBadge.textContent = count;

    if (count === 0) {
      panelBody.innerHTML =
        '<div class="empty-state"><div class="icon">&#128203;</div>' +
        '<p>Ningun producto seleccionado.</p></div>';
      return;
    }

    var rows = Array.from(selected.values()).map(function(p) {
      return '<tr>' +
        '<td class="col-cod">'     + p.codigos  + '</td>' +
        '<td class="col-producto">'+ p.productos + '</td>' +
        '<td class="col-familia">' + p.familia   + '</td>' +
        '<td class="num ' + nc(p.uxb)        + '">' + fmt(p.uxb)        + '</td>' +
        '<td class="num ' + nc(p.fair_vta)   + '">' + fmt(p.fair_vta)   + '</td>' +
        '<td class="num ' + nc(p.burza_vta)  + '">' + fmt(p.burza_vta)  + '</td>' +
        '<td class="num ' + nc(p.korn_vta)   + '">' + fmt(p.korn_vta)   + '</td>' +
        '<td class="num ' + nc(p.tucu_vta)   + '">' + fmt(p.tucu_vta)   + '</td>' +
        '<td class="num stock-col ' + nc(p.fair_stock)   + '">' + fmt(p.fair_stock)   + '</td>' +
        '<td class="num stock-col ' + nc(p.burza_stock)  + '">' + fmt(p.burza_stock)  + '</td>' +
        '<td class="num stock-col ' + nc(p.korn_stock)   + '">' + fmt(p.korn_stock)   + '</td>' +
        '<td class="num stock-col ' + nc(p.tucu_stock)   + '">' + fmt(p.tucu_stock)   + '</td>' +
        '<td class="num stock-col ' + nc(p.cd_stock)     + '">' + fmt(p.cd_stock)     + '</td>' +
        '<td class="num total-stk ' + nc(p.total_stock) + '">' + fmt(p.total_stock) + '</td>' +
        '<td style="text-align:right"><button class="btn-remove" data-cod="' + p.codigos + '" title="Quitar">&#x2715;</button></td>' +
        '</tr>';
    }).join('');

    panelBody.innerHTML =
      '<table class="selected-table"><thead><tr>' +
      '<th>Cod</th><th>Producto</th><th>Familia</th>' +
      '<th>UXB</th>' +
      '<th>Vta Fair</th><th>Vta Burza</th><th>Vta Korn</th><th>Vta Tucu</th>' +
      '<th class="stock-col">St Fair</th><th class="stock-col">St Burza</th>' +
      '<th class="stock-col">St Korn</th><th class="stock-col">St Tucu</th>' +
      '<th class="stock-col">St CD</th>' +
      '<th>Total</th>' +
      '<th></th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* =====================
     TOGGLE SELECTION
  ===================== */
  function toggleProduct(cod) {
    var p = null;
    for (var i = 0; i < PRODUCTOS.length; i++) {
      if (String(PRODUCTOS[i].codigos) === String(cod)) { p = PRODUCTOS[i]; break; }
    }
    if (!p) return;

    if (selected.has(String(cod))) {
      selected.delete(String(cod));
    } else {
      selected.set(String(cod), p);
    }
    saveToStorage();
    renderPanel();

    var row = tableBody.querySelector('tr[data-cod="' + cod + '"]');
    if (row) {
      var btn = row.querySelector('.btn-elegir');
      var isSel = selected.has(String(cod));
      row.classList.toggle('row-selected', isSel);
      if (btn) {
        btn.innerHTML = isSel ? '&#10003; Agregado' : 'Elegir';
        btn.classList.toggle('added', isSel);
      }
    }
  }

  /* =====================
     PANEL
  ===================== */
  function openPanel()  { panelOpen = true;  selectedPanel.classList.add('open'); }
  function closePanel() { panelOpen = false; selectedPanel.classList.remove('open'); }

  /* =====================
     PRINT
  ===================== */
  function doPrint() {
    if (selected.size === 0) { alert('No hay productos seleccionados.'); return; }

    var rows = Array.from(selected.values()).map(function(p) {
      return '<tr>' +
        '<td class="c-fam">'  + p.familia   + '</td>' +
        '<td class="c-cod">'  + p.codigos   + '</td>' +
        '<td class="c-prod">' + p.productos + '</td>' +
        '<td class="c-num">'  + p.uxb       + '</td>' +
        '<td class="c-num ' + pnc(p.fair_vta)   + '">' + fmt(p.fair_vta)   + '</td>' +
        '<td class="c-num ' + pnc(p.burza_vta)  + '">' + fmt(p.burza_vta)  + '</td>' +
        '<td class="c-num ' + pnc(p.korn_vta)   + '">' + fmt(p.korn_vta)   + '</td>' +
        '<td class="c-num ' + pnc(p.tucu_vta)   + '">' + fmt(p.tucu_vta)   + '</td>' +
        '<td class="c-num c-stk ' + pnc(p.fair_stock)   + '">' + fmt(p.fair_stock)   + '</td>' +
        '<td class="c-num c-stk ' + pnc(p.burza_stock)  + '">' + fmt(p.burza_stock)  + '</td>' +
        '<td class="c-num c-stk ' + pnc(p.korn_stock)   + '">' + fmt(p.korn_stock)   + '</td>' +
        '<td class="c-num c-stk ' + pnc(p.tucu_stock)   + '">' + fmt(p.tucu_stock)   + '</td>' +
        '<td class="c-num c-stk ' + pnc(p.cd_stock)     + '">' + fmt(p.cd_stock)     + '</td>' +
        '<td class="c-num c-tot ' + pnc(p.total_stock) + '">' + fmt(p.total_stock) + '</td>' +
        '</tr>';
    }).join('');

    printArea.innerHTML =
      '<h1>Stock &amp; Ventas &mdash; Productos Seleccionados</h1>' +
      '<p class="print-date">Fecha: ' + new Date().toLocaleString('es-AR') + '</p>' +
      '<table>' +
      '<colgroup>' +
      '  <col class="c-col-fam"><col class="c-col-cod"><col class="c-col-prod"><col class="c-col-num">' +
      '  <col class="c-col-num"><col class="c-col-num"><col class="c-col-num"><col class="c-col-num">' +
      '  <col class="c-col-stk"><col class="c-col-stk"><col class="c-col-stk"><col class="c-col-stk"><col class="c-col-stk"><col class="c-col-tot">' +
      '</colgroup>' +
      '<thead>' +
      '<tr class="grp-row">' +
      '  <th colspan="4"></th>' +
      '  <th colspan="4" class="grp-vta">VENTAS</th>' +
      '  <th colspan="5" class="grp-stk">STOCK</th>' +
      '  <th class="grp-tot">TOTAL</th>' +
      '</tr>' +
      '<tr>' +
      '  <th class="c-fam">Familia</th><th class="c-cod">Codigo</th><th class="c-prod">Producto</th><th class="c-num">UXB</th>' +
      '  <th class="c-num">Fair</th><th class="c-num">Burza</th><th class="c-num">Korn</th><th class="c-num">Tucu</th>' +
      '  <th class="c-num c-stk">Fair</th><th class="c-num c-stk">Burza</th><th class="c-num c-stk">Korn</th><th class="c-num c-stk">Tucu</th><th class="c-num c-stk">CD</th>' +
      '  <th class="c-num c-tot">Total</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>';

    window.print();
  }

  /* =====================
     EXPORT EXCEL
  ===================== */
  function doExcel() {
    if (selected.size === 0) { alert('No hay productos seleccionados.'); return; }

    var bom = '\uFEFF';
    var sep = ';';
    var headers = [
      'Familia','Codigo','Producto','UXB',
      'Vta Fair','Vta Burza','Vta Korn','Vta Tucu',
      'St Fair','St Burza','St Korn','St Tucu','St CD',
      'Total Stock'
    ].join(sep);

    var rows = Array.from(selected.values()).map(function(p) {
      return [
        p.familia, p.codigos, '"' + p.productos.replace(/"/g,'""') + '"',
        fmtNum(p.uxb),
        fmtNum(p.fair_vta),  fmtNum(p.burza_vta), fmtNum(p.korn_vta),  fmtNum(p.tucu_vta),
        fmtNum(p.fair_stock),fmtNum(p.burza_stock),fmtNum(p.korn_stock),fmtNum(p.tucu_stock),fmtNum(p.cd_stock),
        fmtNum(p.total_stock)
      ].join(sep);
    });

    var csv = bom + headers + '\n' + rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    var fecha = new Date().toLocaleDateString('es-AR').replace(/\//g,'-');
    a.href     = url;
    a.download = 'stock-ventas-' + fecha + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Numero para CSV (coma decimal, sin separador de miles)
  function fmtNum(n) {
    if (n === 0 || n == null) return '0';
    return String(n).replace('.', ',');
  }

  // Color class for print (p=black, zero=red, neg=red bold)
  function pnc(n) {
    if (n < 0)  return 'p-neg';
    if (n === 0) return 'p-zero';
    return 'p-pos';
  }


  /* =====================
     REPORTE EMAIL
  ===================== */
  function doReporte() {
    if (selected.size === 0) { alert('No hay productos seleccionados.'); return; }

    var fecha   = new Date().toLocaleString('es-AR', { dateStyle:'full', timeStyle:'short' });
    var fechaFN = new Date().toLocaleDateString('es-AR').replace(/\//g,'-');

    var todos = Array.from(selected.values());

    // ── Calculos para resumen ejecutivo ──────────────────────────────────────
    var totalProds    = todos.length;
    var sinStock      = todos.filter(function(p){ return p.total_stock <= 0; }).length;
    var conNegativo   = todos.filter(function(p){
      return [p.fair_stock,p.burza_stock,p.korn_stock,p.tucu_stock,p.cd_stock].some(function(s){ return s < 0; });
    }).length;
    var totalStockSum = todos.reduce(function(a,p){ return a + p.total_stock; }, 0);
    var vtaTotalSum   = todos.reduce(function(a,p){ return a + p.fair_vta + p.burza_vta + p.korn_vta + p.tucu_vta; }, 0);

    function fmtR(n) {
      if (n === 0 || n == null) return '0,0';
      return n.toLocaleString('es-AR', { minimumFractionDigits:1, maximumFractionDigits:2 });
    }

    function colorNum(n) {
      if (n < 0)  return 'color:#b91c1c;font-weight:700';
      if (n === 0) return 'color:#b91c1c;font-weight:700';
      return 'color:#15803d;font-weight:700';
    }

    // ── Semaforo por total_stock ──────────────────────────────────────────────
    function semaforo(p) {
      if (p.total_stock < 0)  return { icon:'&#9679;', color:'#b91c1c', bg:'#fff5f5', label:'Negativo' };
      if (p.total_stock === 0) return { icon:'&#9679;', color:'#b91c1c', bg:'#fff5f5', label:'Sin stock' };
      if (p.total_stock < 10) return { icon:'&#9679;', color:'#d97706', bg:'#fffbeb', label:'Stock bajo' };
      return { icon:'&#9679;', color:'#15803d', bg:'#ffffff', label:'OK' };
    }

    // ── Resumen ejecutivo ─────────────────────────────────────────────────────
    var alertaHtml = '';
    if (sinStock > 0) {
      alertaHtml += '<div style="display:flex;align-items:center;gap:8px;background:#fff5f5;border-left:4px solid #b91c1c;padding:10px 14px;border-radius:4px;margin-bottom:8px">' +
        '<span style="font-size:18px">&#9888;</span>' +
        '<span style="font-size:12px;color:#7f1d1d;font-weight:600">' + sinStock + ' producto' + (sinStock!==1?'s':'') + ' SIN STOCK &mdash; requieren reposici&oacute;n urgente</span>' +
        '</div>';
    }
    if (conNegativo > 0) {
      alertaHtml += '<div style="display:flex;align-items:center;gap:8px;background:#fff5f5;border-left:4px solid #7c3aed;padding:10px 14px;border-radius:4px;margin-bottom:8px">' +
        '<span style="font-size:18px">&#8595;</span>' +
        '<span style="font-size:12px;color:#4c1d95;font-weight:600">' + conNegativo + ' producto' + (conNegativo!==1?'s':'') + ' con STOCK NEGATIVO &mdash; revisar registros</span>' +
        '</div>';
    }

    var resumen = '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin-bottom:24px">' +
      '<h2 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:.06em">Resumen Ejecutivo</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">' +
        kpi('Productos analizados', totalProds, '#3b82f6', '#eff6ff', '#1e40af', '') +
        kpi('Sin stock / negativos', sinStock,   '#b91c1c', '#fff5f5', '#7f1d1d', '') +
        kpi('Total stock acumulado', fmtR(totalStockSum), '#15803d', '#f0fdf4', '#14532d', '') +
        kpi('Rotaci&oacute;n venta total', fmtR(vtaTotalSum), '#7c3aed', '#faf5ff', '#4c1d95', '') +
      '</div>' +
      (alertaHtml ? '<div>' + alertaHtml + '</div>' : '') +
    '</div>';

    // ── Tablas por familia ────────────────────────────────────────────────────
    var grupos = {};
    todos.forEach(function(p) {
      if (!grupos[p.familia]) grupos[p.familia] = [];
      grupos[p.familia].push(p);
    });

    var TD  = 'padding:5px 8px;font-size:11px;text-align:center;border-bottom:1px solid #f1f5f9';
    var TDL = 'padding:5px 8px;font-size:11px;border-bottom:1px solid #f1f5f9';
    var TH  = 'padding:5px 8px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:center;border-bottom:1px solid #e2e8f0;color:#64748b;background:#f8fafc';
    var THL = 'padding:5px 8px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;background:#f8fafc';

    var tablas = Object.keys(grupos).sort().map(function(familia) {
      var prods = grupos[familia];

      // totales de la familia
      var totFair  = prods.reduce(function(a,p){ return a+p.fair_stock; },0);
      var totBurza = prods.reduce(function(a,p){ return a+p.burza_stock; },0);
      var totKorn  = prods.reduce(function(a,p){ return a+p.korn_stock; },0);
      var totTucu  = prods.reduce(function(a,p){ return a+p.tucu_stock; },0);
      var totCD    = prods.reduce(function(a,p){ return a+p.cd_stock; },0);
      var totTotal = prods.reduce(function(a,p){ return a+p.total_stock; },0);
      var totVFair = prods.reduce(function(a,p){ return a+p.fair_vta; },0);
      var totVBurz = prods.reduce(function(a,p){ return a+p.burza_vta; },0);
      var totVKorn = prods.reduce(function(a,p){ return a+p.korn_vta; },0);
      var totVTucu = prods.reduce(function(a,p){ return a+p.tucu_vta; },0);

      var filas = prods.map(function(p) {
        var sem = semaforo(p);
        var rowBg = sem.bg !== '#ffffff' ? 'background:' + sem.bg + ';' : '';
        return '<tr style="' + rowBg + 'border-bottom:1px solid #f1f5f9">' +
          '<td style="' + TDL + ';width:14px;text-align:center"><span style="color:' + sem.color + ';font-size:10px" title="' + sem.label + '">' + sem.icon + '</span></td>' +
          '<td style="' + TDL + ';font-size:11px;color:#475569;font-weight:600;white-space:nowrap">' + p.codigos + '</td>' +
          '<td style="' + TDL + ';font-size:11px;color:#0f172a;font-weight:700;max-width:200px">' + p.productos + '</td>' +
          '<td style="' + TD  + ';color:#334155">' + p.uxb + '</td>' +
          '<td style="' + TD  + ';' + colorNum(p.fair_vta)   + '">' + fmtR(p.fair_vta)   + '</td>' +
          '<td style="' + TD  + ';' + colorNum(p.burza_vta)  + '">' + fmtR(p.burza_vta)  + '</td>' +
          '<td style="' + TD  + ';' + colorNum(p.korn_vta)   + '">' + fmtR(p.korn_vta)   + '</td>' +
          '<td style="' + TD  + ';' + colorNum(p.tucu_vta)   + '">' + fmtR(p.tucu_vta)   + '</td>' +
          '<td class="inv-cell" style="' + TD  + ';background:#f0f7ee;cursor:pointer;' + colorNum(p.fair_stock)   + '" title="Clic para ver detalle">' + fmtR(p.fair_stock)   + '</td>' +
          '<td class="inv-cell" style="' + TD  + ';background:#f0f7ee;cursor:pointer;' + colorNum(p.burza_stock)  + '" title="Clic para ver detalle">' + fmtR(p.burza_stock)  + '</td>' +
          '<td class="inv-cell" style="' + TD  + ';background:#f0f7ee;cursor:pointer;' + colorNum(p.korn_stock)   + '" title="Clic para ver detalle">' + fmtR(p.korn_stock)   + '</td>' +
          '<td class="inv-cell" style="' + TD  + ';background:#f0f7ee;cursor:pointer;' + colorNum(p.tucu_stock)   + '" title="Clic para ver detalle">' + fmtR(p.tucu_stock)   + '</td>' +
          '<td class="inv-cell" style="' + TD  + ';background:#f0f7ee;cursor:pointer;' + colorNum(p.cd_stock)     + '" title="Clic para ver detalle">' + fmtR(p.cd_stock)     + '</td>' +
          '<td class="inv-cell" style="' + TD  + ';background:#fef9e7;font-size:12px;font-weight:800;cursor:pointer;color:' + (p.total_stock>0?'#14532d':'#b91c1c') + '" title="Clic para ver detalle">' + fmtR(p.total_stock) + '</td>' +
          '</tr>';
      }).join('');

      // fila totales
      var TF = 'padding:6px 8px;font-size:11px;font-weight:700;text-align:center;background:#1e293b;color:#fff;border-top:2px solid #334155';
      var filaTotal = '<tr>' +
        '<td style="' + TF + ';text-align:left" colspan="4">TOTAL FAMILIA</td>' +
        '<td style="' + TF + ';color:' + (totVFair>0?'#86efac':'#fca5a5') + '">'  + fmtR(totVFair)  + '</td>' +
        '<td style="' + TF + ';color:' + (totVBurz>0?'#86efac':'#fca5a5') + '">'  + fmtR(totVBurz)  + '</td>' +
        '<td style="' + TF + ';color:' + (totVKorn>0?'#86efac':'#fca5a5') + '">'  + fmtR(totVKorn)  + '</td>' +
        '<td style="' + TF + ';color:' + (totVTucu>0?'#86efac':'#fca5a5') + '">'  + fmtR(totVTucu)  + '</td>' +
        '<td style="' + TF + ';color:' + (totFair>0?'#86efac':'#fca5a5')  + '">'  + fmtR(totFair)   + '</td>' +
        '<td style="' + TF + ';color:' + (totBurza>0?'#86efac':'#fca5a5') + '">'  + fmtR(totBurza)  + '</td>' +
        '<td style="' + TF + ';color:' + (totKorn>0?'#86efac':'#fca5a5')  + '">'  + fmtR(totKorn)   + '</td>' +
        '<td style="' + TF + ';color:' + (totTucu>0?'#86efac':'#fca5a5')  + '">'  + fmtR(totTucu)   + '</td>' +
        '<td style="' + TF + ';color:' + (totCD>0?'#86efac':'#fca5a5')    + '">'  + fmtR(totCD)     + '</td>' +
        '<td style="background:#0f172a;padding:6px 8px;font-size:13px;font-weight:900;text-align:center;color:' + (totTotal>0?'#22d07a':'#f87171') + ';border-top:2px solid #334155">' + fmtR(totTotal) + '</td>' +
        '</tr>';

      return '<div style="margin-bottom:20px">' +
        '<div style="background:#1e293b;color:#fff;padding:7px 14px;border-radius:6px 6px 0 0;display:flex;align-items:center;gap:10px">' +
          '<span style="font-size:13px;font-weight:700;letter-spacing:.04em">' + familia + '</span>' +
          '<span style="background:#334155;color:#94a3b8;font-size:10px;padding:2px 8px;border-radius:10px">' + prods.length + ' producto' + (prods.length!==1?'s':'') + '</span>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-top:none">' +
        '<thead>' +
        '<tr>' +
          '<th style="' + TH + ';width:14px"></th>' +
          '<th style="' + THL + '">C&oacute;d</th>' +
          '<th style="' + THL + '">Descripci&oacute;n del Producto</th>' +
          '<th style="' + TH + '">UXB</th>' +
          '<th colspan="4" style="' + TH + ';color:#2563eb;border-bottom:2px solid #3b82f6">ROTACI&Oacute;N / VENTAS</th>' +
          '<th colspan="5" class="inv-zone-header" style="' + TH + ';color:#15803d;background:#f0f7ee;border-bottom:2px solid #16a34a;cursor:zoom-in" title="Clic en cualquier celda para ampliar">AN&Aacute;LISIS DE INVENTARIO &nbsp;&#128269;</th>' +
          '<th class="inv-zone-header" style="' + TH + ';color:#b45309;background:#fef9e7;border-bottom:2px solid #d97706;cursor:zoom-in" title="Clic para ampliar">TOTAL</th>' +
        '</tr>' +
        '<tr>' +
          '<th style="' + TH + '"></th>' +
          '<th style="' + TH + '"></th>' +
          '<th style="' + TH + '"></th>' +
          '<th style="' + TH + '"></th>' +
          '<th style="' + TH + '">Fair</th><th style="' + TH + '">Burza</th><th style="' + TH + '">Korn</th><th style="' + TH + '">Tucu</th>' +
          '<th style="' + TH + ';background:#f0f7ee">Fair</th><th style="' + TH + ';background:#f0f7ee">Burza</th><th style="' + TH + ';background:#f0f7ee">Korn</th><th style="' + TH + ';background:#f0f7ee">Tucu</th><th style="' + TH + ';background:#f0f7ee">CD</th>' +
          '<th style="' + TH + ';background:#fef9e7"></th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' + filas + filaTotal + '</tbody>' +
        '</table></div>';
    }).join('');

    // ── HTML final ────────────────────────────────────────────────────────────
    var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Informe de Gesti&oacute;n de Inventario - ' + fechaFN + '</title>' +
      '<style>' +
        '*{box-sizing:border-box}' +
        'body{margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif}' +
        '.wrap{max-width:1000px;margin:0 auto;padding:20px}' +
        '.header{background:#0f172a;color:#fff;border-radius:10px;padding:18px 24px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}' +
        '.header-left h1{margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em}' +
        '.header-left h1 span{color:#22d07a}' +
        '.header-left p{margin:3px 0 0;font-size:11px;color:#94a3b8}' +
        '.header-right{text-align:right}' +
        '.badge-total{background:#1e293b;color:#22d07a;border:1px solid #22d07a33;border-radius:20px;padding:5px 14px;font-size:12px;font-weight:700;display:inline-block}' +
        '.fecha{color:#64748b;font-size:10px;margin-top:5px}' +
        '.footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0}' +
        '@media print{' +
          'body{background:#fff}' +
          '.wrap{padding:0}' +
          '.header{border-radius:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
          'div[style*="background:#1e293b"]{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
          'tr[style]{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
          '@page{size:A4 landscape;margin:6mm}' +
          '.modal-overlay{display:none!important}' +
        '}' +
        '.inv-cell{transition:background .15s,transform .1s;cursor:zoom-in!important}' +
        '.inv-cell:hover{filter:brightness(.93);transform:scale(1.07);z-index:2;position:relative;box-shadow:0 2px 12px rgba(0,0,0,.18)}' +
        '.inv-zone-header{cursor:zoom-in}' +
        '.inv-zone-header:hover{background:#d1fae5!important;transition:background .15s}' +
        '.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;align-items:center;justify-content:center;backdrop-filter:blur(3px)}' +
        '.modal-overlay.active{display:flex}' +
        '.modal-box{background:#fff;border-radius:14px;padding:32px 36px;min-width:340px;max-width:520px;width:90%;box-shadow:0 25px 60px rgba(0,0,0,.35);animation:modalIn .2s ease}' +
        '@keyframes modalIn{from{transform:scale(.88);opacity:0}to{transform:scale(1);opacity:1}}' +
        '.modal-close{position:absolute;top:14px;right:18px;background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;line-height:1}' +
        '.modal-close:hover{color:#0f172a}' +
        '.modal-title{font-size:13px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px}' +
        '.modal-prod{font-size:15px;font-weight:700;color:#1e293b;margin:0 0 20px;line-height:1.3}' +
        '.modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
        '.modal-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}' +
        '.modal-item.neg{background:#fff5f5;border-color:#fecaca}' +
        '.modal-item.ok{background:#f0fdf4;border-color:#bbf7d0}' +
        '.modal-dep{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}' +
        '.modal-val{font-size:26px;font-weight:800;line-height:1}' +
        '.modal-val.pos{color:#15803d}' +
        '.modal-val.neg{color:#b91c1c}' +
        '.modal-total{margin-top:14px;background:#0f172a;border-radius:8px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center}' +
        '.modal-total-lbl{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em}' +
        '.modal-total-val{font-size:28px;font-weight:900}' +
      '</style></head><body>' +
      '<div class="wrap">' +
        '<div class="header">' +
          '<div class="header-left">' +
            '<h1>STOCK <span>&amp;</span> VENTAS</h1>' +
            '<p>Informe de Gesti&oacute;n de Inventario &mdash; Distribuci&oacute;n Emanuel</p>' +
          '</div>' +
          '<div class="header-right">' +
            '<div class="badge-total">' + totalProds + ' producto' + (totalProds!==1?'s':'') + ' analizados</div>' +
            '<div class="fecha">' + fecha + '</div>' +
          '</div>' +
        '</div>' +
        resumen +
        tablas +
        '<div class="footer">Informe generado autom&aacute;ticamente &mdash; Sistema Stock &amp; Ventas &mdash; ' + fecha + '</div>' +
      '</div>' +
      '<div class="modal-overlay" id="invModal">' +
        '<div class="modal-box" style="position:relative">' +
          '<button class="modal-close" onclick="document.getElementById(\"invModal\").classList.remove(\"active\")">&times;</button>' +
          '<p class="modal-title">An&aacute;lisis de Inventario</p>' +
          '<p class="modal-prod" id="modalProd"></p>' +
          '<div class="modal-grid" id="modalGrid"></div>' +
          '<div class="modal-total">' +
            '<span class="modal-total-lbl">Total Stock</span>' +
            '<span class="modal-total-val" id="modalTotal"></span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<script>' +
        'document.addEventListener("click",function(e){' +
          'var cell=e.target.closest(".inv-cell");' +
          'if(!cell)return;' +
          'var row=cell.closest("tr");' +
          'if(!row)return;' +
          'var cells=row.querySelectorAll("td");' +
          'var prod=cells[2]?cells[2].textContent.trim():"";' +
          'var deps=["Fair","Burza","Korn","Tucu","CD"];' +
          'var vals=[cells[8],cells[9],cells[10],cells[11],cells[12]].map(function(c){return c?parseFloat(c.textContent.replace(/\\./g,"").replace(",","."))||0:0;});' +
          'var total=cells[13]?parseFloat(cells[13].textContent.replace(/\\./g,"").replace(",","."))||0:0;' +
          'document.getElementById("modalProd").textContent=prod;' +
          'var grid="";' +
          'deps.forEach(function(d,i){' +
            'var v=vals[i];var cls=v>0?"ok":"neg";var vcls=v>0?"pos":"neg";' +
            'grid+="<div class=\"modal-item "+cls+"\"><div class=\"modal-dep\">"+ d +"</div><div class=\"modal-val "+vcls+"\">"+ v.toLocaleString(\"es-AR\",{minimumFractionDigits:1,maximumFractionDigits:2}) +"</div></div>";' +
          '});' +
          'document.getElementById("modalGrid").innerHTML=grid;' +
          'var tv=document.getElementById("modalTotal");' +
          'tv.textContent=total.toLocaleString("es-AR",{minimumFractionDigits:1,maximumFractionDigits:2});' +
          'tv.style.color=total>0?"#22d07a":"#f87171";' +
          'document.getElementById("invModal").classList.add("active");' +
        '});' +
        'document.getElementById("invModal").addEventListener("click",function(e){if(e.target===this)this.classList.remove("active");});' +
        'document.addEventListener("keydown",function(e){if(e.key==="Escape")document.getElementById("invModal").classList.remove("active");});' +
      '</script>' +
      '</body></html>';

    var blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'informe-inventario-' + fechaFN + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function kpi(label, value, color, bg, textColor, unit) {
    return '<div style="background:' + bg + ';border:1px solid ' + color + '33;border-radius:8px;padding:14px 16px;text-align:center">' +
      '<div style="font-size:22px;font-weight:800;color:' + textColor + '">' + value + unit + '</div>' +
      '<div style="font-size:10px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:.05em">' + label + '</div>' +
    '</div>';
  }

  /* =====================
     EVENTS
  ===================== */
  function bindEvents() {
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        clearSearch.style.display = searchInput.value ? 'block' : 'none';
        applyFilters();
      }
    });
    searchInput.addEventListener('input', function() {
      clearSearch.style.display = searchInput.value ? 'block' : 'none';
    });

    clearSearch.addEventListener('click', function() {
      searchInput.value = '';
      clearSearch.style.display = 'none';
      applyFilters();
    });

    familiaFilter.addEventListener('change', applyFilters);
    stockFilter.addEventListener('change', applyFilters);

    tableBody.addEventListener('click', function(e) {
      var btn = e.target.closest('.btn-elegir');
      if (btn) toggleProduct(btn.dataset.cod);
    });

    document.querySelectorAll('th.sortable').forEach(function(th) {
      th.addEventListener('click', function() {
        var col = th.dataset.col;
        if (sortCol === col) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortCol = col;
          sortDir = 'asc';
        }
        document.querySelectorAll('th.sortable').forEach(function(t) {
          t.classList.remove('sorted-asc','sorted-desc');
        });
        th.classList.add(sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
        applySort();
      });
    });

    btnVerSeleccionados.addEventListener('click', function() {
      panelOpen ? closePanel() : openPanel();
    });
    btnClosePanel.addEventListener('click', closePanel);

    panelBody.addEventListener('click', function(e) {
      var btn = e.target.closest('.btn-remove');
      if (btn) toggleProduct(btn.dataset.cod);
    });

    btnClearAll.addEventListener('click', function() {
      if (!selected.size) return;
      if (confirm('Quitar todos los ' + selected.size + ' productos seleccionados?')) {
        selected.clear();
        saveToStorage();
        renderPanel();
        render();
      }
    });

    btnPrint.addEventListener('click', doPrint);
    document.getElementById('btnExcel').addEventListener('click', doExcel);
    document.getElementById('btnReporte').addEventListener('click', doReporte);
  }

  /* =====================
     START
  ===================== */
  init();

})();