
/* ================= MODE OFFLINE / LOCAL STORAGE ================= */
const ONLINE_API=null;
let cloudHydrating=false;
let cloudOnline=false;

const ACCOUNTS_KEY='akunCatatanKeuangan';
function readAccounts(){try{const raw=JSON.parse(localStorage.getItem(ACCOUNTS_KEY)); if(!raw)return {}; if(Array.isArray(raw)){const out={}; raw.forEach(x=>{if(x&&x.username)out[normalizeUsername(x.username)]=x}); return out;} return raw}catch{return {}}}
function saveAccounts(a){localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(a))}
function normalizeUsername(u){return String(u||'').trim().toLowerCase()}
function localAccount(u){return readAccounts()[normalizeUsername(u)]||null}
function hashLite(v){let h=2166136261;for(let i=0;i<String(v).length;i++){h^=String(v).charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}

const _lsSetItem=localStorage.setItem.bind(localStorage);

const BASE='catatanKeuangan_v3';
const ACCOUNT_KEY='akunCatatanKeuangan';
const PROFILE_KEY='profilCatatanKeuangan';
const TARGET_KEY='targetCatatanKeuangan';
const NOTIF_KEY='notifCatatanKeuangan';
const ACHIEVEMENT_KEY='achievementCatatanKeuangan_v2';
const CATS={Makanan:'🍴',Transportasi:'🚕',Belanja:'🛍️',Pendidikan:'📚',Hiburan:'🎮',Lainnya:'•••'};
const COLORS=['#16a394','#3f7fe8','#e85a9b','#f2b233','#7357d8','#93a1ad'];
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const localDate=(s)=>{if(!s)return null;const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3])):new Date(s)};
const dateKey=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const latestDate=(arr)=>{const dates=arr.map(x=>localDate(x.date)).filter(Boolean);if(!dates.length)return new Date();return new Date(Math.max(Date.now(),...dates.map(d=>d.getTime())))};
const currentUser=()=>localStorage.getItem('loggedIn')||'guest';
const key=(base)=>`${base}_${currentUser()}`;
const accountDBKey=()=>key(BASE);
function ensureAccountDB(){const k=accountDBKey();if(localStorage.getItem(k)===null)localStorage.setItem(k,JSON.stringify({transactions:[],income:[]}));return k}
function read(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
function data(){const k=ensureAccountDB();return read(k,{transactions:[],income:[]})}
function save(d){localStorage.setItem(key(BASE),JSON.stringify(d))}
function rupiah(n){return 'Rp '+Number(n||0).toLocaleString('id-ID')}
function dateLabel(s){if(!s)return '';const d=localDate(s);return d.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function showToast(message,type='success',title){
 const old=document.querySelector('.app-toast'); if(old) old.remove();
 const labels={success:'Berhasil',error:'Gagal',info:'Informasi',warning:'Perhatian'};
 const icons={success:'✓',error:'!',info:'i',warning:'!'};
 const el=document.createElement('div');
 el.className=`app-toast toast-${type}`;
 el.innerHTML=`<div class="toast-icon">${icons[type]||'✓'}</div><div class="toast-content"><b>${esc(title||labels[type]||'Notifikasi')}</b><span>${esc(message)}</span></div><button class="toast-close" aria-label="Tutup">×</button><div class="toast-progress"></div>`;
 document.body.appendChild(el);
 requestAnimationFrame(()=>el.classList.add('show'));
 const close=()=>{el.classList.remove('show');setTimeout(()=>el.remove(),220)};
 el.querySelector('.toast-close').onclick=close;
 setTimeout(close,3200);
}
function notifyInput(message,type='success',title){showToast(message,type,title)}
async function ensureNotificationPermission(){
 if(!('Notification' in window)) return false;
 if(Notification.permission==='granted') return true;
 if(Notification.permission==='denied') return false;
 try{return await Notification.requestPermission()==='granted'}catch{return false}
}
async function sendDeviceNotification(title,message,tag='catatan-keuangan'){
 const n=notif();
 if(!n.permission) return false;
 if(!('Notification' in window)||Notification.permission!=='granted') return false;
 try{new Notification(title,{body:message,icon:'logo-catatan-keuangan.png',tag});return true}catch{return false}
}
function notificationEvent(title,message,type='info',tag='event'){
 const n=notif();
 notifyInput(message,type,title);
 if((type==='success'||type==='warning'||type==='info') && n.transaction) sendDeviceNotification(title,message,tag);
}
function catIcon(c){return CATS[c]||'•••'}
function addTransaction(){
 const name=document.querySelector('#name')?.value.trim();
 const amount=Number(document.querySelector('#amount')?.value||0);
 const cat=document.querySelector('#category')?.value||'Lainnya';
 const date=document.querySelector('#date')?.value||today();
 const note=document.querySelector('#note')?.value.trim()||'';
 if(!name||amount<=0){notifyInput('Isi nama pengeluaran dan nominal terlebih dahulu.','error');return}
 const d=data();d.transactions.unshift({id:Date.now(),name,amount,cat,date,note,time:new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})});save(d);
 notificationEvent('Pengeluaran tersimpan',`${rupiah(amount)} untuk ${name} berhasil disimpan.`,'success','transaction-'+date);
 const target=getTarget(); const spent=d.transactions.filter(t=>t.date===today()&&(!target.cat||target.cat==='Semua Kategori'||t.cat===target.cat)).reduce((a,t)=>a+Number(t.amount||0),0);
 if(target.amount&&spent>=Number(target.amount)*0.8&&notif().limit){const level=spent>=Number(target.amount)?'Batas pengeluaran tercapai':'Mendekati batas pengeluaran'; const msg=spent>=Number(target.amount)?`Pengeluaran hari ini ${rupiah(spent)} sudah mencapai batas ${rupiah(target.amount)}.`:`Pengeluaran hari ini ${rupiah(spent)} sudah mencapai 80% batas ${rupiah(target.amount)}.`; notifyInput(msg,spent>=Number(target.amount)?'warning':'info',level); sendDeviceNotification(level,msg,'limit-'+today());}
 if(location.pathname.endsWith('tambah.html')) setTimeout(()=>location.href='beranda.html',450); else renderAll();
}
function addIncome(){
 const amount=Number(document.querySelector('#incomeAmount')?.value||0), source=document.querySelector('#incomeSource')?.value.trim()||'Pemasukan';
 if(amount<=0){notifyInput('Masukkan nominal saldo yang valid.','error');return}
 const d=data();d.income=d.income||[];d.income.unshift({id:Date.now(),amount,source,date:today(),time:new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})});save(d);closeIncomeModal();notificationEvent('Saldo ditambahkan',`${rupiah(amount)} dari ${source} berhasil ditambahkan.`,'success','income-'+Date.now());renderAll();
}
function openIncomeModal(){const m=document.querySelector('#incomeModal');if(m){m.classList.add('show');document.querySelector('#incomeAmount')?.focus()}}
function closeIncomeModal(){document.querySelector('#incomeModal')?.classList.remove('show')}
function selectCat(el){document.querySelectorAll('.cat').forEach(x=>x.classList.remove('active'));el.classList.add('active');const h=document.querySelector('#category');if(h)h.value=el.dataset.cat}
function tx(t,withDelete=false){return `<div class="transaction"><div class="icon cat-${esc(t.cat)}">${catIcon(t.cat)}</div><div class="tx"><b>${esc(t.name||t.source||'Pemasukan')}</b><small>${esc(t.cat||'Pemasukan')} · ${dateLabel(t.date)}${t.time?' · '+esc(t.time):''}</small>${t.note?`<small class="tx-note">${esc(t.note)}</small>`:''}</div><div class="amount">${rupiah(t.amount)}${withDelete?`<button class="delete-tx" onclick="deleteTransaction(${t.id})" aria-label="Hapus">×</button>`:''}</div></div>`}
function deleteTransaction(id){if(!confirm('Hapus transaksi ini?'))return;const d=data();d.transactions=d.transactions.filter(t=>t.id!==id);save(d);notifyInput('Transaksi berhasil dihapus.','success','Transaksi dihapus');renderAll()}
function totals(){const d=data();return {expense:d.transactions.reduce((a,t)=>a+Number(t.amount||0),0),income:(d.income||[]).reduce((a,t)=>a+Number(t.amount||0),0)}}

/* ================= REAL-TIME STREAK, ACHIEVEMENTS, TARGET & CALENDAR ================= */
const ACHIEVEMENTS=[
 {id:'first',icon:'📝',name:'Catatan Pertama',desc:'Simpan transaksi pertamamu.',test:s=>s.totalTx>=1},
 {id:'streak3',icon:'🔥',name:'3 Hari Konsisten',desc:'Catat transaksi selama 3 hari berturut-turut.',test:s=>s.maxStreak>=3},
 {id:'streak7',icon:'🔥',name:'7 Hari Konsisten',desc:'Pertahankan streak selama 7 hari berturut-turut.',test:s=>s.maxStreak>=7},
 {id:'streak14',icon:'🔥',name:'14 Hari Konsisten',desc:'Pertahankan streak selama 14 hari berturut-turut.',test:s=>s.maxStreak>=14},
 {id:'frugal3',icon:'💚',name:'Hemat 3 Hari',desc:'Pengeluaran maksimal 80% target selama 3 hari.',test:s=>s.frugalDays>=3},
 {id:'frugal7',icon:'💚',name:'Hemat 7 Hari',desc:'Pengeluaran maksimal 80% target selama 7 hari.',test:s=>s.frugalDays>=7},
 {id:'frugal14',icon:'💎',name:'Hemat 14 Hari',desc:'Pengeluaran maksimal 80% target selama 14 hari.',test:s=>s.frugalDays>=14},
 {id:'positive',icon:'🏆',name:'Saldo Positif',desc:'Total pemasukan lebih besar daripada total pengeluaran.',test:s=>s.balance>0 && s.totalTx>=5}
];
let alarmTimer=null;
let liveTimer=null;
let lastLiveDate=today();
let lastLiveSignature='';

function activityDates(){
 const d=data();
 const now=today();
 const set=new Set();
 [...(d.transactions||[]),...(d.income||[])].forEach(x=>{if(x&&x.date&&x.date<=now)set.add(x.date)});
 return [...set].sort();
}
function streakFromDates(dates){
 const set=new Set(dates); let cur=0; let cursor=new Date();cursor.setHours(0,0,0,0);
 while(set.has(dateKey(cursor))){cur++;cursor.setDate(cursor.getDate()-1)}
 return cur;
}
function maxStreakFromDates(dates){
 const set=new Set(dates);let max=0;
 dates.forEach(ds=>{
   const d=localDate(ds); if(!d)return;
   const prev=new Date(d);prev.setDate(prev.getDate()-1);
   if(set.has(dateKey(prev)))return;
   let n=1;const x=new Date(d);x.setDate(x.getDate()+1);
   while(set.has(dateKey(x))){n++;x.setDate(x.getDate()+1)}
   if(n>max)max=n;
 });
 return max;
}
function dailyExpenseMap(){
 const out={};(data().transactions||[]).forEach(t=>{out[t.date]=(out[t.date]||0)+Number(t.amount||0)});return out;
}
function frugalDaysCount(){
 const target=getTarget();const amount=Number(target.amount||0);if(amount<=0)return 0;
 const ex=dailyExpenseMap();
 const now=today();return Object.keys(ex).filter(d=>d<=now&&ex[d]<=amount*0.8).length;
}
function achievementStats(){
 const d=data(),tx=d.transactions||[],inc=d.income||[];
 const dates=activityDates();
 const income=inc.reduce((a,x)=>a+Number(x.amount||0),0);
 const expense=tx.reduce((a,x)=>a+Number(x.amount||0),0);
 return {totalTx:tx.length+inc.length,currentStreak:streakFromDates(dates),maxStreak:maxStreakFromDates(dates),frugalDays:frugalDaysCount(),balance:income-expense};
}
function achievementState(){return read(key(ACHIEVEMENT_KEY),{unlocked:[],initialized:false})}
function saveAchievementState(s){localStorage.setItem(key(ACHIEVEMENT_KEY),JSON.stringify(s))}
function showAchievementPopup(newItems){
 if(!newItems.length)return;
 const old=document.querySelector('.achievement-popup');if(old)old.remove();
 const el=document.createElement('div');el.className='achievement-popup';
 el.innerHTML=`<div class="achievement-backdrop"></div><section class="achievement-pop-card" role="dialog" aria-modal="true"><button class="achievement-pop-close" type="button">×</button><div class="achievement-pop-spark">🏆</div><span class="achievement-pop-badge">PENCAPAIAN TERBUKA</span><h2>Hebat! Pencapaian baru</h2><div class="achievement-pop-list">${newItems.map(a=>`<div class="achievement-pop-item"><span>${a.icon}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div></div>`).join('')}</div><button class="achievement-pop-ok" type="button">Lanjutkan</button></section>`;
 document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));
 const close=()=>{el.classList.remove('show');setTimeout(()=>el.remove(),220)};
 el.querySelector('.achievement-pop-close').onclick=close;el.querySelector('.achievement-pop-ok').onclick=close;el.querySelector('.achievement-backdrop').onclick=close;
 try{playBellSound()}catch{}
}
function updateAchievements(showPopup=true){
 const stats=achievementStats();const state=achievementState();const old=new Set(state.unlocked||[]);
 const unlocked=ACHIEVEMENTS.filter(a=>a.test(stats)).map(a=>a.id);
 const fresh=unlocked.filter(id=>!old.has(id));
 const changed=fresh.length||unlocked.length!==(state.unlocked||[]).length;
 if(changed)saveAchievementState({unlocked,initialized:true});
 if(showPopup&&state.initialized&&fresh.length)showAchievementPopup(ACHIEVEMENTS.filter(a=>fresh.includes(a.id)));
 return {stats,unlocked,fresh};
}
function setFlame(el,streak){
 if(!el)return;
 el.classList.remove('dead','active','ember','hot','inferno','blue','violet');
 if(streak<=0){el.classList.add('dead');return}
 el.classList.add('active',streak<7?'ember':streak<14?'hot':streak<30?'inferno':streak<60?'blue':'violet');
 el.setAttribute('aria-label',`Streak ${streak} hari`);
}
function renderStreakAchievements(showPopup=true){
 const r=updateAchievements(showPopup),s=r.stats;
 document.querySelectorAll('#streakValue').forEach(e=>e.textContent=`${s.currentStreak} hari`);
 document.querySelectorAll('#achievementValue').forEach(e=>e.textContent=String(r.unlocked.length));
 document.querySelectorAll('#achievementCount').forEach(e=>e.textContent=`${r.unlocked.length}/${ACHIEVEMENTS.length}`);
 document.querySelectorAll('#achievementTrack').forEach(e=>e.style.width=`${Math.round(r.unlocked.length/ACHIEVEMENTS.length*100)}%`);
 const msg=s.currentStreak>0?`Api menyala • hari ke-${s.currentStreak}`:(activityDates().some(d=>d===today())?'Catatan hari ini sudah aktif':'Mulai catat hari ini');
 document.querySelectorAll('#streakText').forEach(e=>e.textContent=msg);
 document.querySelectorAll('#achievementText').forEach(e=>e.textContent=r.unlocked.length?`${r.unlocked.length} pencapaian terbuka`:'Belum ada pencapaian');
 document.querySelectorAll('.streak-flame').forEach(e=>setFlame(e,s.currentStreak));
}
function getTarget(){return read(key(TARGET_KEY),{})||{}}
function todayExpenseForTarget(){
 const t=getTarget(),d=data();
 return (d.transactions||[]).filter(x=>x.date===today()&&(!t.cat||t.cat==='Semua Kategori'||x.cat===t.cat)).reduce((a,x)=>a+Number(x.amount||0),0);
}
function renderTargetProgress(){
 const t=getTarget(),amount=Number(t.amount||0),spent=todayExpenseForTarget();
 if(!amount){setText('targetProgressPct','Belum diatur');setText('targetProgressText','Atur target pengeluaran untuk melihat sisa batas harian.');const b=document.querySelector('#targetProgressBar');if(b)b.style.width='0%';return}
 const pct=Math.min(100,Math.round(spent/amount*100)),remain=Math.max(0,amount-spent);
 setText('targetProgressPct',`${pct}% terpakai`);setText('targetProgressText',remain>0?`Sisa batas hari ini ${rupiah(remain)} · terpakai ${rupiah(spent)}`:`Batas harian terlampaui ${rupiah(spent-amount)}.`);
 const b=document.querySelector('#targetProgressBar');if(b)b.style.width=`${pct}%`;
}
let calendarCursor=new Date();calendarCursor.setDate(1);let selectedCalendarDate=today();
function renderCalendar(){
 const grid=document.querySelector('#calendarGrid');if(!grid)return;
 const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
 setText('calendarTitle',calendarCursor.toLocaleDateString('id-ID',{month:'long',year:'numeric'}));
 const first=new Date(y,m,1),last=new Date(y,m+1,0);let mondayIndex=(first.getDay()+6)%7;
 const d=data(),ex=new Set((d.transactions||[]).filter(t=>t.date).map(t=>t.date)),inc=new Set((d.income||[]).filter(t=>t.date).map(t=>t.date));
 const cells=[];
 for(let i=0;i<mondayIndex;i++)cells.push('<div class="cal-day muted"></div>');
 for(let day=1;day<=last.getDate();day++){
   const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
   const cls=['cal-day'];if(ds===today())cls.push('today');if(ds===selectedCalendarDate)cls.push('selected');if(ex.has(ds))cls.push('has-expense');if(inc.has(ds))cls.push('has-income');
   cells.push(`<button type="button" class="${cls.join(' ')}" onclick="selectCalendarDate('${ds}')">${day}</button>`);
 }
 while(cells.length%7)cells.push('<div class="cal-day muted"></div>');
 grid.innerHTML=cells.join('');
 renderCalendarDetail();
}
function selectCalendarDate(ds){selectedCalendarDate=ds;renderCalendar()}
function renderCalendarDetail(){
 const e=document.querySelector('#calendarDetail');if(!e)return;const d=data();
 const ex=(d.transactions||[]).filter(t=>t.date===selectedCalendarDate),inc=(d.income||[]).filter(t=>t.date===selectedCalendarDate);
 const ei=inc.reduce((a,t)=>a+Number(t.amount||0),0),ee=ex.reduce((a,t)=>a+Number(t.amount||0),0),n=ex.length+inc.length;
 e.textContent=n?`${dateLabel(selectedCalendarDate)} · Pemasukan ${rupiah(ei)} · Pengeluaran ${rupiah(ee)} · ${n} transaksi`:`${dateLabel(selectedCalendarDate)} · Belum ada transaksi.`;
}
function renderAchievementList(){
 const host=document.querySelector('#achievementList');if(!host)return;const r=updateAchievements(false);host.innerHTML=ACHIEVEMENTS.map(a=>{const ok=r.unlocked.includes(a.id);return `<div class="achievement-item ${ok?'unlocked':'locked'}"><span class="ach-icon">${a.icon}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div>`}).join('');
}

function renderHome(){
 const d=data(),ts=totals(),balance=ts.income-ts.expense;
 const exToday=d.transactions.filter(t=>t.date===today()).reduce((a,t)=>a+t.amount,0);
 const incToday=(d.income||[]).filter(t=>t.date===today()).reduce((a,t)=>a+t.amount,0);
 setText('balance',rupiah(balance));setText('expense',rupiah(exToday));setText('income',rupiah(incToday));
 setText('weekIncome',rupiah(sumRange(d.income||[],7)));setText('weekExpense',rupiah(sumRange(d.transactions,7)));
 const list=document.querySelector('#recent');if(list)list.innerHTML=d.transactions.slice(0,4).map(t=>tx(t)).join('')||empty('Belum ada pengeluaran. Tambahkan transaksi pertama kamu.','tambah.html','＋ Tambah Pengeluaran');
 renderTargetProgress();renderStreakAchievements(true);renderCalendar();
}
function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=v}
function sumRange(arr,days){const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-days+1);return arr.filter(x=>localDate(x.date)>=start).reduce((a,x)=>a+Number(x.amount||0),0)}
function empty(text,href,label){return `<div class="empty"><div class="empty-icon">🧾</div><p>${text}</p>${href?`<a class="btn small-btn" href="${href}">${label}</a>`:''}</div>`}
let historyFilter='all';
let historyQuery='';
function renderHistory(filter=historyFilter, query=historyQuery){
 const list=document.querySelector('#history');if(!list)return;
 historyFilter=filter;historyQuery=String(query||'').trim().toLowerCase();
 const d=data();let arr=[...(d.transactions||[])];const now=new Date();
 if(filter==='week')arr=arr.filter(t=>{const x=localDate(t.date);return x&&x>=new Date(now.getFullYear(),now.getMonth(),now.getDate()-6)});
 if(filter==='month')arr=arr.filter(t=>{const x=localDate(t.date);return x&&x.getMonth()===now.getMonth()&&x.getFullYear()===now.getFullYear()});
 if(historyQuery){
   arr=arr.filter(t=>{
     const haystack=[t.name,t.cat,t.note,t.date,dateLabel(t.date),t.time,rupiah(t.amount)].filter(Boolean).join(' ').toLowerCase();
     return haystack.includes(historyQuery);
   });
 }
 list.innerHTML=arr.map(t=>tx(t,true)).join('')||empty(historyQuery?'Tidak ada transaksi yang cocok dengan pencarian.':'Belum ada transaksi untuk periode ini.');
 setText('historyTotal',rupiah(arr.reduce((a,t)=>a+Number(t.amount||0),0)));
 setText('historyDate',filter==='all'?'Semua Transaksi':filter==='week'?'7 Hari Terakhir':'Bulan Ini');
}
function searchHistory(value){renderHistory(historyFilter,value)}
function setHistoryFilter(f,el){document.querySelectorAll('.tabs .tab').forEach(x=>x.classList.remove('active'));el.classList.add('active');renderHistory(f,historyQuery)}
function renderStats(mode='day'){
 const d=data(),el=document.querySelector('#statsTotal');if(!el)return;
 const all=d.transactions||[];
 const todayDate=localDate(today());
 let arr=[];
 if(mode==='day'){
   // Harian = 7 hari kalender yang berakhir hari ini. Jika ada transaksi
   // pada tanggal setelah hari ini (mis. data latihan), tetap ikut dihitung
   // dengan rentang yang mencakup tanggal transaksi terbaru.
   const latest=all.length?new Date(Math.max(todayDate.getTime(),...all.map(t=>localDate(t.date)?.getTime()||0))):todayDate;
   latest.setHours(0,0,0,0);
   const start=new Date(latest);start.setDate(start.getDate()-6);
   arr=all.filter(t=>{const x=localDate(t.date);return x&&x>=start&&x<=latest});
 } else if(mode==='week'){
   const latest=all.length?new Date(Math.max(todayDate.getTime(),...all.map(t=>localDate(t.date)?.getTime()||0))):todayDate;
   latest.setHours(0,0,0,0);
   const start=new Date(latest);start.setDate(start.getDate()-27);
   arr=all.filter(t=>{const x=localDate(t.date);return x&&x>=start&&x<=latest});
 } else {
   // Bulanan: bulan transaksi terbaru, tetapi minimal bulan berjalan.
   const latest=all.length?new Date(Math.max(todayDate.getTime(),...all.map(t=>localDate(t.date)?.getTime()||0))):todayDate;
   const m=latest.getMonth(),y=latest.getFullYear();
   arr=all.filter(t=>{const x=localDate(t.date);return x&&x.getMonth()===m&&x.getFullYear()===y});
 }
 const total=arr.reduce((a,t)=>a+Number(t.amount||0),0);
 const byCat={};Object.keys(CATS).forEach(c=>byCat[c]=0);
 arr.forEach(t=>{const c=CATS[t.cat]?t.cat:'Lainnya';byCat[c]+=Number(t.amount||0)});
 const entries=Object.entries(byCat).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
 setText('top',entries[0]?`${entries[0][0]} — ${rupiah(entries[0][1])}`:'Belum ada data');
 setText('statsTotal',rupiah(total));
 renderBars(all,mode);renderDonut(Object.entries(byCat),total);
}
function renderBars(all,mode){
 const box=document.querySelector('#chart');if(!box)return;
 const now=latestDate(all),points=[];
 if(mode==='day'){
   for(let i=6;i>=0;i--){
     const dt=new Date(now);dt.setHours(0,0,0,0);dt.setDate(dt.getDate()-i);const kd=dateKey(dt);
     points.push({label:dt.toLocaleDateString('id-ID',{weekday:'short'}),value:all.filter(t=>t.date===kd).reduce((a,t)=>a+Number(t.amount||0),0)})
   }
 } else if(mode==='week'){
   for(let i=3;i>=0;i--){
     const end=new Date(now);end.setHours(23,59,59,999);end.setDate(end.getDate()-i*7);
     const start=new Date(end);start.setHours(0,0,0,0);start.setDate(start.getDate()-6);
     points.push({label:`M${4-i}`,value:all.filter(t=>{const x=localDate(t.date);return x>=start&&x<=end}).reduce((a,t)=>a+Number(t.amount||0),0)})
   }
 } else {
   // Bulanan = 12 bulan dalam satu tahun. Grafik dibuat lebih lebar agar bisa digeser horizontal di HP.
   const year=now.getFullYear();
   for(let i=0;i<12;i++){
     const dt=new Date(year,i,1);
     const keyMonth=dt.getMonth();
     points.push({label:dt.toLocaleDateString('id-ID',{month:'short'}),value:all.filter(t=>{const x=localDate(t.date);return x&&x.getMonth()===keyMonth&&x.getFullYear()===year}).reduce((a,t)=>a+Number(t.amount||0),0)})
   }
 }
 const scroll=document.querySelector('#chartScroll');
 if(scroll){ scroll.classList.toggle('month-scroll',mode==='month'); scroll.classList.toggle('week-scroll',mode==='week'); }
 box.classList.toggle('chart-month',mode==='month');
 const max=Math.max(...points.map(x=>x.value),1);
 box.innerHTML=points.map(p=>`<div class="bar-wrap"><div class="bar" style="height:${Math.max(p.value/max*100,p.value?7:2)}%"><span>${p.value?rupiah(p.value).replace('Rp ',''):'0'}</span></div><small>${p.label}</small></div>`).join('')
}
function renderDonut(entries,total){
 const donut=document.querySelector('#donut'),legend=document.querySelector('#legend');if(!donut)return;
 const allEntries=Object.keys(CATS).map(c=>[c,Number((Object.fromEntries(entries))[c]||0)]);
 if(!total){
   donut.style.background='conic-gradient(#dce7e9 0 100%)';
   setText('donutCenter','Rp 0');
   if(legend)legend.innerHTML=allEntries.map(([c])=>`<div class="legend-empty"><i class="dot" style="background:#dce7e9"></i>${esc(c)} <b>0%</b></div>`).join('');
   return;
 }
 let cursor=0;const stops=[];
 allEntries.forEach(([c,v],i)=>{
   if(v<=0)return;
   const end=cursor+v/total*100;
   stops.push(`${COLORS[i]} ${cursor}% ${end}%`);cursor=end;
 });
 if(cursor<100)stops.push(`#e5ecee ${cursor}% 100%`);
 donut.style.background=`conic-gradient(${stops.join(',')})`;
 setText('donutCenter',rupiah(total));
 if(legend)legend.innerHTML=allEntries.map(([c,v],i)=>{
   const pct=v?Math.round(v/total*100):0;
   return `<div><i class="dot" style="background:${v?COLORS[i]:'#dce7e9'}"></i>${esc(c)} <b>${pct}%</b></div>`;
 }).join('');
}
function setStatsMode(m,el){document.querySelectorAll('.tabs .tab').forEach(x=>x.classList.remove('active'));el.classList.add('active');renderStats(m)}
function profile(){const k=key(PROFILE_KEY);if(localStorage.getItem(k)===null){const old=read('profilCatatanKeuangan',null);if(old) localStorage.setItem(k,JSON.stringify({name:old.name||'',email:old.email||'',photo:old.photo||''}));}return read(k,{})}
function loadProfile(){const p=profile();setText('profileName',p.name||'Nama Pengguna');setText('profileEmail',p.email||'');const av=document.querySelector('#avatar');if(av){if(p.photo){av.innerHTML=`<img src="${esc(p.photo)}" alt="Foto profil">`}else av.textContent=p.name?initials(p.name):'👤'}const t=read(key(TARGET_KEY),{});const targetAmount=Number(t.amount||0);setText('targetValue',targetAmount?rupiah(targetAmount):'Belum diatur');setText('profileTargetInfo',targetAmount?`Target harian ${rupiah(targetAmount)}${t.cat&&t.cat!=='Semua Kategori'?' · '+t.cat:''}`:'Belum ada target harian');const spent=todayExpenseForTarget();const remain=targetAmount?Math.max(0,targetAmount-spent):0;setText('profileLimitInfo',targetAmount?`Sisa hari ini ${rupiah(remain)} · terpakai ${rupiah(spent)}`:'Atur target untuk menentukan batas');setText('themeValue',localStorage.getItem(key('theme'))==='dark'?'Gelap':'Terang');const theme=localStorage.getItem(key('theme'))||'light';setText('themeValue',theme==='dark'?'Gelap':'Terang');const radio=document.querySelector(`input[name=appTheme][value="${theme}"]`);if(radio)radio.checked=true;document.querySelectorAll('.theme-option').forEach(el=>el.classList.toggle('selected',el.querySelector('input')?.value===theme));renderStreakAchievements(false);renderAchievementList()}
function openProfilePhotoPicker(){document.querySelector('#profilePhotoInput')?.click()}
function changeProfilePhoto(input){const file=input?.files?.[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)){notifyInput('Gunakan foto PNG, JPG, atau WEBP.','error','Format tidak didukung');input.value='';return}if(file.size>2*1024*1024){notifyInput('Ukuran foto maksimal 2 MB.','error','Foto terlalu besar');input.value='';return}const reader=new FileReader();reader.onload=()=>{const p=profile();p.photo=reader.result;localStorage.setItem(key(PROFILE_KEY),JSON.stringify(p));loadProfile();notifyInput('Foto profil berhasil diganti.','success','Profil diperbarui');input.value=''};reader.readAsDataURL(file)}
function initials(n){return n.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function saveTarget(){const amount=Number(document.querySelector('#targetAmount')?.value||0);if(amount<=0){notifyInput('Masukkan nominal target terlebih dahulu.','error');return}localStorage.setItem(key(TARGET_KEY),JSON.stringify({amount,cat:document.querySelector('#targetCat')?.value||'Semua Kategori',desc:document.querySelector('#targetDesc')?.value||''}));renderTargetProgress();renderStreakAchievements(false);notifyInput(`Target ${rupiah(amount)} berhasil disimpan.`,'success','Target tersimpan');setTimeout(()=>location.href='profil.html',450)}
function loadTarget(){const t=read(key(TARGET_KEY),{});const e=document.querySelector('#targetAmount');if(e&&t.amount)e.value=t.amount;const c=document.querySelector('#targetCat');if(c&&t.cat)c.value=t.cat;const d=document.querySelector('#targetDesc');if(d)d.value=t.desc||''}
function notif(){return read(key(NOTIF_KEY),{limit:true,transaction:true,daily:true,time:'08:00',permission:false})}
function saveNotif(n){localStorage.setItem(key(NOTIF_KEY),JSON.stringify(n))}
async function requestAlarmPermission(){if('Notification' in window){try{const p=await Notification.requestPermission();const n=notif();n.permission=p==='granted';saveNotif(n);notifyInput(p==='granted'?'Notifikasi perangkat berhasil diaktifkan.':'Izin notifikasi tidak diberikan. Alarm tetap bekerja saat aplikasi terbuka.',p==='granted'?'success':'warning',p==='granted'?'Notifikasi aktif':'Izin notifikasi');if(p==='granted')sendDeviceNotification('Catatan Keuangan','Notifikasi sudah aktif. Semua pengingat yang dinyalakan akan bekerja.','permission-test')}catch{notifyInput('Notifikasi perangkat tidak tersedia. Alarm tetap bekerja saat aplikasi terbuka.','warning','Notifikasi perangkat')}}else notifyInput('Notifikasi perangkat tidak tersedia. Alarm tetap bekerja saat aplikasi terbuka.','warning','Notifikasi perangkat')}
function toggleNotif(el,keyName){const n=notif();n[keyName]=!n[keyName];saveNotif(n);el.classList.toggle('off',!n[keyName]);if(n[keyName])requestAlarmPermission();notifyInput(n[keyName]?`Pengingat ${keyName==='limit'?'batas harian':keyName==='transaction'?'transaksi':'harian'} diaktifkan.`:`Pengingat ${keyName==='limit'?'batas harian':keyName==='transaction'?'transaksi':'harian'} dimatikan.`,n[keyName]?'success':'info',n[keyName]?'Notifikasi aktif':'Notifikasi dimatikan')}
function loadNotif(){const n=notif();document.querySelectorAll('[data-notif]').forEach(e=>e.classList.toggle('off',!n[e.dataset.notif]));const t=document.querySelector('#notifTime');if(t)t.value=n.time||'08:00'}
function saveNotifTime(v){const n=notif();n.time=v;saveNotif(n);notifyInput('Waktu pengingat disimpan: '+v,'success','Pengingat tersimpan')}
function showReminderModal(){
 const old=document.querySelector('#reminderModal');if(old)old.remove();
 const el=document.createElement('div');el.id='reminderModal';el.className='reminder-modal';
 el.innerHTML=`<div class="reminder-backdrop"></div><section class="reminder-card" role="dialog" aria-modal="true" aria-label="Pengingat pengeluaran"><button class="reminder-close" aria-label="Tutup">×</button><div class="reminder-icon"><span>🔔</span><i></i></div><div class="reminder-badge">PENGINGAT HARIAN</div><h2>Waktunya cek pengeluaran</h2><p>Jangan lupa catat pengeluaran hari ini supaya saldo dan statistikmu tetap akurat.</p><div class="reminder-actions"><button class="reminder-later" type="button">Nanti</button><a class="reminder-primary" href="tambah.html">＋ Catat Pengeluaran</a></div></section>`;
 document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));
 const close=()=>{el.classList.remove('show');setTimeout(()=>el.remove(),220)};
 el.querySelector('.reminder-close').onclick=close;el.querySelector('.reminder-later').onclick=close;el.querySelector('.reminder-backdrop').onclick=close;
}
let bellAudioCtx=null;
function unlockBellAudio(){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;if(!bellAudioCtx)bellAudioCtx=new C();if(bellAudioCtx.state==='suspended')bellAudioCtx.resume().catch(()=>{});}catch{}}
function playBellSound(){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;if(!bellAudioCtx)bellAudioCtx=new C();const ctx=bellAudioCtx;const start=ctx.currentTime+0.02;if(ctx.state==='suspended'){ctx.resume().then(()=>playBellSound()).catch(()=>{});return;}
  const master=ctx.createGain();master.gain.setValueAtTime(0.0001,start);master.gain.exponentialRampToValueAtTime(0.18,start+0.025);master.gain.exponentialRampToValueAtTime(0.0001,start+1.15);master.connect(ctx.destination);
  [[659.25,0.00,0.72],[987.77,0.05,0.58],[1318.51,0.11,0.45]].forEach(([freq,delay,vol])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(freq,start+delay);g.gain.setValueAtTime(0.0001,start+delay);g.gain.exponentialRampToValueAtTime(vol,start+delay+0.018);g.gain.exponentialRampToValueAtTime(0.0001,start+delay+1.0);o.connect(g);g.connect(master);o.start(start+delay);o.stop(start+delay+1.05);});
  setTimeout(()=>{try{if(ctx.state==='running'&&ctx.destination){} }catch{}},1200);
}catch{}}
window.addEventListener('pointerdown',unlockBellAudio,{once:true,passive:true});
window.addEventListener('touchstart',unlockBellAudio,{once:true,passive:true});
function alarmTick(){const n=notif();if(!n.daily)return;const now=new Date();const hh=String(now.getHours()).padStart(2,'0'),mm=String(now.getMinutes()).padStart(2,'0');const stamp=`${today()} ${hh}:${mm}`;if((n.time||'08:00')!==`${hh}:${mm}`||n.last===stamp)return;n.last=stamp;saveNotif(n);const msg='Jangan lupa catat pengeluaran hari ini supaya saldo dan statistik tetap akurat.';playBellSound();showReminderModal();if('Notification' in window&&Notification.permission==='granted')new Notification('Catatan Keuangan',{body:msg});}
function startAlarm(){loadNotif();if(!alarmTimer)alarmTimer=setInterval(alarmTick,15000);alarmTick()}
function setTheme(mode){const tk=key('theme');const value=mode==='dark'?'dark':'light';localStorage.setItem(tk,value);applyTheme();loadProfile();const r=document.querySelector(`input[name=appTheme][value="${value}"]`);if(r)r.checked=true;document.querySelectorAll('.theme-option').forEach(el=>el.classList.toggle('selected',el.querySelector('input')?.value===value));notifyInput(`Tema ${value==='dark'?'gelap':'terang'} dipilih.`,'success','Tema aplikasi')}
function toggleTheme(){const current=localStorage.getItem(key('theme'))||'light';setTheme(current==='dark'?'light':'dark')}
function applyTheme(){document.documentElement.dataset.theme=localStorage.getItem(key('theme'))||'light'}
function resetData(){if(confirm('Hapus semua transaksi, saldo, target, dan data profil akun ini?')){[key(BASE),key(PROFILE_KEY),key(TARGET_KEY),key(NOTIF_KEY),key(ACHIEVEMENT_KEY),key('theme')].forEach(k=>localStorage.removeItem(k));location.href='index.html'}}
async function login(){
 const u=normalizeUsername(document.querySelector('#username')?.value),p=document.querySelector('#password')?.value||'';
 if(!u||!p){notifyInput('Isi username dan password terlebih dahulu.','error');return;}
 const a=localAccount(u);
 const valid = a && (a.passwordHash===hashLite(p) || a.password===p); if(!valid){notifyInput('Username atau password salah. Pastikan akun sudah terdaftar di browser ini.','error','Login gagal');return;}
 if(!a.passwordHash){a.passwordHash=hashLite(p); const accounts=readAccounts(); accounts[u]=a; saveAccounts(accounts);}
 localStorage.setItem('loggedIn',a.username);
 if(!localStorage.getItem(key(PROFILE_KEY))) localStorage.setItem(key(PROFILE_KEY),JSON.stringify({name:a.name,email:a.email||''}));
 location.href='beranda.html';
}
function logout(){localStorage.removeItem('loggedIn');location.href='index.html'}
function register(){
 const name=document.querySelector('#regName')?.value.trim(),u=normalizeUsername(document.querySelector('#regUser')?.value),email=document.querySelector('#regEmail')?.value.trim(),p=document.querySelector('#regPass')?.value||'',q=document.querySelector('#regQuestion')?.value,a=document.querySelector('#regAnswer')?.value.trim(),pin=document.querySelector('#regPin')?.value.trim();
 if(!name||!u||!email||!p||!q||!a||!pin){notifyInput('Lengkapi data akun dan verifikasi keamanan terlebih dahulu.','error');return;}
 if(!/^\d{6}$/.test(pin)){notifyInput('PIN keamanan harus tepat 6 angka.','error');return;}
 if(p.length<6){notifyInput('Password minimal 6 karakter.','error');return;}
 const accounts=readAccounts();
 if(accounts[u]){notifyInput('Username sudah digunakan.','error','Pendaftaran gagal');return;}
 accounts[u]={name,username:u,email,passwordHash:hashLite(p),securityQuestion:q,securityAnswerHash:hashLite(a.toLowerCase()),securityPinHash:hashLite(pin),createdAt:Date.now()};
 saveAccounts(accounts);
 localStorage.removeItem('loggedIn');
 notifyInput('Akun berhasil dibuat. Silakan login dengan akun baru kamu.','success','Pendaftaran berhasil');
 setTimeout(()=>location.href='index.html',700);
}

const SECURITY_QUESTIONS={nama_ibu:'Siapa nama ibu kamu?',kota_lahir:'Di kota mana kamu lahir?',nama_sekolah:'Apa nama sekolah kamu?',hewan_favorit:'Apa hewan favorit kamu?'};
let passwordRecoveryUser='';
function startPasswordRecovery(){
 const u=normalizeUsername(document.querySelector('#forgotUser')?.value);
 if(!u){notifyInput('Masukkan username terlebih dahulu.','error');return;}
 const a=localAccount(u);
 if(!a){notifyInput('Username tidak ditemukan.','error','Reset password gagal');return;}
 passwordRecoveryUser=u;
 const q=document.querySelector('#forgotQuestion');if(q)q.textContent=SECURITY_QUESTIONS[a.securityQuestion]||'Verifikasi keamanan akun';
 document.querySelector('#forgotStep1').style.display='none';
 document.querySelector('#forgotStep2').style.display='block';
 document.querySelector('#forgotStep3').style.display='block';
 const ans=document.querySelector('#forgotAnswer'),pin=document.querySelector('#forgotPin');if(ans)ans.style.display='block';if(pin)pin.style.display='block';
 notifyInput('Jawab pertanyaan keamanan dan masukkan PIN 6 angka.','info','Verifikasi akun');
}
function verifyPasswordRecovery(){
 const a=localAccount(passwordRecoveryUser);
 const ans=(document.querySelector('#forgotAnswer')?.value||'').trim().toLowerCase();
 const pin=(document.querySelector('#forgotPin')?.value||'').trim();
 if(!a||hashLite(ans)!==a.securityAnswerHash||hashLite(pin)!==a.securityPinHash){notifyInput('Jawaban keamanan atau PIN salah.','error','Verifikasi gagal');return;}
 document.querySelector('#forgotStep2').style.display='none';
 document.querySelector('#forgotStep3').style.display='block';
 const np=document.querySelector('#newPassword');if(np)np.focus();
}
function resetPassword(){
 const a=localAccount(passwordRecoveryUser),np=document.querySelector('#newPassword')?.value||'',cp=document.querySelector('#confirmPassword')?.value||'';
 if(!a){notifyInput('Sesi pemulihan tidak ditemukan.','error');return;}
 if(np.length<6){notifyInput('Password baru minimal 6 karakter.','error');return;}
 if(np!==cp){notifyInput('Konfirmasi password tidak sama.','error');return;}
 const accounts=readAccounts();accounts[passwordRecoveryUser].passwordHash=hashLite(np);saveAccounts(accounts);notifyInput('Password berhasil diubah. Silakan login.','success','Password diperbarui');setTimeout(()=>location.href='index.html',800);
}

function authGuard(){
 const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 const publicPages=['index.html','login.html','daftar.html','lupa-password.html'];
 const logged=!!localStorage.getItem('loggedIn');
 if(page==='index.html' || page==='login.html'){
   if(logged) location.replace('beranda.html');
   return;
 }
 if(!publicPages.includes(page) && !logged){
   location.replace('index.html');
 }
}

function renderAll(){
 applyTheme();renderHome();renderHistory();renderStats();loadProfile();loadTarget();loadNotif();startAlarm();
}
function liveSignature(){
 const d=data();return JSON.stringify({t:(d.transactions||[]).map(x=>[x.id,x.amount,x.date,x.cat]),i:(d.income||[]).map(x=>[x.id,x.amount,x.date]),target:getTarget(),date:today()});
}
function startLiveRefresh(){
 if(liveTimer)return;
 lastLiveDate=today();lastLiveSignature=liveSignature();
 liveTimer=setInterval(()=>{
   const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
   if(['index.html','login.html','daftar.html','lupa-password.html'].includes(page))return;
   const sig=liveSignature(),dateChanged=today()!==lastLiveDate;
   if(sig!==lastLiveSignature||dateChanged){lastLiveSignature=sig;lastLiveDate=today();renderAll();}
 },1000);
}
function bootstrapApp(){
 authGuard();
 const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 if(['index.html','login.html','daftar.html','lupa-password.html'].includes(page))return;
 renderAll();startLiveRefresh();
}
// Pastikan fungsi tombol inline tetap tersedia sebagai fungsi global di browser/GitHub Pages.
window.login=login;
window.register=register;
window.addIncome=addIncome;
window.addTransaction=addTransaction;
window.openIncomeModal=openIncomeModal;
window.closeIncomeModal=closeIncomeModal;
window.logout=logout;
window.startPasswordRecovery=startPasswordRecovery;
window.verifyPasswordRecovery=verifyPasswordRecovery;
window.resetPassword=resetPassword;
window.selectCat=selectCat;
window.saveTarget=saveTarget;
window.toggleTheme=toggleTheme;
window.selectCalendarDate=selectCalendarDate;
window.renderCalendar=renderCalendar;

// AUTH FALLBACK: pastikan tombol Login/Daftar tetap aktif di GitHub Pages
function bindAuthForms(){
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  if(page==='index.html'||page==='login.html'){
    const f=document.querySelector('.auth-form');
    if(f && !f.dataset.authBound){f.dataset.authBound='1'; f.addEventListener('submit',e=>{e.preventDefault(); window.login();});}
    const b=f?.querySelector('button[type="submit"]');
    if(b && !b.dataset.authClick){b.dataset.authClick='1'; b.addEventListener('click',e=>{e.preventDefault(); window.login();});}
  }
  if(page==='daftar.html'){
    const f=document.querySelector('.auth-form');
    if(f && !f.dataset.authBound){f.dataset.authBound='1'; f.addEventListener('submit',e=>{e.preventDefault(); window.register();});}
  }
}

document.addEventListener('DOMContentLoaded',bindAuthForms);

document.addEventListener('DOMContentLoaded',bootstrapApp);

/* ===== MODERN MICRO-INTERACTIONS v28 ===== */
(function(){
  document.body.classList.add('modern-motion');
  const rippleTargets='button,.btn,.cat,.menu,.bottom a,.tab,.profile-avatar,.link';
  document.addEventListener('pointerdown',function(e){
    const el=e.target.closest(rippleTargets); if(!el || el.disabled) return;
    if(getComputedStyle(el).position==='static') el.style.position='relative';
    if(getComputedStyle(el).overflow==='visible') el.style.overflow='hidden';
    const r=document.createElement('span'); r.className='modern-ripple';
    const rect=el.getBoundingClientRect(); const size=Math.max(rect.width,rect.height)*.35;
    r.style.width=size+'px'; r.style.height=size+'px';
    r.style.left=(e.clientX-rect.left-size/2)+'px'; r.style.top=(e.clientY-rect.top-size/2)+'px';
    el.appendChild(r); setTimeout(()=>r.remove(),600);
  },{passive:true});
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>entries.forEach(x=>{if(x.isIntersecting)x.target.classList.add('modern-pop')}),{threshold:.08});
    document.querySelectorAll('.card,.mini,.list-card,.balance,.security-card,.form').forEach(el=>io.observe(el));
  }
})();
