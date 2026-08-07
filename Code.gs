const SPREADSHEET_ID = '1EC82GEyTElwRFKruyVlMCyYbnm11sOzIhRwg5BK9bJk';
const CASE_SHEET = 'FMEA_Cases';
const STAFF_SHEET = 'Staff';

function doGet() { return json_({ok:true, service:'SolarCellDIY FMEA API'}); }

function doPost(e) {
  try {
    const req = JSON.parse((e.postData && e.postData.contents) || '{}');
    const staff = validateStaff_(req.code);
    if (!staff) return json_({ok:false,error:'รหัสพนักงานไม่ถูกต้อง หรือถูกระงับการใช้งาน'});
    if (req.action === 'login') return json_({ok:true,staff:staff});
    if (req.action === 'list') return json_({ok:true,cases:listCases_()});
    if (req.action === 'save') return json_(saveCase_(req.caseData || {}, staff));
    return json_({ok:false,error:'ไม่รู้จักคำสั่งที่ส่งมา'});
  } catch (err) { return json_({ok:false,error:String(err.message || err)}); }
}

function validateStaff_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(STAFF_SHEET);
  const last = sh.getLastRow(); if (last < 2) return null;
  const rows = sh.getRange(2,1,last-1,4).getDisplayValues();
  const row = rows.find(r => String(r[0]).trim().toUpperCase() === code && String(r[3]).trim() === 'ใช้งาน');
  return row ? {code:row[0],name:row[1],role:row[2]} : null;
}

function listCases_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(CASE_SHEET);
  const last = sh.getLastRow(); if (last < 2) return [];
  return sh.getRange(2,1,last-1,26).getDisplayValues().filter(r=>r[0]).map(r=>({
    caseId:r[0],receivedAt:r[1],customerName:r[2],phone:r[3],channel:r[4],systemType:r[5],brand:r[6],model:r[7],serial:r[8],errorCode:r[9],problem:r[10],cause:r[11],checkMethod:r[12],solution:r[13],result:r[14],s:r[15],o:r[16],d:r[17],rpn:r[18],risk:r[19],status:r[20],owner:r[21],followUp:r[22],note:r[23],updatedAt:r[24],problemGroup:r[25]
  }));
}

function saveCase_(d, staff) {
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(CASE_SHEET);
    const s=bounded_(d.s),o=bounded_(d.o),det=bounded_(d.d),rpn=s*o*det;
    const risk=rpn>=200?'วิกฤต':rpn>=100?'สูง':rpn>=50?'ปานกลาง':'ต่ำ';
    const now=new Date();
    const caseId='CASE-'+Utilities.formatDate(now,'Asia/Bangkok','yyyyMMdd-HHmmss')+'-'+String(Math.floor(Math.random()*90)+10);
    sh.appendRow([caseId,now,clean_(d.customerName),clean_(d.phone),clean_(d.channel),clean_(d.systemType),clean_(d.brand),clean_(d.model),clean_(d.serial),clean_(d.errorCode),clean_(d.problem),clean_(d.cause),clean_(d.checkMethod),clean_(d.solution),clean_(d.result),s,o,det,rpn,risk,clean_(d.status)||'รับเรื่อง',staff.code,clean_(d.followUp),clean_(d.note),now,clean_(d.problemGroup)]);
    return {ok:true,caseId:caseId,rpn:rpn,risk:risk};
  } finally { lock.releaseLock(); }
}

function bounded_(v){v=Math.round(Number(v)||1);return Math.max(1,Math.min(10,v));}
function clean_(v){return String(v||'').trim().slice(0,5000);}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
