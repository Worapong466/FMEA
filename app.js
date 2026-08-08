const API_URL = (window.FMEA_CONFIG && window.FMEA_CONFIG.API_URL || "").trim();
const state = { code: sessionStorage.getItem("fmeaEmployee") || "", staff: null, cases: [] };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

async function api(action, payload = {}) {
  if (!API_URL) throw new Error("ยังไม่ได้ตั้งค่า Google Apps Script URL");

  return new Promise((resolve, reject) => {
    const id = `fmea-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const frame = document.createElement("iframe");
    frame.name = `fmea-api-${id}`;
    frame.style.display = "none";
    let timer;

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      frame.remove();
    };

    const receive = (event) => {
      const receive = (event) => {

  const msg = event.data;
  if (!msg || msg.type !== "FMEA_API_RESPONSE" || msg.requestId !== id) return;

      const msg = event.data;
      if (!msg || msg.type !== "FMEA_API_RESPONSE" || msg.requestId !== id) return;

      cleanup();

      const data = msg.data || {};
      if (data.ok) {
        resolve(data);
      } else {
        reject(new Error(data.error || "ไม่สามารถเชื่อมต่อฐานข้อมูลได้"));
      }
    };

    window.addEventListener("message", receive);
    document.body.appendChild(frame);

    timer = setTimeout(() => {
      cleanup();
      reject(new Error("เชื่อมต่อฐานข้อมูลหมดเวลา กรุณาลองใหม่"));
    }, 20000);

    const form = document.createElement("form");
    form.method = "POST";
    form.action = API_URL;
    form.target = frame.name;
    form.style.display = "none";

    const add = (name, value) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    add("requestId", id);
    add("payload", JSON.stringify({
      action,
      code: state.code,
      ...payload
    }));

    document.body.appendChild(form);
    form.submit();
    form.remove();
  });
}

function escapeHtml(v="") { return String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function normalized(v="") { return String(v).toLowerCase().normalize("NFKC").replace(/[^a-z0-9ก-๙]+/g," ").trim(); }
function fmtDate(v) { if (!v) return "-"; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("th-TH",{day:"2-digit",month:"short",year:"2-digit"}); }
function groupName(c) { return (c.problemGroup || "").trim() || [c.brand,c.errorCode,c.systemType].filter(Boolean).join(" · ") || "ยังไม่จัดกลุ่ม"; }

function setView(id) {
  $$(".view").forEach(v => v.classList.toggle("active-view", v.id === id));
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === id));
  $("#pageTitle").textContent = ({dashboard:"ภาพรวมงานบริการ",knowledge:"ค้นหาวิธีแก้ปัญหา",newcase:"บันทึกเคส FMEA ใหม่"})[id];
  if (id === "knowledge") searchCases();
}

function renderDashboard() {
  const groups = new Map();
  state.cases.forEach(c => { const g=groupName(c); groups.set(g,(groups.get(g)||0)+1); });
  $("#kpiTotal").textContent = state.cases.length;
  $("#kpiOpen").textContent = state.cases.filter(c => c.status !== "ปิดงาน").length;
  $("#kpiRisk").textContent = state.cases.filter(c => Number(c.rpn)>=100).length;
  $("#kpiGroups").textContent = groups.size;
  const sortedGroups=[...groups].sort((a,b)=>b[1]-a[1]).slice(0,8);
  $("#groupList").classList.toggle("empty",!sortedGroups.length);
  $("#groupList").innerHTML = sortedGroups.length ? sortedGroups.map(([g,n])=>`<button class="group-row link-btn" data-group="${escapeHtml(g)}"><span><strong>${escapeHtml(g)}</strong><small>กดเพื่อดูเคสและวิธีแก้</small></span><span class="count-pill">${n} เคส</span></button>`).join("") : "ยังไม่มีข้อมูล";
  $$("[data-group]").forEach(b=>b.addEventListener("click",()=>{setView("knowledge");$("#groupFilter").value=b.dataset.group;searchCases();}));
  const recent=[...state.cases].reverse().slice(0,7);
  $("#recentCases").classList.toggle("empty",!recent.length);
  $("#recentCases").innerHTML = recent.length ? recent.map(c=>`<div class="case-row"><strong>${escapeHtml(c.problem||"-")}</strong><small>${escapeHtml(c.caseId||"")} · ${escapeHtml(c.brand||"-")} ${escapeHtml(c.model||"")} · ${fmtDate(c.receivedAt)} · ${escapeHtml(c.status||"-")}</small></div>`).join("") : "ยังไม่มีข้อมูล";
}

function rebuildFilters() {
  const specs=[["#brandFilter",state.cases.map(c=>c.brand)],["#systemFilter",state.cases.map(c=>c.systemType)],["#groupFilter",state.cases.map(groupName)]];
  specs.forEach(([sel,values])=>{const el=$(sel), first=el.options[0].outerHTML;const unique=[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"th"));el.innerHTML=first+unique.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");});
  const groups=[...new Set(state.cases.map(groupName).filter(g=>g!=="ยังไม่จัดกลุ่ม"))].sort((a,b)=>a.localeCompare(b,"th"));
  $("#groupSuggestions").innerHTML=groups.map(g=>`<option value="${escapeHtml(g)}"></option>`).join("");
}

function scoreCase(c,q) {
  if (!q) return 1;
  const tokens=normalized(q).split(" ").filter(Boolean); if(!tokens.length) return 1;
  const weighted=[[c.errorCode,6],[c.problemGroup,5],[c.model,4],[c.brand,3],[c.problem,3],[c.cause,2],[c.checkMethod,2],[c.solution,2]];
  return tokens.reduce((sum,t)=>sum+weighted.reduce((s,[v,w])=>s+(normalized(v).includes(t)?w:0),0),0);
}

function searchCases() {
  const q=$("#searchInput").value, brand=$("#brandFilter").value, system=$("#systemFilter").value, group=$("#groupFilter").value;
  let found=state.cases.map(c=>({c,score:scoreCase(c,q)})).filter(x=>(!q||x.score>0)&&(!brand||x.c.brand===brand)&&(!system||x.c.systemType===system)&&(!group||groupName(x.c)===group)).sort((a,b)=>b.score-a.score||Number(b.c.rpn||0)-Number(a.c.rpn||0));
  $("#searchSummary").textContent=`พบ ${found.length} เคส${group?` ในกลุ่ม “${group}”`:""}`;
  $("#searchResults").classList.toggle("empty",!found.length);
  $("#searchResults").innerHTML=found.length?found.slice(0,60).map(({c})=>`<article class="result-card"><div class="result-top"><div><h3>${escapeHtml(c.problem||"ไม่มีชื่อปัญหา")}</h3><div class="tags"><span class="tag">${escapeHtml(groupName(c))}</span>${c.brand?`<span class="tag">${escapeHtml(c.brand)}</span>`:""}${c.model?`<span class="tag">${escapeHtml(c.model)}</span>`:""}${c.errorCode?`<span class="tag">Error ${escapeHtml(c.errorCode)}</span>`:""}</div></div><span class="rpn-badge ${riskClass(c.rpn)}">RPN ${Number(c.rpn)||0}</span></div>${c.cause?`<p><b>สาเหตุ:</b> ${escapeHtml(c.cause)}</p>`:""}${c.checkMethod?`<p><b>วิธีตรวจสอบ:</b> ${escapeHtml(c.checkMethod)}</p>`:""}<div class="solution-box"><b>วิธีแก้ที่บันทึกไว้</b>${escapeHtml(c.solution||"ยังไม่มีข้อมูลวิธีแก้")}</div><small>${escapeHtml(c.caseId||"")} · ${fmtDate(c.receivedAt)} · ผู้รับผิดชอบ ${escapeHtml(c.owner||"-")} · ${escapeHtml(c.result||"")}</small></article>`).join(""):"ไม่พบเคสที่ตรงกัน ลองใช้ Error Code, รุ่นสินค้า หรือคำอธิบายอาการที่สั้นลง";
}

function riskClass(rpn){rpn=Number(rpn)||0;return rpn>=200?"critical":rpn>=100?"high":rpn>=50?"medium":"low"}
function updateRpn(){const f=new FormData($("#caseForm"));const r=(Number(f.get("s"))||1)*(Number(f.get("o"))||1)*(Number(f.get("d"))||1);const b=$("#rpnBadge");b.textContent=`RPN ${r}`;b.className=`rpn-badge ${riskClass(r)}`;}

async function loadCases() {
  const data=await api("list"); state.cases=data.cases||[]; renderDashboard(); rebuildFilters();
}

async function login(code) {
  state.code=code.trim(); const data=await api("login"); state.staff=data.staff; sessionStorage.setItem("fmeaEmployee",state.code); $("#staffName").textContent=data.staff.name||state.code; $("#loginScreen").classList.add("hidden"); $("#app").classList.remove("hidden"); await loadCases();
}

$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const m=$("#loginMessage");m.textContent="กำลังตรวจสอบ...";try{await login($("#employeeCode").value);m.textContent=""}catch(err){m.textContent=err.message;state.code="";}});
$$(".nav-btn").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
$("#logoutBtn").addEventListener("click",()=>{sessionStorage.removeItem("fmeaEmployee");location.reload();});
$("#refreshBtn").addEventListener("click",async()=>{try{await loadCases()}catch(e){alert(e.message)}});
$("#searchBtn").addEventListener("click",searchCases); $("#searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")searchCases()});
[$("#brandFilter"),$("#systemFilter"),$("#groupFilter")].forEach(el=>el.addEventListener("change",searchCases));
$("#caseForm").addEventListener("input",updateRpn);
$("#caseForm").addEventListener("submit",async e=>{e.preventDefault();const msg=$("#saveMessage");msg.className="message";msg.textContent="กำลังบันทึก...";const data=Object.fromEntries(new FormData(e.currentTarget));try{const res=await api("save",{caseData:data});msg.className="message success";msg.textContent=`บันทึก ${res.caseId} เรียบร้อย`;e.currentTarget.reset();updateRpn();await loadCases();}catch(err){msg.textContent=err.message;}});

if (!API_URL) { $("#loginMessage").textContent="ระบบหน้าเว็บพร้อมแล้ว เหลือเชื่อม Google Apps Script ก่อนเริ่มใช้งาน"; }
else if (state.code) { login(state.code).catch(()=>{sessionStorage.removeItem("fmeaEmployee");state.code="";}); }
