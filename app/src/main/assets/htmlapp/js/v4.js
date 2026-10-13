/* Tasyir bmd — متابعة المتجر عن بعد (قراءة فقط، Firebase Realtime Database عبر REST، بلا صور) */
const FB='https://tasyir-bmd-default-rtdb.europe-west1.firebasedatabase.app';
const _en4=ensure;ensure=function(){_en4();if(!Array.isArray(db.shares))db.shares=[]};
const CAL='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rnd=n=>{const a=new Uint8Array(n);(window.crypto||window.msCrypto).getRandomValues(a);return Array.from(a,x=>CAL[x%32]).join('')};
const cshow=c=>c.slice(0,5)+'-'+c.slice(5);
/* ---------- ملخص خفيف (أرقام فقط) ---------- */
function sumFor(pm){const now=new Date(),td=iso(now),start=iso(addD(now,-6)),w=[0,0,0,0,0,0,0];let rev=0,cnt=0,gp=0;
 for(let i=db.sales.length-1;i>=0;i--){const s=db.sales[i];if(s.day<start)break;const k=Math.round((pd_(s.day)-pd_(start))/864e5);if(k>=0&&k<7)w[k]+=s.total;
  if(s.day===td){rev+=s.total;cnt++;gp+=s.lines.reduce((x,l)=>x+Math.round((l.price-l.cost)*l.qty),0)-s.disc}}
 const o={v:1,u:Date.now(),n:(ST().shop.name||db.shop||'Tasyir'),cur:ST().currency||'DA',d:td,rev,cnt,w};
 const ex=db.expenses.filter(e=>e.day===td).reduce((a,e)=>a+e.a,0);
 if(pm.p)o.gp=gp;if(pm.e)o.ex=ex;if(pm.p&&pm.e)o.net=gp-ex;
 if(pm.d){o.cd=db.customers.reduce((a,c)=>a+Math.max(0,bal(c.id)),0);o.sd=db.suppliers.reduce((a,s)=>a+Math.max(0,sbal(s.id)),0);o.ov=ovdList().length}
 if(pm.l&&!ST().noQty)o.low=db.products.filter(p=>!p.arch&&p.stock<=p.min).slice(0,10).map(p=>p.name.slice(0,40));
 return o}
const _lastP={};let _pushing=false;
async function pushAll(force){if(_pushing||!db.shares.length)return;_pushing=true;try{for(const sh of db.shares){if(!sh.on)continue;const o=sumFor(sh.perm),u=o.u;delete o.u;const j=JSON.stringify(o);
  if(!force&&_lastP[sh.code]&&_lastP[sh.code].j===j&&Date.now()-_lastP[sh.code].t<6e5)continue;o.u=u;
  try{const r=await fetch(FB+'/shops/'+sh.code+'.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({k:sh.k,pub:o})});
   if(r.ok){_lastP[sh.code]={j,t:Date.now()};sh.ts=Date.now();sh.err=''}else sh.err='HTTP '+r.status}catch(e){sh.err='net'}}
  save()}finally{_pushing=false}}
const _rc4=receipt;receipt=function(s){_rc4(s);setTimeout(pushAll,400)};
setInterval(()=>{if(!document.hidden)pushAll()},45000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)pushAll()});setTimeout(pushAll,3000);
/* ---------- المالك: إنشاء وإدارة الأكواد ---------- */
const PL=()=>({p:L('الأرباح','Bénéfices','Profit'),e:L('المصاريف','Dépenses','Expenses'),d:L('الديون','Dettes','Debts'),l:L('المخزون المنخفض','Stock bas','Low stock')});
SUBV.share=()=>`<div class="card"><div class="k">${L('يرى المتابع دخل اليوم وعدد الفواتير وآخر 7 أيام دائمًا (للقراءة فقط، بلا صور). أسعار الشراء والجملة لا تُرسل أبدًا. اختر ما يُضاف:','Le suiveur voit toujours les ventes du jour et 7 jours (lecture seule, sans images). Les prix d\'achat/gros ne sont jamais envoyés. Choisissez :','The follower always sees today\'s sales and 7 days (read-only, no images). Purchase/wholesale prices are never sent. Choose extras:')}</div>
 <label class="k">${t('name')}</label><input id="shn" placeholder="${L('اسم العامل / الشريك','Nom','Worker / partner name')}">
 <div class="chips" style="flex-wrap:wrap;white-space:normal;margin-top:8px">${Object.entries(PL()).map(([k,l])=>`<span class="ch" id="shp_${k}" onclick="this.classList.toggle('on')">${l}</span>`).join('')}</div>
 <button class="b" style="width:100%;margin-top:6px" onclick="shNew()">${ic('plus')} ${L('إنشاء كود متابعة','Créer un code','Create follow code')}</button></div>`+
 db.shares.map(sh=>`<div class="card"><div style="display:flex;justify-content:space-between"><b>${esc(sh.name||'—')}</b><span class="tag ${sh.on?'':'tg2'}">${sh.on?L('فعّال','Actif','Active'):L('موقوف','Arrêté','Stopped')}</span></div>
 <div class="v" style="direction:ltr;letter-spacing:2px">${cshow(sh.code)}</div><div class="k">${Object.keys(sh.perm).filter(k=>sh.perm[k]).map(k=>PL()[k]).join(' · ')||L('الأساسي فقط','Basique','Basic only')}</div>
 <div class="k">${sh.err?(ic('alert')+' ')+esc(sh.err):sh.ts?L('آخر إرسال: ','Dernier envoi : ','Last sync: ')+new Date(sh.ts).toLocaleTimeString(LC()):''}</div>
 <div class="bar" style="margin-top:8px"><button class="b sm" onclick="shShare('${sh.code}')">${ic('share')}</button>${sh.on?`<button class="b sm r" onclick="shStop('${sh.code}')">${L('إيقاف','Arrêter','Stop')}</button>`:`<button class="b sm s" onclick="shDel('${sh.code}')">${ic('trash')}</button>`}</div></div>`).join('');
async function shNew(){const pm={};Object.keys(PL()).forEach(k=>pm[k]=document.getElementById('shp_'+k).classList.contains('on'));const name=(document.getElementById('shn').value||'').trim();
 const sh={code:rnd(10),k:rnd(32),name,perm:pm,on:true,ts:0,err:''};busy_(true);
 try{const r=await fetch(FB+'/shops/'+sh.code+'.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({k:sh.k,pub:Object.assign(sumFor(pm))})});
  if(!r.ok)throw new Error('HTTP '+r.status);sh.ts=Date.now();db.shares.push(sh);save();R();shShare(sh.code)}
 catch(e){alert(L('تعذر الإنشاء. تأكد من الإنترنت ومن نسخ قواعد Firebase. ','Échec. Vérifiez internet et les règles Firebase. ','Failed. Check internet and Firebase rules. ')+e.message)}finally{busy_(false)}}
function shShare(code){const sh=db.shares.find(x=>x.code===code);if(!sh)return;sheet(`<h3>${L('كود المتابعة','Code de suivi','Follow code')}</h3><div class="v" style="direction:ltr;text-align:center;letter-spacing:3px">${cshow(code)}</div><div class="k" style="margin:8px 0">${L('أعطه للمتابع. من التطبيق: القائمة ← متابعة متجر.','Donnez-le au suiveur : menu → Suivi.','Give it to the follower: menu → Follow shop.')}</div><button class="b" style="width:100%" onclick="ov.innerHTML='';share('Tasyir bmd — ${L('كود المتابعة','code','code')}: ${cshow(code)}')">${ic('share')} ${L('مشاركة','Partager','Share')}</button>`)}
async function shStop(code){const sh=db.shares.find(x=>x.code===code);if(!sh||!confirm(t('cf')))return;busy_(true);
 try{const r=await fetch(FB+'/shops/'+code+'.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({k:sh.k,pub:{v:1,n:'—',d:iso(new Date()),off:1}})});if(!r.ok)throw 0;sh.on=false;save();R()}catch(e){alert(L('تعذر الإيقاف الآن (لا إنترنت). حاول لاحقًا.','Impossible maintenant (hors ligne).','Cannot stop now (offline). Try later.'))}finally{busy_(false)}}
function shDel(code){db.shares=db.shares.filter(x=>x.code!==code);save();R()}
const _vs4=VIEWS.set;VIEWS.set=()=>{const h=_vs4();return sub?h:`<div class="sg">${SR(ic('trend'),L('مشاركة المتابعة عن بعد','Partager le suivi à distance','Share remote follow'),L('أكواد بصلاحيات محددة','Codes avec permissions','Codes with permissions'),db.shares.filter(x=>x.on).length||'',"sub='share';R()")}${SR(ic('users'),L('متابعة متجر بكود','Suivre une boutique','Follow a shop'),'',"","go('fol')")}</div>`+h};
/* ---------- المتابع: عرض الأرقام ---------- */
const FK='tasyir_follow';let FC='';let _ft=0;
const fl=()=>{const a=jp(localStorage.getItem(FK),[]);return Array.isArray(a)?a:[]};const fsave=a=>{try{localStorage.setItem(FK,JSON.stringify(a))}catch(e){}};
const fm=(v,c)=>(v/100).toLocaleString(LC(),{minimumFractionDigits:2,maximumFractionDigits:2})+' '+(c||'DA');
VIEWS.fol=function(){const a=fl();if(!FC&&a[0])FC=a[0].code;setTimeout(folLoad,30);
 return`<div class="chips">${a.map(x=>`<span class="ch ${FC===x.code?'on':''}" onclick="FC='${x.code}';R()">${esc(x.name||cshow(x.code))}</span>`).join('')}<span class="ch" onclick="folAdd()">${ic('plus')} ${L('كود','Code','Code')}</span></div><div id="folb"><div class="card k">${a.length?'':L('أدخل كود المتابعة الذي أعطاك إياه صاحب المتجر.','Entrez le code fourni par le propriétaire.','Enter the follow code given by the shop owner.')}</div></div>`};
function folAdd(){form(L('كود المتابعة','Code de suivi','Follow code'),[[L('الكود','Code','Code'),0,'text','']],v=>{const c=v[0].toUpperCase().replace(/[^A-Z0-9]/g,'');if(!/^[A-Z2-9]{10}$/.test(c)){alert(L('كود غير صالح','Code invalide','Invalid code'));return false}
 const a=fl();if(!a.some(x=>x.code===c))a.push({code:c,name:''});fsave(a);FC=c})}
async function folLoad(){const b=document.getElementById('folb');if(!b||!FC)return;const code=FC;let o=null,off=false;
 try{const r=await fetch(FB+'/shops/'+code+'/pub.json');if(!r.ok)throw 0;o=await r.json();if(o)try{localStorage.setItem('tasyir_fc_'+code,JSON.stringify(o))}catch(e){}}catch(e){off=true;o=jp(localStorage.getItem('tasyir_fc_'+code),null)}
 if(FC!==code||!document.getElementById('folb'))return;
 if(!o){b.innerHTML=`<div class="card red">${off?L('لا يوجد اتصال ولا بيانات محفوظة','Hors ligne, pas de données','Offline, no saved data'):L('الكود غير موجود','Code introuvable','Code not found')}</div>${off?'':`<button class="b r" onclick="folDel()">${t('del')}</button>`}`;return}
 if(o.off){b.innerHTML=`<div class="card red">${L('أوقف صاحب المتجر هذه المشاركة','Le partage a été arrêté','The owner stopped this sharing')}</div><button class="b r" onclick="folDel()">${t('del')}</button>`;return}
 const a=fl(),x=a.find(z=>z.code===code);if(x&&x.name!==o.n){x.name=o.n;fsave(a)}
 const ago=Math.max(0,Math.round((Date.now()-o.u)/60000)),c=o.cur,days=(o.w||[]).map((v,i)=>({l:iso(addD(pd_(o.d),i-6)).slice(8),v}));
 const st=(k,v,cl)=>`<div class="card"><div class="k">${k}</div><div class="v ${cl||''}">${v}</div></div>`;
 b.innerHTML=`<div class="hero"><div class="l">${esc(o.n)} · ${L('مبيعات اليوم','Ventes du jour','Today\'s sales')}</div><div class="n">${fm(o.rev,c)}</div><div class="s"><span>${o.cnt} ${t('cnt')}</span><span>${off?L('غير متصل — بيانات محفوظة','hors ligne','offline — saved'):''} ${L('آخر تحديث منذ','Mise à jour il y a','Updated')} ${ago<1?L('لحظات','instants','moments ago'):ago+' '+L('د','min','min')}</span></div></div>
 <div class="stg">${o.gp!=null?st(L('الربح','Profit','Profit'),fm(o.gp,c),'grn'):''}${o.ex!=null?st(L('المصاريف','Dépenses','Expenses'),fm(o.ex,c)):''}${o.net!=null?st(L('الصافي','Net','Net'),fm(o.net,c)):''}${o.cd!=null?st(L('ديون الزبائن','Dettes clients','Customer debts'),fm(o.cd,c),'red'):''}${o.sd!=null?st(L('ديون الموردين','Dettes fourn.','Supplier debts'),fm(o.sd,c)):''}${o.ov?st(L('ديون متأخرة','En retard','Overdue'),o.ov,'red'):''}</div>
 <div class="card"><b>${L('آخر 7 أيام','7 derniers jours','Last 7 days')}</b>${svgBars(days)}</div>${o.low&&o.low.length?`<div class="card"><b>${t('low')}</b>${o.low.map(n=>`<div class="row"><span>${esc(n)}</span></div>`).join('')}</div>`:''}<button class="b s" style="width:100%" onclick="folDel()">${L('إزالة هذا الكود','Retirer ce code','Remove this code')}</button>`;
 clearTimeout(_ft);_ft=setTimeout(()=>{if(tab==='fol'&&!document.hidden)folLoad()},20000)}
function folDel(){if(!confirm(t('cf')))return;fsave(fl().filter(x=>x.code!==FC));FC='';R()}
(function(){const _h=hdr;hdr=function(){_h();const e=document.getElementById('ttl');if(!e)return;if(tab==='fol'&&!sub)e.textContent=L('متابعة متجر','Suivi boutique','Follow shop');else if(sub==='share')e.textContent=L('المتابعة عن بعد','Suivi à distance','Remote follow')}})();
(function(){const _dw=dwOpen;dwOpen=function(){_dw();dw.insertAdjacentHTML('beforeend',`<div class="di" onclick="go('fol')"><span>${ic('trend')}</span>${L('متابعة متجر عن بعد','Suivi à distance','Follow a shop')}</div>`)}})();
/* ---------- رواتب العمال: الصافي = الأساسي + المكافآت − السلف − الخصومات (تحديث تلقائي) ---------- */
const _en5=ensure;ensure=function(){_en5();db.workers.forEach(w=>{if(w.pb==null&&w.pd==null){const a=w.adj||0;w.pb=a>0?a:0;w.pd=a<0?-a:0}else{if(w.pb==null)w.pb=0;if(w.pd==null)w.pd=0}})};
function wBreak(w){let b=w.pb||0,d=w.pd||0;const r=(w.adj||0)-(b-d);if(r>0)b+=r;else if(r<0)d-=r;
 const sal=w.salary||0,gross=Math.max(0,sal+b-d),adv=Math.min(w.adv||0,gross);return{sal,b,d,adv,carry:(w.adv||0)-adv,net:gross-adv}}
payPeriod=function(w,date){const key=w.id+':'+date;if(w.paid.some(x=>x.k===key)||db.expenses.some(e=>e.periodKey===key))return false;
 const q=wBreak(w),gross=q.net+q.adv,net=q.net;w.adv=(w.adv||0)-q.adv;w.adj=0;w.pb=0;w.pd=0;
 if(net>0)db.expenses.push({id:uid(),n:L('راتب: ','Salaire : ','Salary: ')+w.name,a:net,day:date,d:pd_(date).toISOString(),cat:'salary',workerId:w.id,periodKey:key});
 w.paid.push({k:key,day:date,gross,ded:q.adv,net,bon:q.b,oth:q.d});return true};
wAdj=function(id,ty){const w=db.workers.find(x=>x.id===id);if(!w)return;form(WTL()[ty],[[t('amt'),0,'number',''],[t('note'),0,'text','']],v=>{const a=P(v[0]);if(a<=0)return false;
 if(ty==='adv'){w.adv=(w.adv||0)+a;db.expenses.push({id:uid(),n:L('سلفة: ','Avance : ','Advance: ')+w.name,a,day:day(),d:new Date().toISOString(),cat:'salary',workerId:w.id})}
 else if(ty==='pen'){w.pd=(w.pd||0)+a;w.adj=(w.adj||0)-a}else{w.pb=(w.pb||0)+a;w.adj=(w.adj||0)+a}
 (w.log=w.log||[]).push({id:uid(),day:day(),t:ty,a,n:v[1].trim()});save();setTimeout(()=>wArch(id))})};
VIEWS.wrk=function(){const sp='event.stopPropagation();';let tot=0,n=0;
 const rw=(l,v,c,s)=>`<div class="row" style="padding:4px 0"><span class="k">${l}</span><span class="${c||''}">${s||''}${M(v)}</span></div>`;
 const cards=db.workers.map(w=>{const pe=pending(w),paid=w.paid.reduce((a,x)=>a+x.net,0),q=wBreak(w);if(w.active){tot+=q.net;n++}
  return`<div class="card" onclick="wArch('${w.id}')"${w.active?'':' style="opacity:.65"'}><div style="display:flex;justify-content:space-between"><b>${esc(w.name)} <span class="k">${esc(w.job||'')}</span></b><span class="tag ${w.active?'':'tg2'}">${w.active?L('نشط','Actif','Active'):L('موقوف','Pause','Paused')}</span></div>
 <div class="k">${w.cycle==='w'?L('أسبوعي','Hebdo','Weekly'):L('شهري','Mensuel','Monthly')} · ${L('المدفوع','Payé','Paid')}: ${M(paid)}</div>
 <div style="margin:6px 0 2px">${rw(L('الراتب الأساسي','Salaire de base','Base salary'),q.sal,'','')}${rw(L('المكافآت','Primes','Bonuses'),q.b,'grn','+')}${rw(L('السلف','Avances','Advances'),q.adv,'red','−')}${rw(L('خصومات أخرى','Autres retenues','Other deductions'),q.d,'red','−')}
 <div class="row" style="padding:6px 0 2px;border-top:1px solid var(--ln,#e2e8f0)"><b>${L('الصافي','Net à payer','Net pay')}</b><b>${M(q.net)}</b></div>${q.carry>0?`<div class="k red">${L('سلفة مرحّلة للدورة القادمة','Avance reportée','Advance carried over')}: ${M(q.carry)}</div>`:''}</div>
 ${pe.length&&w.active&&w.auto===false?`<div class="tag" style="background:#fef3c7;color:#92400e">${pe.length} ${L('رواتب بانتظار تأكيدك','en attente','awaiting confirmation')}</div> <button class="b sm" onclick="${sp}wPayAll('${w.id}')">${ic('check')}</button>`:''}
 <div class="bar" style="flex-wrap:wrap;margin-top:6px">${['adv','bonus','ot','pen'].map(k=>`<button class="b sm ${k==='adv'?'':'s'}" onclick="${sp}wAdj('${w.id}','${k}')">${WTL()[k]}</button>`).join('')}<button class="b sm s" onclick="${sp}wForm('${w.id}')">${ic('pencil')}</button><button class="b sm s" onclick="${sp}(db.workers.find(x=>x.id==='${w.id}').active^=1);save();R()">${ic('power')}</button></div></div>`}).join('');
 return`<button class="b" style="width:100%;margin-bottom:10px" onclick="wForm()">${ic('plus')} ${L('عامل جديد','Nouvel employé','New worker')}</button>`+
 (db.workers.length?`<div class="card"><div class="row" style="padding:2px 0"><b>${L('مجموع الصافي','Total net','Total net')}</b><b>${M(tot)}</b></div><div class="k">${n} ${L('عامل نشط','employé(s) actif(s)','active worker(s)')}</div></div>`:'')+(cards||`<div class="card k">${t('empty')}</div>`)};
ensure();R();
