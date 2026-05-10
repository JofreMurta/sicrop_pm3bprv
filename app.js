/* SIGROP v1.3 — Lógica da aplicação */

// ── ESTADO ──────────────────────────────────────────────────────
var ocorrencias = [], fatos = [], rodovias = [], btls = [], cias = [], pels = [];
var cmtsCprv = [], cmtsBprv = [], cmtsCia = [];
var usuarioAtual = null, isAdmin = false, editandoId = null;
var catAtual = 'transito', equipeN = 0;
var ADMINS = ['ejmurta@gmail.com'];

var COLECOES = [
  {id:'fatos',     label:'📋 Natureza do Fato', sel:'f-fato',     dados:function(){return fatos;}},
  {id:'rodovias',  label:'🛣️ SP/SPA/SPI/SPD',  sel:'f-rodovia',  dados:function(){return rodovias;}},
  {id:'btls',      label:'🏛️ Btl',             sel:'f-btl',      dados:function(){return btls;}},
  {id:'cias',      label:'🏛️ Cia',             sel:'f-cia',      dados:function(){return cias;}},
  {id:'pels',      label:'🏛️ Pel',             sel:'f-pel',      dados:function(){return pels;}},
  {id:'cmtsCprv',  label:'👤 CMT CPRv',         sel:'f-cmt-cprv', dados:function(){return cmtsCprv;}},
  {id:'cmtsBprv',  label:'👤 CMT BPRv',         sel:'f-cmt-bprv', dados:function(){return cmtsBprv;}},
  {id:'cmtsCia',   label:'👤 CMT CIA Rv',        sel:'f-cmt-cia',  dados:function(){return cmtsCia;}},
];

// ── FIREBASE ─────────────────────────────────────────────────────
function fb(cb) {
  if (window._fb) cb(window._fb);
  else setTimeout(function(){ fb(cb); }, 80);
}

// ── NAVEGAÇÃO ────────────────────────────────────────────────────
function irPara(tela) {
  // Ocultar todas as telas
  document.querySelectorAll('.tela').forEach(function(el){
    el.classList.remove('ativa');
  });
  // Desativar todas as abas
  document.querySelectorAll('.nav-tab').forEach(function(el){
    el.classList.remove('ativo');
  });
  // Mostrar tela e aba selecionadas
  var telEl = document.getElementById('tela-' + tela);
  var tabEl = document.getElementById('tab-' + tela);
  if (telEl) telEl.classList.add('ativa');
  if (tabEl) tabEl.classList.add('ativo');
  // Reset formulário se nova ocorrência
  if (tela === 'nova' && !editandoId) {
    resetForm();
    document.getElementById('form-titulo').textContent = 'Nova Ocorrência';
    document.getElementById('form-sub').textContent = 'Preencha os campos obrigatórios';
    document.getElementById('btn-salvar').innerHTML = '💾 Salvar Ocorrência';
  }
  window.scrollTo(0, 0);
}

// ── LOGIN ─────────────────────────────────────────────────────────
function fazerLogin() {
  var email = document.getElementById('login-email').value.trim();
  var senha = document.getElementById('login-senha').value;
  var err = document.getElementById('login-error');
  var txt = document.getElementById('btn-login-txt');
  err.textContent = '';
  txt.innerHTML = '<span class="spinner"></span> Autenticando…';
  fb(function(f){
    f.signInWithEmailAndPassword(f.auth, email, senha)
      .catch(function(e){
        err.textContent = tradErr(e.code);
        txt.textContent = 'Acessar Sistema';
      });
  });
}

function tradErr(code) {
  var m = {
    'auth/user-not-found':'Usuário não encontrado.',
    'auth/wrong-password':'Senha incorreta.',
    'auth/invalid-email':'E-mail inválido.',
    'auth/too-many-requests':'Muitas tentativas. Tente mais tarde.',
    'auth/invalid-credential':'Credenciais inválidas.'
  };
  return m[code] || 'Erro ao autenticar.';
}

function fazerLogout() {
  fb(function(f){ f.signOut(f.auth); });
}

// ── AUTH STATE ────────────────────────────────────────────────────
fb(function(f){
  f.onAuthStateChanged(f.auth, function(user){
    if (user) {
      usuarioAtual = user;
      isAdmin = ADMINS.indexOf(user.email) >= 0;
      document.getElementById('user-unit').textContent = user.email;
      document.getElementById('screen-login').style.display = 'none';
      if (isAdmin) document.getElementById('tab-admin').style.display = 'flex';
      inicializar();
    } else {
      usuarioAtual = null;
      document.getElementById('screen-login').style.display = 'flex';
      document.getElementById('screen-app').style.display = 'none';
    }
  });
});

// ── INICIALIZAR ───────────────────────────────────────────────────
function inicializar() {
  irPara('listagem');
  document.getElementById('screen-app').style.display = 'block';
  COLECOES.forEach(function(c){ ouvirColecao(c); });
  ouvirOcorrencias();
  document.getElementById('f-data').valueAsDate = new Date();
  buildAdmin();
}

// ── COLEÇÕES ──────────────────────────────────────────────────────
function ouvirColecao(col) {
  fb(function(f){
    var q = f.query(f.collection(f.db, col.id), f.orderBy('nome'));
    f.onSnapshot(q, function(snap){
      var dados = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
      if (col.id==='fatos')    fatos=dados;
      if (col.id==='rodovias') rodovias=dados;
      if (col.id==='btls')     btls=dados;
      if (col.id==='cias')     cias=dados;
      if (col.id==='pels')     pels=dados;
      if (col.id==='cmtsCprv') cmtsCprv=dados;
      if (col.id==='cmtsBprv') cmtsBprv=dados;
      if (col.id==='cmtsCia')  cmtsCia=dados;
      renderSelect(col.sel, dados);
      renderAdminLista(col.id);
    });
  });
}

function renderSelect(elId, lista) {
  var sel = document.getElementById(elId);
  if (!sel) return;
  var val = sel.value;
  var first = sel.options[0];
  sel.innerHTML = '';
  sel.appendChild(first);
  lista.filter(function(i){ return i.ativo !== false; }).forEach(function(i){
    var o = document.createElement('option');
    o.value = i.nome; o.textContent = i.nome;
    sel.appendChild(o);
  });
  sel.value = val;
}

// ── OCORRÊNCIAS ───────────────────────────────────────────────────
function ouvirOcorrencias() {
  fb(function(f){
    var q = f.query(f.collection(f.db,'ocorrencias'), f.orderBy('criadoEm','desc'));
    f.onSnapshot(q, function(snap){
      ocorrencias = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
      renderTabela(ocorrencias);
      updateStats();
    });
  });
}

function updateStats() {
  document.getElementById('stat-total').textContent = ocorrencias.length;
  document.getElementById('stat-andamento').textContent = ocorrencias.filter(function(o){ return o.status==='Em andamento'; }).length;
  var hoje = new Date().toISOString().split('T')[0];
  document.getElementById('stat-hoje').textContent = ocorrencias.filter(function(o){ return o.data===hoje; }).length;
}

function renderTabela(lista) {
  var tbody = document.getElementById('tbody-ocs');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><div class="icon">📄</div><p>Nenhuma ocorrência.</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(function(o){
    var rod = o.rodovia ? (o.rodovia + (o.km?' KM '+o.km:'')) : (o.municipio||'—');
    var badge = o.status==='Em andamento'?'andamento':o.status==='Concluído'?'concluido':'cancelado';
    return '<tr>' +
      '<td style="font-family:\'Courier New\',monospace;white-space:nowrap">'+fmtData(o.data)+'</td>' +
      '<td>'+( o.fato||'—')+'</td>' +
      '<td>'+(o.municipio||'—')+'</td>' +
      '<td>'+rod+'</td>' +
      '<td><span class="badge badge-'+badge+'">'+(o.status||'—')+'</span></td>' +
      '<td><div style="display:flex;gap:5px;flex-wrap:wrap">' +
        '<button class="btn btn-g btn-sm" onclick="verOcorrencia(\''+o.id+'\')">👁</button>' +
        '<button class="btn btn-g btn-sm" onclick="editarOcorrencia(\''+o.id+'\')">✏️</button>' +
        '<button class="btn btn-g btn-sm" onclick="exportarPDF(\''+o.id+'\')">📄</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
}

function filtrarOcorrencias() {
  var busca = document.getElementById('filtro-busca').value.toLowerCase();
  var status = document.getElementById('filtro-status').value;
  renderTabela(ocorrencias.filter(function(o){
    var txt = [o.fato,o.municipio,o.rodovia,o.historico].join(' ').toLowerCase();
    return (!busca || txt.indexOf(busca)>=0) && (!status || o.status===status);
  }));
}

// ── CATEGORIAS ────────────────────────────────────────────────────
function selCat(cat, el) {
  catAtual = cat;
  document.querySelectorAll('.cat-tab').forEach(function(t){ t.classList.remove('ativo'); });
  document.querySelectorAll('.cat-panel').forEach(function(p){ p.classList.remove('ativo'); });
  if (el) el.classList.add('ativo');
  var panel = document.getElementById('cat-' + cat);
  if (panel) panel.classList.add('ativo');
}

// ── EQUIPES ───────────────────────────────────────────────────────
function addEquipe() {
  equipeN++;
  var n = equipeN;
  var div = document.createElement('div');
  div.className = 'equipe-card';
  div.id = 'eq-' + n;
  div.innerHTML =
    '<div class="equipe-header">' +
      '<span class="equipe-titulo">Equipe ' + n + '</span>' +
      '<button type="button" class="btn btn-d btn-sm" onclick="rmEquipe(' + n + ')">✕ Remover</button>' +
    '</div>' +
    '<div class="grid g3" style="gap:9px">' +
      '<div class="fg"><label>VTR</label><input type="text" id="eq'+n+'-vtr" placeholder="Ex: R-03128"></div>' +
      '<div class="fg"><label>Encarregado</label><input type="text" id="eq'+n+'-enc" placeholder="Cb PM Nome"></div>' +
      '<div class="fg"><label>Auxiliar 1</label><input type="text" id="eq'+n+'-a1" placeholder="Sd PM Nome"></div>' +
      '<div class="fg"><label>Auxiliar 2</label><input type="text" id="eq'+n+'-a2" placeholder="Sd PM Nome"></div>' +
      '<div class="fg"><label>Auxiliar 3</label><input type="text" id="eq'+n+'-a3" placeholder="Sd PM Nome"></div>' +
      '<div class="fg"><label>Auxiliar 4</label><input type="text" id="eq'+n+'-a4" placeholder="Sd PM Nome"></div>' +
    '</div>';
  document.getElementById('equipes-container').appendChild(div);
}

function rmEquipe(n) {
  var el = document.getElementById('eq-' + n);
  if (el) el.remove();
}

function coletarEquipes() {
  var equipes = [];
  document.querySelectorAll('.equipe-card').forEach(function(card){
    var n = card.id.replace('eq-','');
    equipes.push({
      vtr: gv('eq'+n+'-vtr'), enc: gv('eq'+n+'-enc'),
      a1:  gv('eq'+n+'-a1'),  a2:  gv('eq'+n+'-a2'),
      a3:  gv('eq'+n+'-a3'),  a4:  gv('eq'+n+'-a4')
    });
  });
  return equipes;
}

function preencherEquipes(equipes) {
  document.getElementById('equipes-container').innerHTML = '';
  equipeN = 0;
  if (!equipes || !equipes.length) return;
  equipes.forEach(function(eq){
    addEquipe();
    var n = equipeN;
    sv('eq'+n+'-vtr', eq.vtr); sv('eq'+n+'-enc', eq.enc);
    sv('eq'+n+'-a1',  eq.a1);  sv('eq'+n+'-a2',  eq.a2);
    sv('eq'+n+'-a3',  eq.a3);  sv('eq'+n+'-a4',  eq.a4);
  });
}

// ── FORMULÁRIO ────────────────────────────────────────────────────
function coletarDados() {
  return {
    fato: gv('f-fato'), ambiente: gv('f-ambiente'), data: gv('f-data'),
    horaFato: gv('f-hora-fato'), efetivo: gv('f-efetivo'),
    rodovia: gv('f-rodovia'), km: gv('f-km'), metros: gv('f-metros'),
    pista: gv('f-pista'), municipio: gv('f-municipio'), socorro: gv('f-socorro'),
    btl: gv('f-btl'), cia: gv('f-cia'), pel: gv('f-pel'),
    tempoResp: gv('f-tempo-resp'), dp: gv('f-dp'),
    equipes: coletarEquipes(), categoria: catAtual,
    tFatais: gv('f-t-fatais'), tGraves: gv('f-t-graves'), tLeves: gv('f-t-leves'),
    tAP: gv('f-t-ap'), tMoto: gv('f-t-moto'), tCA: gv('f-t-ca'), tOA: gv('f-t-oa'), tOutros: gv('f-t-outros'),
    tPista: gv('f-t-pista'), tTempo: gv('f-t-tempo'), tPavimento: gv('f-t-pavimento'),
    tTipo: gv('f-t-tipo'), tObito: gv('f-t-obito'),
    cVitimas: gv('f-c-vitimas'),
    cAP: gv('f-c-ap'), cMoto: gv('f-c-moto'), cCA: gv('f-c-ca'), cOA: gv('f-c-oa'), cOutros: gv('f-c-outros'),
    cApreendidos: gv('f-c-apreendidos'), cSubtraidos: gv('f-c-subtraidos'),
    cPressos: gv('f-c-presos'), cArmas: gv('f-c-armas'),
    mQtd: gv('f-m-qtd'), mResp: gv('f-m-resp'), mMotivo: gv('f-m-motivo'), mInterdicao: gv('f-m-interdicao'),
    iMotivo: gv('f-i-motivo'), iKm: gv('f-i-km'),
    cmtCprv: gv('f-cmt-cprv'), cmtBprv: gv('f-cmt-bprv'), cmtCia: gv('f-cmt-cia'),
    ppri: gv('f-ppri'), token: gv('f-token'), bopc: gv('f-bopc'),
    historico: gv('f-historico'),
    autLocal: gv('f-aut-local'), autCient: gv('f-aut-cient'),
    status: gv('f-status')
  };
}

function preencherForm(o) {
  sv('f-fato',o.fato); sv('f-ambiente',o.ambiente); sv('f-data',o.data);
  sv('f-hora-fato',o.horaFato); sv('f-efetivo',o.efetivo);
  sv('f-rodovia',o.rodovia); sv('f-km',o.km); sv('f-metros',o.metros);
  sv('f-pista',o.pista); sv('f-municipio',o.municipio); sv('f-socorro',o.socorro);
  sv('f-btl',o.btl); sv('f-cia',o.cia); sv('f-pel',o.pel);
  sv('f-tempo-resp',o.tempoResp); sv('f-dp',o.dp);
  preencherEquipes(o.equipes||[]);
  var cat = o.categoria||'transito';
  catAtual = cat;
  document.querySelectorAll('.cat-tab').forEach(function(t,i){
    var cats=['transito','criminal','manifestacao','interdicao'];
    t.classList.toggle('ativo', cats[i]===cat);
  });
  document.querySelectorAll('.cat-panel').forEach(function(p){ p.classList.remove('ativo'); });
  var panel = document.getElementById('cat-'+cat);
  if (panel) panel.classList.add('ativo');
  sv('f-t-fatais',o.tFatais); sv('f-t-graves',o.tGraves); sv('f-t-leves',o.tLeves);
  sv('f-t-ap',o.tAP); sv('f-t-moto',o.tMoto); sv('f-t-ca',o.tCA); sv('f-t-oa',o.tOA); sv('f-t-outros',o.tOutros);
  sv('f-t-pista',o.tPista); sv('f-t-tempo',o.tTempo); sv('f-t-pavimento',o.tPavimento);
  sv('f-t-tipo',o.tTipo); sv('f-t-obito',o.tObito);
  sv('f-c-vitimas',o.cVitimas);
  sv('f-c-ap',o.cAP); sv('f-c-moto',o.cMoto); sv('f-c-ca',o.cCA); sv('f-c-oa',o.cOA); sv('f-c-outros',o.cOutros);
  sv('f-c-apreendidos',o.cApreendidos); sv('f-c-subtraidos',o.cSubtraidos);
  sv('f-c-presos',o.cPressos); sv('f-c-armas',o.cArmas);
  sv('f-m-qtd',o.mQtd); sv('f-m-resp',o.mResp); sv('f-m-motivo',o.mMotivo); sv('f-m-interdicao',o.mInterdicao);
  sv('f-i-motivo',o.iMotivo); sv('f-i-km',o.iKm);
  sv('f-cmt-cprv',o.cmtCprv); sv('f-cmt-bprv',o.cmtBprv); sv('f-cmt-cia',o.cmtCia);
  sv('f-ppri',o.ppri); sv('f-token',o.token); sv('f-bopc',o.bopc);
  sv('f-historico',o.historico);
  sv('f-aut-local',o.autLocal); sv('f-aut-cient',o.autCient);
  sv('f-status',o.status);
}

function resetForm() {
  document.getElementById('form-oc').reset();
  document.getElementById('f-data').valueAsDate = new Date();
  document.getElementById('equipes-container').innerHTML = '';
  equipeN = 0; editandoId = null;
  selCat('transito', document.querySelector('.cat-tab'));
}

function salvarOcorrencia(e) {
  e.preventDefault();
  var btn = document.getElementById('btn-salvar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Salvando…';
  var dados = coletarDados();
  fb(function(f){
    var p;
    if (editandoId) {
      dados.atualizadoEm = f.serverTimestamp();
      dados.atualizadoPor = usuarioAtual.email;
      p = f.updateDoc(f.doc(f.db,'ocorrencias',editandoId), dados);
    } else {
      dados.criadoEm = f.serverTimestamp();
      dados.criadoPor = usuarioAtual.email;
      p = f.addDoc(f.collection(f.db,'ocorrencias'), dados);
    }
    p.then(function(){
      toast(editandoId ? 'Ocorrência atualizada.' : 'Ocorrência registrada.', 'ok');
      editandoId = null;
      irPara('listagem');
    }).catch(function(err){
      toast('Erro: ' + err.message, 'err');
    }).finally(function(){
      btn.disabled = false;
      btn.innerHTML = '💾 Salvar Ocorrência';
    });
  });
}

function editarOcorrencia(id) {
  var o = ocorrencias.find(function(x){ return x.id===id; });
  if (!o) return;
  editandoId = id;
  preencherForm(o);
  document.getElementById('form-titulo').textContent = 'Editar Ocorrência';
  document.getElementById('form-sub').textContent = 'Modifique os campos e salve';
  document.getElementById('btn-salvar').innerHTML = '💾 Atualizar Ocorrência';
  irPara('nova');
}

// ── VISUALIZAÇÃO ──────────────────────────────────────────────────
function verOcorrencia(id) {
  var o = ocorrencias.find(function(x){ return x.id===id; });
  if (!o) return;
  document.getElementById('modal-titulo').textContent = o.fato || 'Ocorrência';
  document.getElementById('modal-corpo').innerHTML = '<div class="report-view">' + gerarTexto(o) + '</div>';
  document.getElementById('modal-actions').innerHTML =
    '<button class="btn btn-g" onclick="fecharModal()">Fechar</button>' +
    '<button class="btn btn-w" onclick="exportarPDF(\''+id+'\')">📄 PDF</button>' +
    '<button class="btn btn-p" onclick="fecharModal();editarOcorrencia(\''+id+'\')">✏️ Editar</button>';
  document.getElementById('modal-bg').classList.add('aberto');
}

function fecharModal() {
  document.getElementById('modal-bg').classList.remove('aberto');
}

// ── PDF ───────────────────────────────────────────────────────────
function exportarPDF(id) {
  var o = ocorrencias.find(function(x){ return x.id===id; });
  if (!o) return;
  var jsPDF = window.jspdf.jsPDF;
  var pdf = new jsPDF({orientation:'p',unit:'mm',format:'a4'});
  var marg=18, larg=210-marg*2, y=20;
  pdf.setFontSize(10); pdf.setFont('helvetica','bold');
  pdf.text('SIGROP — RELATÓRIO DE OCORRÊNCIA POLICIAL',105,y,{align:'center'}); y+=7;
  pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(100);
  pdf.text('3º Batalhão de Polícia Rodoviária — PM/SP',105,y,{align:'center'});
  pdf.setTextColor(0); y+=8; pdf.line(marg,y,210-marg,y); y+=6;
  var catLabel={transito:'Sinistro de Trânsito',criminal:'Criminal',manifestacao:'Manifestação',interdicao:'Interdição de Rodovia'};
  var rows=[
    ['Natureza do Fato',o.fato],['Ambiente',o.ambiente],['Data',fmtData(o.data)],
    ['Horário do Fato',o.horaFato],['Efetivo Empenhado',o.efetivo],
    ['Rodovia',o.rodovia],['KM',o.km],['Metros',o.metros],['Pista',o.pista],
    ['Município',o.municipio],['Locais de Socorro',o.socorro],
    ['Btl',o.btl],['Cia',o.cia],['Pel',o.pel],
    ['Tempo de Resposta',o.tempoResp],['DP',o.dp],
    ['Categoria',catLabel[o.categoria||'transito']],
  ];
  var cat = o.categoria||'transito';
  if(cat==='transito') rows=rows.concat([['Vítimas Fatais',o.tFatais],['Vítimas Graves',o.tGraves],['Vítimas Leves',o.tLeves],['AP',o.tAP],['Moto',o.tMoto],['CA',o.tCA],['OA',o.tOA],['Outros Veículos',o.tOutros],['Pista',o.tPista],['Tempo',o.tTempo],['Pavimento',o.tPavimento],['Tipo de Sinistro',o.tTipo],['Vítimas em Óbito',o.tObito]]);
  if(cat==='criminal') rows=rows.concat([['Qtd. Vítimas',o.cVitimas],['AP',o.cAP],['Moto',o.cMoto],['CA',o.cCA],['OA',o.cOA],['Outros Veículos',o.cOutros],['Apreendidos',o.cApreendidos],['Subtraídos',o.cSubtraidos],['Pessoas Presas',o.cPressos],['Armas/Munição',o.cArmas]]);
  if(cat==='manifestacao') rows=rows.concat([['Qtd. Manifestantes',o.mQtd],['Responsável',o.mResp],['Motivo',o.mMotivo],['Rodovia Interditada',o.mInterdicao]]);
  if(cat==='interdicao') rows=rows.concat([['Motivo da Interdição',o.iMotivo],['Km Congestionamento',o.iKm]]);
  rows=rows.concat([['CMT CPRv',o.cmtCprv],['CMT BPRv',o.cmtBprv],['CMT CIA Rv',o.cmtCia],['PPRI',o.ppri],['Token',o.token],['BO/PC',o.bopc],['Autoridades no Local',o.autLocal],['Autoridades Cientificadas',o.autCient],['Status',o.status]]);
  pdf.setFontSize(9);
  rows.forEach(function(r){
    if(!r[1]||r[1]==='0') return;
    pdf.setFont('helvetica','bold'); pdf.text(r[0]+':',marg,y);
    pdf.setFont('helvetica','normal');
    var linhas=pdf.splitTextToSize(String(r[1]),larg-54);
    pdf.text(linhas,marg+56,y);
    y+=linhas.length*5+2;
    if(y>270){pdf.addPage();y=20;}
  });
  if(o.equipes&&o.equipes.length){
    y+=2;pdf.line(marg,y,210-marg,y);y+=6;
    pdf.setFont('helvetica','bold');pdf.text('Equipes:',marg,y);y+=6;
    pdf.setFont('helvetica','normal');
    o.equipes.forEach(function(eq,i){
      var txt='Equipe '+(i+1)+': VTR '+(eq.vtr||'—')+' | Enc: '+(eq.enc||'—')+' | Aux1: '+(eq.a1||'—')+' | Aux2: '+(eq.a2||'—')+' | Aux3: '+(eq.a3||'—')+' | Aux4: '+(eq.a4||'—');
      var linhas=pdf.splitTextToSize(txt,larg);
      pdf.text(linhas,marg,y);y+=linhas.length*5+2;
      if(y>270){pdf.addPage();y=20;}
    });
  }
  if(o.historico){
    y+=2;pdf.line(marg,y,210-marg,y);y+=6;
    pdf.setFont('helvetica','bold');pdf.text('Histórico:',marg,y);y+=6;
    pdf.setFont('helvetica','normal');
    pdf.splitTextToSize(o.historico,larg).forEach(function(l){
      pdf.text(l,marg,y);y+=5;if(y>270){pdf.addPage();y=20;}
    });
  }
  y+=6;pdf.line(marg,y,210-marg,y);y+=5;
  pdf.setFontSize(7);pdf.setTextColor(120);
  pdf.text('Gerado em '+new Date().toLocaleString('pt-BR')+' por '+(usuarioAtual?usuarioAtual.email:'—')+' — SIGROP v1.3',105,y,{align:'center'});
  pdf.save('SIGROP_'+(o.fato||'oc').replace(/\s+/g,'_')+'_'+(o.data||'sd')+'.pdf');
  toast('PDF exportado.','ok');
}

// ── TEXTO RELATÓRIO ───────────────────────────────────────────────
function gerarTexto(o) {
  var l = function(label,val){ return (val&&val!=='0') ? '<strong>'+label+':</strong> '+val+'\n' : ''; };
  var catLabel={transito:'🚗 Sinistro de Trânsito',criminal:'⚖️ Criminal',manifestacao:'📢 Manifestação',interdicao:'🚧 Interdição'};
  var txt = l('Natureza do Fato',o.fato)+l('Ambiente',o.ambiente)+l('Data',fmtData(o.data))+
    l('Horário do Fato',o.horaFato)+l('Efetivo Empenhado',o.efetivo)+
    l('Rodovia',o.rodovia)+l('KM',o.km)+l('Metros',o.metros)+l('Pista',o.pista)+
    l('Município',o.municipio)+l('Locais de Socorro',o.socorro)+
    l('Btl',o.btl)+l('Cia',o.cia)+l('Pel',o.pel)+l('Tempo de Resposta',o.tempoResp)+l('DP',o.dp)+'\n'+
    '<strong>— '+catLabel[o.categoria||'transito']+' —</strong>\n';
  var cat=o.categoria||'transito';
  if(cat==='transito') txt+=l('Vítimas Fatais',o.tFatais)+l('Vítimas Graves',o.tGraves)+l('Vítimas Leves',o.tLeves)+l('AP',o.tAP)+l('Moto',o.tMoto)+l('CA',o.tCA)+l('OA',o.tOA)+l('Outros Veíc.',o.tOutros)+l('Pista',o.tPista)+l('Tempo',o.tTempo)+l('Pavimento',o.tPavimento)+l('Tipo de Sinistro',o.tTipo)+l('Vítimas em Óbito',o.tObito);
  if(cat==='criminal') txt+=l('Qtd. Vítimas',o.cVitimas)+l('AP',o.cAP)+l('Moto',o.cMoto)+l('CA',o.cCA)+l('OA',o.cOA)+l('Outros Veíc.',o.cOutros)+l('Apreendidos',o.cApreendidos)+l('Subtraídos',o.cSubtraidos)+l('Pessoas Presas',o.cPressos)+l('Armas/Munição',o.cArmas);
  if(cat==='manifestacao') txt+=l('Qtd. Manifestantes',o.mQtd)+l('Responsável',o.mResp)+l('Motivo',o.mMotivo)+l('Rodovia Interditada',o.mInterdicao);
  if(cat==='interdicao') txt+=l('Motivo da Interdição',o.iMotivo)+l('Km Congestionamento',o.iKm);
  if(o.equipes&&o.equipes.length){
    txt+='\n<strong>— Equipes —</strong>\n';
    o.equipes.forEach(function(eq,i){txt+='Equipe '+(i+1)+': VTR '+(eq.vtr||'—')+' | Enc: '+(eq.enc||'—')+' | Aux1: '+(eq.a1||'—')+' | Aux2: '+(eq.a2||'—')+' | Aux3: '+(eq.a3||'—')+' | Aux4: '+(eq.a4||'—')+'\n';});
  }
  txt+='\n'+l('CMT CPRv',o.cmtCprv)+l('CMT BPRv',o.cmtBprv)+l('CMT CIA Rv',o.cmtCia)+
    l('PPRI',o.ppri)+l('Token',o.token)+l('BO/PC',o.bopc)+'\n'+
    l('Histórico',o.historico)+'\n'+
    l('Autoridades no Local',o.autLocal)+l('Autoridades Cientificadas',o.autCient)+l('Status',o.status);
  return txt;
}

// ── ADMIN ─────────────────────────────────────────────────────────
function buildAdmin() {
  var div = document.getElementById('admin-conteudo');
  if (!div) return;
  div.innerHTML = '';
  COLECOES.forEach(function(c){
    div.innerHTML +=
      '<div class="admin-sec">' +
        '<h3>'+c.label+'</h3>' +
        '<div style="display:flex;gap:8px;margin-bottom:13px">' +
          '<input type="text" id="inp-'+c.id+'" placeholder="Novo item…" style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);color:var(--txt);padding:9px 12px;font-size:13px;outline:none">' +
          '<button class="btn btn-s btn-sm" onclick="addItem(\''+c.id+'\')">+ Adicionar</button>' +
        '</div>' +
        '<ul class="list-admin" id="lista-'+c.id+'"><li style="color:var(--txt3)">Carregando…</li></ul>' +
      '</div>';
  });
}

function renderAdminLista(colId) {
  var ul = document.getElementById('lista-'+colId);
  if (!ul) return;
  var col = COLECOES.find(function(c){ return c.id===colId; });
  var lista = col ? col.dados() : [];
  ul.innerHTML = '';
  if (!lista.length) { ul.innerHTML = '<li style="color:var(--txt3)">Nenhum item.</li>'; return; }
  lista.forEach(function(item){
    var li = document.createElement('li');
    if (item.ativo===false) li.classList.add('inativo');
    li.innerHTML =
      '<span>'+item.nome+'</span>' +
      '<div class="acoes">' +
        '<button class="btn btn-g btn-sm" onclick="toggleItem(\''+colId+'\',\''+item.id+'\','+(item.ativo!==false)+')">'+(item.ativo===false?'Ativar':'Inibir')+'</button>' +
        '<button class="btn btn-d btn-sm" onclick="excluirItem(\''+colId+'\',\''+item.id+'\')">Excluir</button>' +
      '</div>';
    ul.appendChild(li);
  });
}

function addItem(colId) {
  var inp = document.getElementById('inp-'+colId);
  var nome = inp.value.trim();
  if (!nome) return;
  fb(function(f){
    f.addDoc(f.collection(f.db,colId), {nome:nome, ativo:true, criadoEm:f.serverTimestamp()})
      .then(function(){ inp.value=''; toast('Item adicionado.','ok'); })
      .catch(function(e){ toast('Erro: '+e.message,'err'); });
  });
}

function toggleItem(colId, id, ativo) {
  fb(function(f){ f.updateDoc(f.doc(f.db,colId,id), {ativo:!ativo}); });
}

function excluirItem(colId, id) {
  if (!confirm('Excluir permanentemente este item?')) return;
  fb(function(f){ f.deleteDoc(f.doc(f.db,colId,id)).then(function(){ toast('Item excluído.','ok'); }); });
}

// ── UTILITÁRIOS ───────────────────────────────────────────────────
function gv(id) { var el=document.getElementById(id); return el?el.value:''; }
function sv(id,val) { var el=document.getElementById(id); if(el) el.value=val||''; }
function fmtData(d) { if(!d) return '—'; var p=d.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function toast(msg,tipo) {
  var t=document.getElementById('toast');
  t.textContent=msg; t.className='show '+(tipo||'ok');
  setTimeout(function(){ t.className=''; },3500);
}

// Fechar modal clicando fora
document.getElementById('modal-bg').addEventListener('click', function(e){
  if (e.target===this) fecharModal();
});
// Enter no login
document.addEventListener('keydown', function(e){
  if (e.key==='Enter' && document.getElementById('screen-login').style.display!=='none') fazerLogin();
});

// Expor funções globais (necessário por causa do Firebase module)
window.fazerLogin       = fazerLogin;
window.fazerLogout      = fazerLogout;
window.irPara           = irPara;
window.selCat           = selCat;
window.addEquipe        = addEquipe;
window.rmEquipe         = rmEquipe;
window.salvarOcorrencia = salvarOcorrencia;
window.editarOcorrencia = editarOcorrencia;
window.verOcorrencia    = verOcorrencia;
window.fecharModal      = fecharModal;
window.exportarPDF      = exportarPDF;
window.filtrarOcorrencias = filtrarOcorrencias;
window.addItem          = addItem;
window.toggleItem       = toggleItem;
window.excluirItem      = excluirItem;
