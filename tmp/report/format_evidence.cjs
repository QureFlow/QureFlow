const fs=require('node:fs'),path=require('node:path');
const mysql=require('../../backend/node_modules/mysql2/promise');
const {chromium}=require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'evidence'),esc=x=>String(x??'NULL').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
(async()=>{
 const data=JSON.parse(fs.readFileSync(path.join(out,'report-data.json')));
 const booking=JSON.parse(fs.readFileSync(path.join(out,'browser-booking.json')));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:2});
 const db=await mysql.createConnection({host:'127.0.0.1',port:3307,user:'qureflow',password:'qureflow_local_only',database:'qureflow_dbms',dateStrings:true});
 async function screen(name,title,sql,rows) {
  const columns=Object.keys(rows[0]);
  const html='<html><meta charset="utf-8"><style>body{margin:28px;font:20px/1.4 Arial;color:#111}h1{font-size:26px}p{font-size:16px;color:#444}pre{font:18px/1.4 Consolas;white-space:pre-wrap;padding:12px;border:1px solid #aaa}table{border-collapse:collapse;width:100%;font-size:20px}th,td{border:1px solid #777;padding:9px;text-align:left;overflow-wrap:anywhere}th{background:#e7edf4}</style><h1>'+esc(title)+'</h1><p>Actual local MySQL execution | '+esc(data.executedAt)+'</p><pre>'+esc(sql)+'</pre><table><tr>'+columns.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr>'+rows.map(r=>'<tr>'+columns.map(c=>'<td>'+esc(typeof r[c]==='object'?JSON.stringify(r[c]):r[c])+'</td>').join('')+'</tr>').join('')+'</table>';
  await page.setContent(html);
  await page.setViewportSize({width:1000,height:Math.ceil(await page.locator('table').evaluate(el=>el.getBoundingClientRect().bottom))+28});
  await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
 }
 for(const name of ['directory','function','procedure']) {
  let [rows]=await db.query(data.sql[name].sql);
  if(name==='procedure') rows=rows[0];
  await screen('evidence-'+name,'Executed '+(name==='directory'?'specialty search':name==='function'?'function validation':'daily flow procedure'),data.sql[name].sql,rows);
 }
 const [result]=await db.query(data.sql.cursor.sql);
 const workload=result[0][0].workload;
 await screen('evidence-cursor','Executed roster cursor',data.sql.cursor.sql,typeof workload==='string'?JSON.parse(workload):workload);
 const rows=[{phase:'After booking',date:booking.before[0].date,appointment:booking.before[0].appointmentStatus,token:booking.before[0].tokenStatus,bookedCount:booking.before[0].bookedCount},{phase:'After cancellation',date:booking.after[0].date,appointment:booking.after[0].appointmentStatus,token:booking.after[0].tokenStatus,bookedCount:booking.after[0].bookedCount}];
 await screen('evidence-booking','Browser booking verified in SQL','Token '+booking.appointment.tokenNumber+' | Appointment '+booking.appointment.id+'\n'+booking.sql.replace('=?',"='"+booking.appointment.id+"'"),rows);
 const [totals]=await db.query(data.sql.totals.sql);data.finalCounts=totals;
 data.browser=booking;
 data.testCases=data.testCases.filter(r=>r.name!=='MySQL DBMS integration');
 fs.writeFileSync(path.join(out,'report-data.json'),JSON.stringify(data,null,2));
 const test=fs.readFileSync(path.join(out,'mysql-tests.txt'),'utf8');
 const summary=test.slice(test.indexOf('  ✔ CHECK constraints'));
 await page.setContent('<html><meta charset="utf-8"><style>body{margin:28px;font:20px Arial}h1{font-size:26px}pre{font:21px/1.5 Consolas;white-space:pre-wrap}</style><h1>MySQL test execution output</h1><p>24 individual cases plus the parent suite</p><pre>'+esc(summary)+'</pre>');
 await page.screenshot({path:path.join(out,'evidence-tests.png'),fullPage:true});
 await browser.close();await db.end();
 console.log(JSON.stringify({finalCounts:data.finalCounts,testCases:data.testCases.length,booking:booking.appointment.tokenNumber}));
})().catch(e=>{console.error(e);process.exitCode=1});
