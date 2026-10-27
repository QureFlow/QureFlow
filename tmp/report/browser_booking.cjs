const fs=require('node:fs'),path=require('node:path');
const mysql=require('../../backend/node_modules/mysql2/promise');
const {chromium}=require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'evidence');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1120,height:900},deviceScaleFactor:2});
 const db=await mysql.createConnection({host:'127.0.0.1',port:3307,user:'qureflow',password:'qureflow_local_only',database:'qureflow_dbms',dateStrings:true});
 let appointment,token;
 try {
 await page.goto('http://localhost:5174/patient/login');
 await page.locator('input[type=text]').first().fill('demo.patient@example.invalid');
 await page.locator('input[type=password]').fill('DemoPatient123!');
 await page.getByRole('button',{name:'Sign in to Patient Portal',exact:true}).click();
 await page.waitForURL('**/patient/dashboard');
 await page.goto('http://localhost:5174/patient/doctors/doc-1');
 await page.getByLabel('Choose appointment date').fill('2026-10-20');
 await page.waitForLoadState('networkidle');
 await page.getByRole('button',{name:/^08:00/}).click();
 await page.getByRole('button',{name:'Proceed to Confirmation',exact:true}).click();
 await page.waitForURL('**/patient/book');
 await page.getByLabel('Reason for visit / Chief complaint (Optional)',{exact:true}).fill('Synthetic report verification booking');
 await page.screenshot({path:path.join(out,'web-booking-confirmation.png')});
 const accepted=page.waitForResponse(r=>r.request().method()==='POST' && /\/api\/appointments$/.test(r.url()));
 await page.getByRole('button',{name:'Confirm & Get Token',exact:true}).click();
 const response=await accepted;
 if(response.status()!==201) throw new Error('Booking HTTP '+response.status()+': '+await response.text());
 const booking=await response.json();
 appointment=booking.appointment;
 token=booking.token;
 await page.waitForURL('**/patient/appointments'); await page.waitForLoadState('networkidle');
 await page.getByText(appointment.tokenNumber,{exact:true}).first().waitFor();
 await page.screenshot({path:path.join(out,'web-booking-persisted.png')});
 const sql="SELECT a.id,a.date,a.status AS appointmentStatus,t.status AS tokenStatus,s.bookedCount FROM appointments a JOIN queue_tokens t ON t.appointmentId=a.id JOIN appointment_slots s ON s.doctorId=a.doctorId AND s.slotDate=a.date AND s.slotMinute=a.slotMinute WHERE a.id=?";
 const before=(await db.execute(sql,[appointment.id]))[0];
 if(before.length!==1 || before[0].bookedCount!==1) throw new Error('SQL booking persistence failed');
 const card=page.locator('.qf-panel').filter({hasText:appointment.tokenNumber});
 // The unique token identifies the new synthetic booking among older fixture rows.
 const cancelButtons=page.getByRole('button',{name:'Cancel',exact:true});
 const cards=await cancelButtons.count();
 if(cards===1) await cancelButtons.click();
 else {
  await page.getByText(appointment.tokenNumber,{exact:true}).first().locator('xpath=ancestor::div[contains(@class,"shadow-subtle")][1]').getByRole('button',{name:'Cancel',exact:true}).click();
 }
 await page.getByRole('button',{name:'Confirm Cancellation',exact:true}).click();
 await page.getByRole('button',{name:/Cancelled & No-Show/}).click();
 await page.waitForLoadState('networkidle');
 await page.screenshot({path:path.join(out,'web-booking-cancelled.png')});
 const after=(await db.execute(sql,[appointment.id]))[0];
 if(after[0].appointmentStatus!=='cancelled'||after[0].tokenStatus!=='cancelled'||after[0].bookedCount!==0)
   throw new Error('SQL cancellation synchronization failed');
 fs.writeFileSync(path.join(out,'browser-booking.json'),JSON.stringify({executedAt:new Date().toISOString(),appointment,token,sql,before,after},null,2));
 console.log(JSON.stringify({appointmentId:appointment.id,token:appointment.tokenNumber,before,after}));
 } finally {
  if(appointment) {
   const [rows]=await db.execute('SELECT status FROM appointments WHERE id=?',[appointment.id]);
   if(rows[0]?.status==='booked') {
    const jwt=await page.evaluate(()=>sessionStorage.getItem('qureflow_token'));
    await page.request.post('http://localhost:5174/api/appointments/'+appointment.id+'/cancel',{headers:{Authorization:'Bearer '+jwt},data:{reason:'Synthetic report verification cleanup'}});
   }
  }
  await db.end(); await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
