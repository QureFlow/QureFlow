const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const mysql = require('../../backend/node_modules/mysql2/promise');
const { chromium } = require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const out = path.join(__dirname, 'evidence');
const esc = value => String(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const statements = {
  directory: "SELECT d.name,s.name AS specialty,c.name AS clinic,d.consultationFee FROM doctors d JOIN specialties s ON s.id=d.specialtyId JOIN clinics c ON c.id=d.clinicId WHERE s.name='Gynecology' AND d.status='active' ORDER BY d.consultationFee,d.name;",
  function: "SELECT fn_consultation_minutes('2026-10-19 10:00:00','2026-10-19 10:12:30') AS minutes, fn_consultation_minutes(NULL,'2026-10-19 10:12:30') AS missingInput, fn_consultation_minutes('2026-10-19 11:00:00','2026-10-19 10:00:00') AS reversedInput;",
  procedure: "CALL sp_daily_patient_flow('clinic-1','2026-10-06','2026-10-19');",
  cursor: "CALL sp_doctor_workload_cursor('clinic-1','2026-10-13');",
  objects: "SELECT ROUTINE_NAME,ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE(); SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE();",
  totals: "SELECT 'clinics' AS entity,COUNT(*) AS total FROM clinics UNION ALL SELECT 'doctors',COUNT(*) FROM doctors UNION ALL SELECT 'patient profiles',COUNT(*) FROM users WHERE role='patient' UNION ALL SELECT 'appointments',COUNT(*) FROM appointments UNION ALL SELECT 'queue tokens',COUNT(*) FROM queue_tokens;"
};
function cli(sql) {
  return cp.execFileSync('docker', ['exec','-i','-e','MYSQL_PWD=qureflow_local_only',
    'qureflow-dbms-mysql-1','mysql','-uqureflow','qureflow_dbms','--table','--verbose'],
    {input:sql,encoding:'utf8',maxBuffer:10e6}).replace(/mysql: \[Warning\].*\n/g,'');
}
async function main() {
  const db = await mysql.createConnection({host:'127.0.0.1',port:3307,user:'qureflow',
    password:'qureflow_local_only',database:'qureflow_dbms',dateStrings:true});
  const data = { executedAt:new Date().toISOString(), sql:{}, version:(await db.query('SELECT VERSION() AS version'))[0][0].version };
  for (const [name, sql] of Object.entries(statements)) {
    const raw=cli(sql); data.sql[name]={sql,raw}; fs.writeFileSync(path.join(out,name+'.txt'),raw);
  }
  data.transaction = cli(fs.readFileSync(path.join(root,'backend/sql/004_transaction_demonstration.sql'),'utf8'));
  fs.writeFileSync(path.join(out,'transaction.txt'),data.transaction);
  for (const [name,query] of Object.entries({
    tables:"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",
    columns:"SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,COLUMN_KEY,EXTRA,GENERATION_EXPRESSION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION",
    foreignKeys:"SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL",
    counts:statements.totals,
    indexes:"SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() GROUP BY TABLE_NAME,INDEX_NAME,NON_UNIQUE",
    checks:"SELECT tc.TABLE_NAME,cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc ON tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME WHERE tc.CONSTRAINT_SCHEMA=DATABASE() AND tc.CONSTRAINT_TYPE='CHECK'",
    objects:"SELECT ROUTINE_NAME,ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE()",
    views:"SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA=DATABASE()",
  })) data[name]=(await db.query(query))[0];
  await db.end();
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-first-run']});
  const context=await browser.newContext({viewport:{width:1120,height:860},deviceScaleFactor:2});
  const page=await context.newPage();
  page.on('pageerror',error=>console.error('BROWSER',error.message));
  async function shot(url,name,waitText) {
    await page.goto('http://localhost:5174'+url);
    await page.waitForLoadState('networkidle');
    if (waitText) await page.getByText(waitText,{exact:false}).first().waitFor();
    await page.screenshot({path:path.join(out,name+'.png'),fullPage:false});
  }
  await shot('/patient/doctors','web-directory','48');
  await page.screenshot({path:path.join(out,'web-directory-full.png'),fullPage:true});
  await page.getByRole('button',{name:'Gynecology',exact:true}).click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
  await page.screenshot({path:path.join(out,'web-specialty.png')});
  await shot('/patient/login','web-patient-login','Patient Portal');
  await page.locator('input[type=text]').first().fill('demo.patient@example.invalid');
  await page.locator('input[type=password]').fill('DemoPatient123!');
  await page.getByRole('button',{name:'Sign in to Patient Portal',exact:true}).click();
  await page.waitForURL('**/patient/dashboard'); await page.waitForLoadState('networkidle');
  await page.screenshot({path:path.join(out,'web-patient-dashboard.png')});
  const staff=await browser.newContext({viewport:{width:1120,height:860},deviceScaleFactor:2});
  const sp=await staff.newPage();
  await sp.goto('http://localhost:5174/admin/login'); await sp.waitForLoadState('networkidle');
  await sp.locator('input[type=text]').first().fill('demo.staff@example.invalid');
  await sp.locator('input[type=password]').fill('DemoClinic123!');
  await sp.getByRole('button',{name:'Sign in to Staff Console',exact:true}).click();
  await sp.waitForURL('**/admin/dashboard'); await sp.waitForLoadState('networkidle');
  await sp.screenshot({path:path.join(out,'web-staff-dashboard.png')});
  await sp.goto('http://localhost:5174/admin/doctors'); await sp.waitForLoadState('networkidle');
  await sp.screenshot({path:path.join(out,'web-staff-doctors.png')});
  await sp.goto('http://localhost:5174/admin/analytics'); await sp.waitForLoadState('networkidle');
  await sp.screenshot({path:path.join(out,'web-analytics.png')});
  const mobile=await browser.newContext({viewport:{width:412,height:850},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const mp=await mobile.newPage();
  await mp.goto('http://localhost:5174/patient/doctors'); await mp.waitForLoadState('networkidle');
  await mp.screenshot({path:path.join(out,'responsive-web.png')});
  for (const [name,record] of Object.entries(data.sql)) {
    const html='<!doctype html><html><meta charset="utf-8"><style>body{margin:30px;font:18px Arial;color:#111}h1{font-size:25px}p{font-size:14px;color:#444}pre{font:16px/1.45 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;padding:18px;border:1px solid #aaa;background:#f8f9fa}</style><h1>QureFlow MySQL execution</h1><p>Executed '+esc(data.executedAt)+' | Local synthetic database | '+esc(data.version)+'</p><pre>'+esc(record.raw)+'</pre>';
    await page.setContent(html);
    await page.screenshot({path:path.join(out,'sql-'+name+'.png'),fullPage:true});
  }
  const tests=fs.readFileSync(path.join(out,'mysql-tests.txt'),'utf8');
  data.testCases=[...tests.matchAll(/^ {2}✔ (.+?) \([\d.]+ms\)/gm)].map((m,i)=>({id:'TC'+String(i+1).padStart(2,'0'),name:m[1],passed:true}));
  await page.setContent('<html><meta charset="utf-8"><style>body{font:18px Arial;margin:30px}h1{font-size:25px}pre{font:16px/1.5 Consolas;white-space:pre-wrap}</style><h1>Executed MySQL regression suite</h1><p>'+esc(data.executedAt)+'</p><pre>'+esc(tests.slice(tests.indexOf('▶')))+'</pre>');
  await page.screenshot({path:path.join(out,'test-output.png'),fullPage:true});
  await browser.close();
  fs.writeFileSync(path.join(out,'report-data.json'),JSON.stringify(data,null,2));
  console.log(JSON.stringify({mysql:data.version,tables:data.tables.length,counts:data.counts,testCases:data.testCases.length,screenshots:fs.readdirSync(out).filter(x=>x.endsWith('.png')).length}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
