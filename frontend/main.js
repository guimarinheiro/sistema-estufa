/* main.js - Frontend T2->T3 */
const API_BASE = "http://127.0.0.1:5000";

// --- Navegação simples
document.getElementById("nav-dashboard").onclick = () => switchView("dashboard");
document.getElementById("nav-list").onclick = () => switchView("list");
document.getElementById("nav-editor").onclick = () => switchView("editor");

function switchView(name){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
  document.getElementById("nav-" + name).classList.add("active");
  if(name === "dashboard") loadDashboard();
  if(name === "list") loadList();
}

let state = {
  estufa: { nome: "", localizacao: "" },
  sensors: [],   // {id, tipo, unidade}
  leituras: []   // {dataHora, sensorRef, valor}
};

// --- File import
const fileInput = document.getElementById("file-input");
document.getElementById("btn-parse").addEventListener("click", ()=>{
  if(!fileInput.files.length){ alert("Selecione um arquivo .xml"); return; }
  const f = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = e => parseXmlString(e.target.result);
  reader.readAsText(f);
});

function parseXmlString(xmlText){
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const err = doc.querySelector("parsererror");
  if(err){ alert("XML inválido (parsing). Verifique o arquivo."); return; }

  // pegar elementos básicos
  const estufaEl = doc.querySelector("estufa");
  if(!estufaEl){ alert("Arquivo não contém <estufa>"); return; }

  state.estufa.nome = (estufaEl.querySelector("nome") || {textContent:""}).textContent.trim();
  state.estufa.localizacao = (estufaEl.querySelector("localizacao") || {textContent:""}).textContent.trim();

  // sensores
  state.sensors = Array.from(estufaEl.querySelectorAll("sensores > sensor")).map(s => ({
    id: s.getAttribute("id"),
    tipo: (s.querySelector("tipo") || {textContent:""}).textContent.trim(),
    unidade: (s.querySelector("unidade") || {textContent:""}).textContent.trim()
  }));

  // leituras
  state.leituras = Array.from(estufaEl.querySelectorAll("leituras > leitura")).map(l => ({
    dataHora: (l.querySelector("dataHora") || {textContent:""}).textContent.trim(),
    sensorRef: (l.querySelector("sensorRef") || {}).getAttribute && (l.querySelector("sensorRef") || {}).getAttribute("ref"),
    valor: (l.querySelector("valor") || {textContent:""}).textContent.trim()
  }));

  document.getElementById("file-status").textContent = `Arquivo carregado: sensores=${state.sensors.length} leituras=${state.leituras.length}`;
  renderEditor();
  alert("XML importado para o editor. Revise e valide antes de exportar/enviar.");
}

// --- editor
function renderEditor(){
  document.getElementById("estufa-nome").value = state.estufa.nome;
  document.getElementById("estufa-local").value = state.estufa.localizacao;

  const sensorsList = document.getElementById("sensors-list");
  sensorsList.innerHTML = "";
  state.sensors.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = "sensor-row";
    div.innerHTML = `
      <label>ID <input data-idx="${idx}" class="sensor-id" value="${escapeHtml(s.id)}" /></label>
      <label>Tipo <input data-idx="${idx}" class="sensor-tipo" value="${escapeHtml(s.tipo)}" /></label>
      <label>Unidade <input data-idx="${idx}" class="sensor-unidade" value="${escapeHtml(s.unidade)}" /></label>
      <button data-idx="${idx}" class="del-sensor">Remover</button>
    `;
    sensorsList.appendChild(div);
  });

  const leiturasList = document.getElementById("leituras-list");
  leiturasList.innerHTML = "";
  state.leituras.forEach((l, idx) => {
    const div = document.createElement("div");
    div.className = "leitura-row";
    div.innerHTML = `
      <label>DataHora <input data-idx="${idx}" class="leitura-data" value="${escapeHtml(l.dataHora)}" /></label>
      <label>SensorRef <input data-idx="${idx}" class="leitura-sensor" value="${escapeHtml(l.sensorRef)}" /></label>
      <label>Valor <input data-idx="${idx}" class="leitura-valor" value="${escapeHtml(l.valor)}" /></label>
      <button data-idx="${idx}" class="del-leitura">Remover</button>
    `;
    leiturasList.appendChild(div);
  });

  document.querySelectorAll(".del-sensor").forEach(b => b.onclick = e => {
    const idx = +e.target.dataset.idx; state.sensors.splice(idx,1); renderEditor();
  });
  document.querySelectorAll(".del-leitura").forEach(b => b.onclick = e => {
    const idx = +e.target.dataset.idx; state.leituras.splice(idx,1); renderEditor();
  });

  document.querySelectorAll(".sensor-id").forEach(inp => inp.onchange = e => {
    state.sensors[+e.target.dataset.idx].id = e.target.value.trim();
  });
  document.querySelectorAll(".sensor-tipo").forEach(inp => inp.onchange = e => {
    state.sensors[+e.target.dataset.idx].tipo = e.target.value.trim();
  });
  document.querySelectorAll(".sensor-unidade").forEach(inp => inp.onchange = e => {
    state.sensors[+e.target.dataset.idx].unidade = e.target.value.trim();
  });

  document.querySelectorAll(".leitura-data").forEach(inp => inp.onchange = e => {
    state.leituras[+e.target.dataset.idx].dataHora = e.target.value.trim();
  });
  document.querySelectorAll(".leitura-sensor").forEach(inp => inp.onchange = e => {
    state.leituras[+e.target.dataset.idx].sensorRef = e.target.value.trim();
  });
  document.querySelectorAll(".leitura-valor").forEach(inp => inp.onchange = e => {
    state.leituras[+e.target.dataset.idx].valor = e.target.value.trim();
  });
}

document.getElementById("add-sensor").onclick = () => {
  state.sensors.push({id: "S" + (state.sensors.length+1), tipo: "temperatura", unidade: "C"});
  renderEditor();
};
document.getElementById("add-leitura").onclick = () => {
  state.leituras.push({dataHora: new Date().toISOString(), sensorRef: state.sensors[0] ? state.sensors[0].id : "", valor: "0"});
  renderEditor();
};

document.getElementById("btn-export").onclick = () => {

  state.estufa.nome = document.getElementById("estufa-nome").value.trim();
  state.estufa.localizacao = document.getElementById("estufa-local").value.trim();

  const errors = validateClientState(state);
  if(errors.length){
    alert("Erros encontrados:\n" + errors.map(e=>`${e.code}: ${e.message}`).join("\n"));
    return;
  }
  const xml = buildXmlFromState(state);

  const blob = new Blob([xml], {type: "application/xml"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "cliente.xml";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);

  alert("cliente.xml gerado (download).");
};


document.getElementById("btn-send").onclick = async () => {
  const xml = buildXmlFromState(state);
  const fd = new FormData();
  fd.append("file", new Blob([xml], {type: "application/xml"}), "cliente.xml");
  try{
    const res = await fetch(API_BASE + "/api/xml", { method: "POST", body: fd });
    const text = await res.text();
    document.getElementById("send-result").textContent = `Status ${res.status}: ${text}`;
    // atualiza dashboard/lista
    loadDashboard();
  }catch(err){
    document.getElementById("send-result").textContent = `Erro: ${err.message}`;
  }
};

function buildXmlFromState(st){
  const esc = v => escapeXml(String(v || ""));
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<estufa>\n`;
  xml += `  <nome>${esc(st.estufa.nome)}</nome>\n`;
  xml += `  <localizacao>${esc(st.estufa.localizacao)}</localizacao>\n`;
  xml += `  <sensores>\n`;
  st.sensors.forEach(s => {
    xml += `    <sensor id="${esc(s.id)}">\n`;
    xml += `      <tipo>${esc(s.tipo)}</tipo>\n`;
    xml += `      <unidade>${esc(s.unidade)}</unidade>\n`;
    xml += `    </sensor>\n`;
  });
  xml += `  </sensores>\n  <leituras>\n`;
  st.leituras.forEach(l => {
    xml += `    <leitura>\n`;
    xml += `      <dataHora>${esc(l.dataHora)}</dataHora>\n`;
    xml += `      <sensorRef ref="${esc(l.sensorRef)}"/>\n`;
    xml += `      <valor>${esc(l.valor)}</valor>\n`;
    xml += `    </leitura>\n`;
  });
  xml += `  </leituras>\n</estufa>\n`;
  return xml;
}

// RANGES: temperatura, umidadeAr, umidadeSolo, co2, luminosidade
const RANGES = {
  temperatura: [-10, 60],
  umidadeAr: [0, 100],
  umidadeSolo: [0, 100],
  co2: [0, 10000],
  luminosidade: [0, 200000]
};

function validateClientState(st){
  const errors = [];

  if(!st.estufa.nome) errors.push({code:"MISSING_FIELD", message:"nome da estufa obrigatório", xpath:"/estufa/nome"});
  if(!st.estufa.localizacao) errors.push({code:"MISSING_FIELD", message:"localizacao obrigatório", xpath:"/estufa/localizacao"});

  const ids = new Set();
  st.sensors.forEach((s, i) => {
    if(!s.id) errors.push({code:"MISSING_FIELD", message:`sensor[@id] ausente na posição ${i+1}`, xpath:`/estufa/sensores/sensor[${i+1}]`});
    if(ids.has(s.id)) errors.push({code:"DUPLICATE_SENSOR_ID", message:`Sensor id duplicado '${s.id}'`, xpath:`/estufa/sensores/sensor[@id='${s.id}']`});
    ids.add(s.id);

    if(!s.tipo) errors.push({code:"MISSING_FIELD", message:`sensor.tipo ausente para id ${s.id}`, xpath:`/estufa/sensores/sensor[@id='${s.id}']/tipo`});
  });

  const seen = new Set();
  st.leituras.forEach((l, i) => {
    const base = `/estufa/leituras/leitura[${i+1}]`;
    if(!l.dataHora) errors.push({code:"MISSING_FIELD", message:"dataHora ausente", xpath:base + "/dataHora"});
    if(!l.sensorRef) errors.push({code:"MISSING_FIELD", message:"sensorRef ausente", xpath:base + "/sensorRef"});
    if(l.valor === "" || l.valor == null) errors.push({code:"MISSING_FIELD", message:"valor ausente", xpath: base + "/valor"});
    const key = `${l.sensorRef}::${l.dataHora}`;
    if(seen.has(key)) errors.push({code:"DUPLICATE_READING", message:`Leitura duplicada para sensor ${l.sensorRef} em ${l.dataHora}`, xpath: base});
    seen.add(key);

    const tipo = (st.sensors.find(s => s.id === l.sensorRef) || {}).tipo;
    if(tipo && RANGES[tipo]){
      const [lo,hi] = RANGES[tipo];
      const val = parseFloat(l.valor);
      if(Number.isFinite(val) && (val < lo || val > hi)){
        errors.push({code:"OUT_OF_RANGE", message:`Elemento 'valor' fora da faixa [${lo}..${hi}] para tipo '${tipo}'`, xpath: base + "/valor"});
      }
    }
  });
  return errors;
}

function escapeXml(s) { return s.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c])); }
function escapeHtml(s){ return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

async function loadDashboard(){
  try{
    const res = await fetch(API_BASE + "/api/consulta");
    const data = await res.json();

    const totalSensors = new Set(data.items.map(i=>i.sensorRef)).size;
    const totalLeituras = data.total || data.items.length;
    const outRange = data.items.filter(i=>i.status === "out_of_range").length;

    document.getElementById("card-total-sensors").textContent = totalSensors;
    document.getElementById("card-total-leituras").textContent = totalLeituras;
    document.getElementById("card-out-range").textContent = outRange;

    const recent = data.items.slice(0,5);
    const ul = document.getElementById("recent-list");
    ul.innerHTML = "";
    recent.forEach(r => {
      const li = document.createElement("li");
      li.textContent = `${r.dataHora} — ${r.tipo} (${r.valor})`;
      ul.appendChild(li);
    });

    const counts = {};
    data.items.forEach(i=> counts[i.tipo] = (counts[i.tipo]||0)+1);
    const ctx = document.getElementById("chart-leituras").getContext("2d");
    if(window._chart) window._chart.destroy();
    window._chart = new Chart(ctx, {
      type: 'bar',
      data: { labels: Object.keys(counts), datasets:[{label:'Leituras', data:Object.values(counts)}] },
      options:{responsive:true,plugins:{legend:{display:false}}}
    });
  }catch(err){
    console.warn("Erro ao carregar dashboard:", err);
  }
}

async function loadList(){
  const tipo = document.getElementById("filter-tipo").value;
  const inicio = document.getElementById("filter-inicio").value;
  const fim = document.getElementById("filter-fim").value;
  const status = document.getElementById("filter-status").value;
  let qs = [];
  if(tipo) qs.push("tipo="+encodeURIComponent(tipo));
  if(inicio) qs.push("inicio="+encodeURIComponent(new Date(inicio).toISOString()));
  if(fim) qs.push("fim="+encodeURIComponent(new Date(fim).toISOString()));
  if(status) qs.push("status="+encodeURIComponent(status));
  const url = API_BASE + "/api/consulta" + (qs.length ? "?"+qs.join("&") : "");
  try{
    const res = await fetch(url);
    const data = await res.json();
    const tbody = document.querySelector("#table-list tbody");
    tbody.innerHTML = "";
    data.items.forEach(it => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${it.estufa||''}</td><td>${it.sensorRef||''}</td><td>${it.tipo||''}</td><td>${it.dataHora||''}</td><td>${it.valor||''}</td><td>${it.status||''}</td>`;
      tbody.appendChild(tr);
    });
  }catch(err){ console.warn(err); }
}

document.getElementById("btn-filter").onclick = loadList;

switchView("dashboard");
