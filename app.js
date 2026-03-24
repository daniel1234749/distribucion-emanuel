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
  }

  /* =====================
     START
  ===================== */
  init();

})();