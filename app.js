/* SIGROP — Lógica da aplicação */

let ocorrencias=[],fatos=[],btls=[],cias=[],pels=[],rodovias=[],cmtsCprv=[],cmtsBprv=[],cmtsCia=[];
let usuarioAtual=null,isAdmin=false,editandoId=null,categoriaAtual='transito',equipeCount=0;
const ADMINS=['ejmurta@gmail.com'];

const COLECOES_ADMIN=[
  {id:'fatos',  label:'📋 Natureza do Fato',  sel:'f-fato',    lista:()=>fatos},
  {id:'rodovias',label:'🛣️ SP/SPA/SPI/SPD',  sel:'f-rodovia', lista:()=>rodovias},
  {id:'btls',   label:'🏛️ Btl',              sel:'f-btl',     lista:()=>btls},
  {id:'cias',   label:'🏛️ Cia',              sel:'f-cia',     lista:()=>cias},
  {id:'pels',   label:'🏛️ Pel',              sel:'f-pel',     lista:()=>pels},
  {id:'cmtsCprv',label:'👤 CMT CPRv',         sel:'f-cmt-cpa', lista:()=>cmtsCprv},
  {id:'cmtsBprv',label:'👤 CMT BPRv',         sel:'f-cmt-btl', lista:()=>cmtsBprv},
  {id:'cmtsCia', label:'👤 CMT CIA Rv',        sel:'f-cmt-cia-int',lista:()=>cmtsCia},
];

function waitFirebase(cb){if(window._sigrop)cb(window._sigrop);else setTimeout(()=>waitFirebase(cb),100)}

async function fazerLogin(){
  const email=document.getElementById('login-email').value.trim();
  const senha=document.getElementById('login-senha').value;
  const err=document.getElementById('login-error');
  const txt=document.getElementById('btn-login-txt');
  err.textContent='';txt.innerHTML='<span class="spinner"></span> Autenticando…';
  waitFirebase(async({auth,signInWithEmailAndPassword})=>{
    try{await signInWithEmailAndPassword(auth,email,senha);}
    catch(e){err.textContent=traduzirErroAuth(e.code);txt.textContent='Acessar Sistema';}
  });
}
function traduzirErroAuth(code){
  const m={'auth/user-not-found':'Usuário não encontrado.','auth/wrong-password':'Senha incorreta.',
    'auth/invalid-email':'E-mail inválido.','auth/too-many-requests':'Muitas tentativas.',
    'auth/invalid-credential':'Credenciais inválidas.'};
  return m[code]||'Erro ao autenticar.';
}
async function fazerLogout(){waitFirebase(({auth,signOut})=>signOut(auth));}

waitFirebase(({auth,onAuthStateChanged})=>{
  onAuthStateChanged(auth,user=>{
    if(user){
      usuarioAtual=user;
      isAdmin=ADMINS.includes(user.email);
      document.getElementById('user-unit').textContent=user.email;
      if(isAdmin)document.getElementById('tab-admin').style.display='flex';
      document.getElementById('screen-login').style.display='none';
      document.getElementById('screen-app').style.display='block';
      inicializar();
    }else{
      usuarioAtual=null;
      document.getElementById('screen-login').style.display='flex';
      document.getElementById('screen-app').style.display='none';
    }
  });
});

function inicializar(){
  irPara('listagem');
  COLECOES_ADMIN.forEach(c=>ouvirColecao(c.id));
  ouvirOcorrencias();
  document.getElementById('f-data').valueAsDate=new Date();
  construirAdminSections();
}

function ouvirColecao(nome){
  waitFirebase(({db,collection,onSnapshot,query,orderBy})=>{
    const q=query(collection(db,nome),orderBy('nome'));
    onSnapshot(q,snap=>{
      const dados=snap.docs.map(d=>(({id:d.id,...d.data()})));
      if(nome==='fatos')fatos=dados;
      else if(nome==='rodovias')rodovias=dados;
      else if(nome==='btls')btls=dados;
      else if(nome==='cias')cias=dados;
      else if(nome==='pels')pels=dados;
      else if(nome==='cmtsCprv')cmtsCprv=dados;
      else if(nome==='cmtsBprv')cmtsBprv=dados;
      else if(nome==='cmtsCia')cmtsCia=dados;
      const col=COLECOES_ADMIN.find(c=>c.id===nome);
      if(col){
        renderSelect(col.sel,col.lista());
        renderAdminLista(nome);
      }
    });
  });
}

function renderSelect(elId,lista){
  const sel=document.getElementById(elId);if(!sel)return;
  const val=sel.value;
  const primeiro=sel.options[0];
  sel.innerHTML='';
  sel.appendChild(primeiro);
  lista.filter(i=>i.ativo!==false).forEach(i=>{
    const o=document.createElement('option');
    o.value=i.nome;o.textContent=i.nome;sel.appendChild(o);
  });
  sel.value=val;
}

function construirAdminSections(){
  const div=document.getElementById('admin-sections');
  div.innerHTML='';
  COLECOES_ADMIN.forEach(c=>{
    div.innerHTML+=`
    <div class="admin-section">
      <h3>${c.label}</h3>
      <div style="display:flex;gap:8px;margin-bottom:13px">
        <input type="text" id="inp-${c.id}" placeholder="Novo item…"
          style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--txt);padding:9px 12px;font-size:13px;outline:none">
        <button class="btn btn-success btn-sm" onclick="adicionarItem('${c.id}')">+ Adicionar</button>
      </div>
      <ul class="list-manage" id="lista-${c.id}"><li style="color:var(--txt3)">Carregando…</li></ul>
    </div>`;
  });
}

function renderAdminLista(colecao){
  const ul=document.getElementById('lista-'+colecao);if(!ul)return;
  const col=COLECOES_ADMIN.find(c=>c.id===colecao);
  const lista=col?col.lista():[];
  ul.innerHTML='';
  if(!lista.length){ul.innerHTML='<li style="color:var(--txt3)">Nenhum item.</li>';return;}
  lista.forEach(f=>{
    const li=document.createElement('li');
    if(f.ativo===false)li.classList.add('inativo');
    li.innerHTML=`<span>${f.nome}</span>
      <div class="actions">
        <button class="btn btn-ghost btn-sm" onclick="toggleItem('${colecao}','${f.id}',${f.ativo!==false})">${f.ativo===false?'Ativar':'Inibir'}</button>
        <button class="btn btn-danger btn-sm" onclick="excluirItem('${colecao}','${f.id}')">Excluir</button>
      </div>`;
    ul.appendChild(li);
  });
}

async function adicionarItem(colecao){
  const inp=document.getElementById('inp-'+colecao);
  const nome=inp.value.trim();if(!nome)return;
  waitFirebase(async({db,collection,addDoc,serverTimestamp})=>{
    await addDoc(collection(db,colecao),{nome,ativo:true,criadoEm:serverTimestamp()});
    inp.value='';toast('Item adicionado.','ok');
  });
}
function toggleItem(colecao,id,ativo){
  waitFirebase(({db,doc,updateDoc})=>updateDoc(doc(db,colecao,id),{ativo:!ativo}));
}
function excluirItem(colecao,id){
  if(!confirm('Excluir permanentemente?'))return;
  waitFirebase(({db,doc,deleteDoc})=>{deleteDoc(doc(db,colecao,id));toast('Item excluído.','ok');});
}

// EQUIPES
function adicionarEquipe(){
  equipeCount++;
  const n=equipeCount;
  const c=document.getElementById('equipes-container');
  const div=document.createElement('div');
  div.className='equipe-card';
  div.id='equipe-'+n;
  div.innerHTML=`
    <div class="equipe-header">
      <span class="equipe-titulo">Equipe ${n}</span>
      <button type="button" class="btn btn-danger btn-sm" onclick="removerEquipe(${n})">✕ Remover</button>
    </div>
    <div class="equipe-grid">
      <div class="field-group"><label>VTR</label><input type="text" id="eq${n}-vtr" placeholder="Ex: R-03128"></div>
      <div class="field-group"><label>Encarregado</label><input type="text" id="eq${n}-enc" placeholder="Cb PM Nome"></div>
      <div class="field-group"><label>Auxiliar 1</label><input type="text" id="eq${n}-aux1" placeholder="Sd PM Nome"></div>
      <div class="field-group"><label>Auxiliar 2</label><input type="text" id="eq${n}-aux2" placeholder="Sd PM Nome"></div>
      <div class="field-group"><label>Auxiliar 3</label><input type="text" id="eq${n}-aux3" placeholder="Sd PM Nome"></div>
      <div class="field-group"><label>Auxiliar 4</label><input type="text" id="eq${n}-aux4" placeholder="Sd PM Nome"></div>
    </div>`;
  c.appendChild(div);
}
function removerEquipe(n){
  const el=document.getElementById('equipe-'+n);
  if(el)el.remove();
}
function coletarEquipes(){
  const equipes=[];
  document.querySelectorAll('.equipe-card').forEach(card=>{
    const n=card.id.replace('equipe-','');
    const vtr=gv('eq'+n+'-vtr'),enc=gv('eq'+n+'-enc');
    const aux1=gv('eq'+n+'-aux1'),aux2=gv('eq'+n+'-aux2'),aux3=gv('eq'+n+'-aux3'),aux4=gv('eq'+n+'-aux4');
    equipes.push({vtr,enc,aux1,aux2,aux3,aux4});
  });
  return equipes;
}
function preencherEquipes(equipes){
  document.getElementById('equipes-container').innerHTML='';
  equipeCount=0;
  if(!equipes||!equipes.length)return;
  equipes.forEach(eq=>{
    adicionarEquipe();
    const n=equipeCount;
    sv('eq'+n+'-vtr',eq.vtr);sv('eq'+n+'-enc',eq.enc);
    sv('eq'+n+'-aux1',eq.aux1);sv('eq'+n+'-aux2',eq.aux2);
    sv('eq'+n+'-aux3',eq.aux3);sv('eq'+n+'-aux4',eq.aux4);
  });
}

// OCORRÊNCIAS
function ouvirOcorrencias(){
  waitFirebase(({db,collection,onSnapshot,query,orderBy})=>{
    const q=query(collection(db,'ocorrencias'),orderBy('criadoEm','desc'));
    onSnapshot(q,snap=>{
      ocorrencias=snap.docs.map(d=>(({id:d.id,...d.data()})));
      renderTabela(ocorrencias);atualizarStats();
    });
  });
}

function atualizarStats(){
  document.getElementById('stat-total').textContent=ocorrencias.length;
  document.getElementById('stat-andamento').textContent=ocorrencias.filter(o=>o.status==='Em andamento').length;
  const hoje=new Date().toISOString().split('T')[0];
  document.getElementById('stat-hoje').textContent=ocorrencias.filter(o=>o.data===hoje).length;
}

function renderTabela(lista){
  const tbody=document.getElementById('tabela-ocorrencias');
  if(!lista.length){tbody.innerHTML=`<tr><td colspan="6"><div class="empty"><div class="icon">📄</div><p>Nenhuma ocorrência.</p></div></td></tr>`;return;}
  const rod=(o)=>o.rodovia?(o.rodovia+(o.km?' KM '+o.km:'')):o.municipio||'—';
  tbody.innerHTML=lista.map(o=>`
    <tr>
      <td style="font-family:'Courier New',monospace;white-space:nowrap">${fmtData(o.data)}</td>
      <td>${o.fato||'—'}</td><td>${o.municipio||'—'}</td>
      <td style="white-space:nowrap">${rod(o)}</td>
      <td><span class="badge badge-${slugStatus(o.status)}">${o.status||'—'}</span></td>
      <td><div style="display:flex;gap:5px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="verOcorrencia('${o.id}')">👁</button>
        <button class="btn btn-ghost btn-sm" onclick="editarOcorrencia('${o.id}')">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="exportarPDF('${o.id}')">📄</button>
      </div></td>
    </tr>`).join('');
}

function filtrarOcorrencias(){
  const busca=document.getElementById('filtro-busca').value.toLowerCase();
  const status=document.getElementById('filtro-status').value;
  renderTabela(ocorrencias.filter(o=>{
    const txt=[o.fato,o.municipio,o.rodovia,o.historico].join(' ').toLowerCase();
    return(!busca||txt.includes(busca))&&(!status||o.status===status);
  }));
}

function irPara(tela){
  ['listagem','nova','admin'].forEach(function(t){
    var el=document.getElementById('pg-'+t);
    if(el) el.style.display='none';
  });
  document.querySelectorAll('.nav-tab').forEach(function(t){t.classList.remove('active');});
  var pg=document.getElementById('pg-'+tela);
  if(pg) pg.style.display='block';
  var tab=document.getElementById('tab-'+tela);
  if(tab) tab.classList.add('active');
  if(tela==='nova'&&!editandoId){
    limparFormulario();
    document.getElementById('form-titulo').textContent='Nova Ocorrência';
    document.getElementById('form-subtitulo').textContent='Preencha os campos obrigatórios';
    document.getElementById('btn-salvar').innerHTML='💾 Salvar Ocorrência';
  }
  window.scrollTo(0,0);
}
function selecionarCategoria(cat,el){
  categoriaAtual=cat;
  document.querySelectorAll('.cat-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.cat-panel').forEach(p=>p.classList.remove('active'));
  if(el)el.classList.add('active');
  document.getElementById('panel-'+cat).classList.add('active');
}

async function salvarOcorrencia(e){
  e.preventDefault();
  const btn=document.getElementById('btn-salvar');
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Salvando…';
  const dados=coletarDados();
  waitFirebase(async({db,collection,addDoc,doc,updateDoc,serverTimestamp})=>{
    try{
      if(editandoId){
        await updateDoc(doc(db,'ocorrencias',editandoId),{...dados,atualizadoEm:serverTimestamp(),atualizadoPor:usuarioAtual.email});
        toast('Ocorrência atualizada.','ok');
      }else{
        await addDoc(collection(db,'ocorrencias'),{...dados,criadoEm:serverTimestamp(),criadoPor:usuarioAtual.email});
        toast('Ocorrência registrada.','ok');
      }
      editandoId=null;irPara('listagem');
    }catch(err){toast('Erro: '+err.message,'err');}
    finally{btn.disabled=false;btn.innerHTML='💾 Salvar Ocorrência';}
  });
}

function coletarDados(){
  return{
    fato:gv('f-fato'),ambiente:gv('f-ambiente'),data:gv('f-data'),
    tempoResposta:gv('f-tempo-resposta'),efetivo:gv('f-efetivo'),
    rodovia:gv('f-rodovia'),km:gv('f-km'),metros:gv('f-metros'),pista:gv('f-pista'),
    municipio:gv('f-municipio'),socorro:gv('f-socorro'),
    btl:gv('f-btl'),cia:gv('f-cia'),pel:gv('f-pel'),
    horario:gv('f-horario'),dp:gv('f-dp'),
    equipes:coletarEquipes(),
    categoria:categoriaAtual,
    tFatais:gv('f-t-fatais'),tGraves:gv('f-t-graves'),tLeves:gv('f-t-leves'),
    tAP:gv('f-t-ap'),tMoto:gv('f-t-moto'),tCA:gv('f-t-ca'),tOA:gv('f-t-oa'),tOutrosVeic:gv('f-t-outros-veic'),
    tPistaCond:gv('f-t-pista-cond'),tTempo:gv('f-t-tempo'),tPavimento:gv('f-t-pavimento'),
    tTipoSinistro:gv('f-t-tipo-sinistro'),tObito:gv('f-t-obito'),
    cVitimasQtd:gv('f-c-vitimas-qtd'),
    cAP:gv('f-c-ap'),cMoto:gv('f-c-moto'),cCA:gv('f-c-ca'),cOA:gv('f-c-oa'),cOutrosVeic:gv('f-c-outros-veic'),
    cApreendidos:gv('f-c-apreendidos'),cSubtraidos:gv('f-c-subtraidos'),cPressos:gv('f-c-presos'),cArmas:gv('f-c-armas'),
    
    mManifestantes:gv('f-m-manifestantes'),mMotivo:gv('f-m-motivo'),mResponsavel:gv('f-m-responsavel'),mInterdicao:gv('f-m-interdicao'),
    iMotivo:gv('f-i-motivo'),iKm:gv('f-i-km'),
    cmtCpa:gv('f-cmt-cpa'),cmtBtl:gv('f-cmt-btl'),cmtCiaInt:gv('f-cmt-cia-int'),
    ppri:gv('f-ppri'),token:gv('f-token'),bopc:gv('f-bopc'),
    historico:gv('f-historico'),
    autoridadesLocal:gv('f-autoridades-local'),autoridadesCient:gv('f-autoridades-cient'),
    status:gv('f-status'),
  };
}

function preencherFormulario(o){
  sv('f-fato',o.fato);sv('f-ambiente',o.ambiente);sv('f-data',o.data);
  sv('f-tempo-resposta',o.tempoResposta);sv('f-efetivo',o.efetivo);
  sv('f-rodovia',o.rodovia);sv('f-km',o.km);sv('f-metros',o.metros);sv('f-pista',o.pista);
  sv('f-municipio',o.municipio);sv('f-socorro',o.socorro);
  sv('f-btl',o.btl);sv('f-cia',o.cia);sv('f-pel',o.pel);
  sv('f-horario',o.horario);sv('f-dp',o.dp);
  preencherEquipes(o.equipes||[]);
  const cat=o.categoria||'transito';categoriaAtual=cat;
  const cats=['transito','criminal','manifestacao','interdicao'];
  document.querySelectorAll('.cat-tab').forEach((t,i)=>t.classList.toggle('active',cats[i]===cat));
  document.querySelectorAll('.cat-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel-'+cat).classList.add('active');
  sv('f-t-fatais',o.tFatais);sv('f-t-graves',o.tGraves);sv('f-t-leves',o.tLeves);
  sv('f-t-ap',o.tAP);sv('f-t-moto',o.tMoto);sv('f-t-ca',o.tCA);sv('f-t-oa',o.tOA);sv('f-t-outros-veic',o.tOutrosVeic);
  sv('f-t-pista-cond',o.tPistaCond);sv('f-t-tempo',o.tTempo);sv('f-t-pavimento',o.tPavimento);
  sv('f-t-tipo-sinistro',o.tTipoSinistro);sv('f-t-obito',o.tObito);
  sv('f-c-vitimas-qtd',o.cVitimasQtd);
  sv('f-c-ap',o.cAP);sv('f-c-moto',o.cMoto);sv('f-c-ca',o.cCA);sv('f-c-oa',o.cOA);sv('f-c-outros-veic',o.cOutrosVeic);
  sv('f-c-apreendidos',o.cApreendidos);sv('f-c-subtraidos',o.cSubtraidos);sv('f-c-presos',o.cPressos);sv('f-c-armas',o.cArmas);
  
  sv('f-m-manifestantes',o.mManifestantes);sv('f-m-motivo',o.mMotivo);sv('f-m-responsavel',o.mResponsavel);sv('f-m-interdicao',o.mInterdicao);
  sv('f-i-motivo',o.iMotivo);sv('f-i-km',o.iKm);
  sv('f-cmt-cpa',o.cmtCpa);sv('f-cmt-btl',o.cmtBtl);sv('f-cmt-cia-int',o.cmtCiaInt);
  sv('f-ppri',o.ppri);sv('f-token',o.token);sv('f-bopc',o.bopc);
  sv('f-historico',o.historico);
  sv('f-autoridades-local',o.autoridadesLocal);sv('f-autoridades-cient',o.autoridadesCient);
  sv('f-status',o.status);
}

function limparFormulario(){
  document.getElementById('form-ocorrencia').reset();
  document.getElementById('f-data').valueAsDate=new Date();
  document.getElementById('equipes-container').innerHTML='';
  equipeCount=0;editandoId=null;
  selecionarCategoria('transito',document.querySelector('.cat-tab'));
}

function editarOcorrencia(id){
  const o=ocorrencias.find(x=>x.id===id);if(!o)return;
  editandoId=id;preencherFormulario(o);
  document.getElementById('form-titulo').textContent='Editar Ocorrência';
  document.getElementById('form-subtitulo').textContent='Modifique os campos e salve';
  document.getElementById('btn-salvar').innerHTML='💾 Atualizar Ocorrência';
  irPara('nova');
}

function verOcorrencia(id){
  const o=ocorrencias.find(x=>x.id===id);if(!o)return;
  document.getElementById('modal-titulo').textContent=o.fato||'Ocorrência';
  document.getElementById('modal-body').innerHTML=`<div class="report-view">${gerarTextoRelatorio(o)}</div>`;
  document.getElementById('modal-actions').innerHTML=`
    <button class="btn btn-ghost" onclick="fecharModal()">Fechar</button>
    <button class="btn btn-warn" onclick="exportarPDF('${id}')">📄 PDF</button>
    <button class="btn btn-primary" onclick="fecharModal();editarOcorrencia('${id}')">✏️ Editar</button>`;
  document.getElementById('modal-backdrop').classList.add('open');
}
function fecharModal(){document.getElementById('modal-backdrop').classList.remove('open');}

function exportarPDF(id){
  const o=ocorrencias.find(x=>x.id===id);if(!o)return;
  const{jsPDF}=window.jspdf;
  const pdf=new jsPDF({orientation:'p',unit:'mm',format:'a4'});
  const marg=18,larg=210-marg*2;let y=20;
  pdf.setFontSize(10);pdf.setFont('helvetica','bold');
  pdf.text('SIGROP — RELATÓRIO DE OCORRÊNCIA POLICIAL',105,y,{align:'center'});y+=7;
  pdf.setFontSize(8);pdf.setFont('helvetica','normal');pdf.setTextColor(100);
  pdf.text('Sistema de Gestão de Relatórios de Ocorrências Policiais — 3º BPRv',105,y,{align:'center'});
  pdf.setTextColor(0);y+=8;pdf.line(marg,y,210-marg,y);y+=6;
  const catLabel={transito:'Sinistro de Trânsito',criminal:'Criminal',manifestacao:'Manifestação',interdicao:'Interdição de Rodovia'};
  const rows=[
    ['Natureza do Fato',o.fato],['Ambiente',o.ambiente],['Data',fmtData(o.data)],
    ['Horário do Fato',o.tempoResposta],['Efetivo Empenhado',o.efetivo],
    ['Rodovia',o.rodovia],['KM',o.km],['Metros',o.metros],['Pista',o.pista],
    ['Município',o.municipio],['Locais de Socorro',o.socorro],
    ['Btl',o.btl],['Cia',o.cia],['Pel',o.pel],
    ['Tempo de Resposta',o.horario],['DP',o.dp],
    ['Categoria',catLabel[o.categoria||'transito']],
  ];
  if((o.categoria||'transito')==='transito')rows.push(
    ['Vítimas Fatais',o.tFatais],['Vítimas Graves',o.tGraves],['Vítimas Leves',o.tLeves],
    ['AP',o.tAP],['Moto',o.tMoto],['CA',o.tCA],['OA',o.tOA],['Outros Veículos',o.tOutrosVeic],
    ['Pista',o.tPistaCond],['Tempo',o.tTempo],['Pavimento',o.tPavimento],
    ['Tipo de Sinistro',o.tTipoSinistro],['Vítimas em Óbito',o.tObito]);
  else if(o.categoria==='criminal')rows.push(
    ['Qtd. Vítimas',o.cVitimasQtd],
    ['AP',o.cAP],['Moto',o.cMoto],['CA',o.cCA],['OA',o.cOA],['Outros Veículos',o.cOutrosVeic],
    ['Apreendidos',o.cApreendidos],['Subtraídos',o.cSubtraidos],['Pessoas Presas',o.cPressos],['Armas/Munição',o.cArmas]);
  else if(o.categoria==='manifestacao')rows.push(
    
    ['Manifestantes',o.mManifestantes],['Motivo',o.mMotivo],['Responsável',o.mResponsavel],['Rodovia Interditada',o.mInterdicao]);
  else if(o.categoria==='interdicao')rows.push(
    ['Motivo da Interdição',o.iMotivo],['Km de Congestionamento',o.iKm]);
  rows.push(
    ['CMT CPRv',o.cmtCpa],['CMT BPRv',o.cmtBtl],['CMT CIA Rv',o.cmtCiaInt],
    ['PPRI',o.ppri],['Token',o.token],['BO/PC',o.bopc],
    ['Autoridades no Local',o.autoridadesLocal],['Autoridades Cientificadas',o.autoridadesCient],
    ['Status',o.status]);
  pdf.setFontSize(9);
  rows.forEach(([label,val])=>{
    if(!val||val==='0')return;
    pdf.setFont('helvetica','bold');pdf.text(label+':',marg,y);
    pdf.setFont('helvetica','normal');
    const linhas=pdf.splitTextToSize(String(val),larg-54);
    pdf.text(linhas,marg+56,y);
    y+=linhas.length*5+2;
    if(y>270){pdf.addPage();y=20;}
  });
  if(o.equipes&&o.equipes.length){
    y+=2;pdf.line(marg,y,210-marg,y);y+=6;
    pdf.setFont('helvetica','bold');pdf.text('Equipes:',marg,y);y+=6;
    pdf.setFont('helvetica','normal');
    o.equipes.forEach((eq,i)=>{
      const txt=`Equipe ${i+1}: VTR ${eq.vtr||'—'} | Enc: ${eq.enc||'—'} | Aux1: ${eq.aux1||'—'} | Aux2: ${eq.aux2||'—'} | Aux3: ${eq.aux3||'—'} | Aux4: ${eq.aux4||'—'}`;
      const linhas=pdf.splitTextToSize(txt,larg);
      pdf.text(linhas,marg,y);y+=linhas.length*5+2;
      if(y>270){pdf.addPage();y=20;}
    });
  }
  if(o.historico){
    y+=2;pdf.line(marg,y,210-marg,y);y+=6;
    pdf.setFont('helvetica','bold');pdf.text('Histórico:',marg,y);y+=6;
    pdf.setFont('helvetica','normal');
    pdf.splitTextToSize(o.historico,larg).forEach(l=>{pdf.text(l,marg,y);y+=5;if(y>270){pdf.addPage();y=20;}});
  }
  y+=6;pdf.line(marg,y,210-marg,y);y+=5;
  pdf.setFontSize(7);pdf.setTextColor(120);
  pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')} por ${usuarioAtual?.email||'—'} — SIGROP v1.2`,105,y,{align:'center'});
  pdf.save(`SIGROP_${(o.fato||'oc').replace(/\s+/g,'_')}_${o.data||'sd'}.pdf`);
  toast('PDF exportado.','ok');
}

function gerarTextoRelatorio(o){
  const l=(label,val)=>(val&&val!=='0')?`<strong>${label}:</strong> ${val}\n`:'';
  const catLabel={transito:'🚗 Sinistro de Trânsito',criminal:'⚖️ Criminal',manifestacao:'📢 Manifestação',interdicao:'🚧 Interdição'};
  let txt=[
    l('Natureza do Fato',o.fato),l('Ambiente',o.ambiente),l('Data',fmtData(o.data)),
    l('Horário do Fato',o.tempoResposta),l('Efetivo Empenhado',o.efetivo),
    l('Rodovia',o.rodovia),l('KM',o.km),l('Metros',o.metros),l('Pista',o.pista),
    l('Município',o.municipio),l('Locais de Socorro',o.socorro),
    l('Btl',o.btl),l('Cia',o.cia),l('Pel',o.pel),l('Tempo de Resposta',o.horario),l('DP',o.dp),'\n',
    `<strong>— ${catLabel[o.categoria||'transito']} —</strong>\n`,
  ].join('');
  const cat=o.categoria||'transito';
  if(cat==='transito')txt+=[l('Vítimas Fatais',o.tFatais),l('Vítimas Graves',o.tGraves),l('Vítimas Leves',o.tLeves),l('AP',o.tAP),l('Moto',o.tMoto),l('CA',o.tCA),l('OA',o.tOA),l('Outros Veíc.',o.tOutrosVeic),l('Pista',o.tPistaCond),l('Tempo',o.tTempo),l('Pavimento',o.tPavimento),l('Tipo de Sinistro',o.tTipoSinistro),l('Vítimas em Óbito',o.tObito)].join('');
  if(cat==='criminal')txt+=[l('Qtd. Vítimas',o.cVitimasQtd),l('AP',o.cAP),l('Moto',o.cMoto),l('CA',o.cCA),l('OA',o.cOA),l('Outros Veíc.',o.cOutrosVeic),l('Apreendidos',o.cApreendidos),l('Subtraídos',o.cSubtraidos),l('Pessoas Presas',o.cPressos),l('Armas/Munição',o.cArmas)].join('');
  if(cat==='manifestacao')txt+=[l('Manifestantes',o.mManifestantes),l('Motivo',o.mMotivo),l('Responsável',o.mResponsavel),l('Rodovia Interditada',o.mInterdicao)].join('');
  if(cat==='interdicao')txt+=[l('Motivo',o.iMotivo),l('Km Congestionamento',o.iKm)].join('');
  if(o.equipes&&o.equipes.length){
    txt+='\n<strong>— Equipes —</strong>\n';
    o.equipes.forEach((eq,i)=>{txt+=`Equipe ${i+1}: VTR ${eq.vtr||'—'} | Enc: ${eq.enc||'—'} | Aux1: ${eq.aux1||'—'} | Aux2: ${eq.aux2||'—'} | Aux3: ${eq.aux3||'—'} | Aux4: ${eq.aux4||'—'}\n`;});
  }
  txt+='\n'+[l('CMT CPRv',o.cmtCpa),l('CMT BPRv',o.cmtBtl),l('CMT CIA Rv',o.cmtCiaInt),l('PPRI',o.ppri),l('Token',o.token),l('BO/PC',o.bopc),'\n',l('Histórico',o.historico),'\n',l('Autoridades no Local',o.autoridadesLocal),l('Autoridades Cientificadas',o.autoridadesCient),l('Status',o.status)].join('');
  return txt;
}

const gv=id=>document.getElementById(id)?.value||'';
const sv=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||'';};
function fmtData(d){if(!d)return'—';const[a,m,dd]=d.split('-');return`${dd}/${m}/${a}`;}
function slugStatus(s){if(!s)return'em-andamento';return s.toLowerCase().replace(/\s+/g,'-').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function toast(msg,tipo='ok'){const t=document.getElementById('toast');t.textContent=msg;t.className=`show ${tipo}`;setTimeout(()=>{t.className='';},3500);}

document.getElementById('modal-backdrop').addEventListener('click',e=>{if(e.target===document.getElementById('modal-backdrop'))fecharModal();});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.getElementById('screen-login').style.display!=='none')fazerLogin();});

// Expor funções no escopo global para uso nos onclick do HTML
window.fazerLogin = fazerLogin;
window.fazerLogout = fazerLogout;
window.irPara = irPara;
window.adicionarEquipe = adicionarEquipe;
window.removerEquipe = removerEquipe;
window.selecionarCategoria = selecionarCategoria;
window.salvarOcorrencia = salvarOcorrencia;
window.verOcorrencia = verOcorrencia;
window.editarOcorrencia = editarOcorrencia;
window.exportarPDF = exportarPDF;
window.fecharModal = fecharModal;
window.filtrarOcorrencias = filtrarOcorrencias;
window.adicionarItem = adicionarItem;
window.toggleItem = toggleItem;
window.excluirItem = excluirItem;