/* Tasyir bmd — دفعة الملاحظات: مسح سريع، بيع عند 0، إيقاف الكمية، بحث الزبائن، أجل الديون، أرشيف العمال */
const _en=ensure;ensure=function(){_en();db.settings=Object.assign({sellZero:false,noQty:false,defTerm:0},db.settings);if(!db.alertRead||typeof db.alertRead!=='object')db.alertRead={};db.workers.forEach(w=>{if(!Array.isArray(w.log))w.log=[]})};
function applyQty(){document.documentElement.classList.toggle('nq',!!ST().noQty)}
const _at=applyTheme;applyTheme=function(){_at();applyQty()};
const _sk=setK;setK=function(k,v){_sk(k,v);if(k==='noQty'){applyQty();R()}};
const $=id=>document.getElementById(id);
/* ---------- البيع: عند الكمية 0 وإيقاف الكمية ---------- */
function doSell(paidC){if(busy)return;busy=true;let ok=0;try{const S_=ST();
 for(const l of cart){const p=db.products.find(x=>x.id===l.pid);if(!p||l.qty<=0){alert(t('nostock')+l.name);return}
  if(!S_.noQty&&!S_.allowNeg&&p.stock<l.qty&&!(S_.sellZero&&p.stock<=0)){alert(t('nostock')+l.name);return}}
 const sub_=subT(),dc=Math.min(sub_,cdisc),total=sub_-dc,paid=Math.min(total,Math.max(0,paidC)),debt=total-paid,pc=$('pcu');if(pc&&pc.value)cu=pc.value;
 if(debt>0&&!cu){alert(t('needc'));return}
 const s={id:uid(),no:'INV-'+String(++db.seq).padStart(5,'0'),d:new Date().toISOString(),day:day(),lines:cart.map(l=>({pid:l.pid,name:l.name,qty:l.qty,price:l.price,cost:l.cost,total:Math.round(l.price*l.qty),tier:l.man?'m':(l.tier||tier)})),sub:sub_,disc:dc,total,paid,debt,cust:cu||null,tier,note:cnote};
 if(!S_.noQty)s.lines.forEach(l=>{const p=db.products.find(x=>x.id===l.pid),n=r3(p.stock-l.qty);p.stock=(S_.sellZero&&!S_.allowNeg)?Math.max(0,n):n});
 if(debt>0)db.ledger.push({id:uid(),c:cu,t:'debt',a:debt,d:s.d,ref:s.no});
 db.sales.push(s);saveNow();cart=[];cu='';cdisc=0;cnote='';tier='p1';ok=1;ov.innerHTML='';receipt(s)}finally{busy=false;if(ok)R()}}
/* ---------- الماسح: بحث + عائم ---------- */
function posScan(c){const p=findP(c);if(!p)return[0,t('nof')+': '+c];if(window._lk){showProd(p);return[1,p.name]}addP(p.id,1);return[1,t('added')+p.name+' ×'+cart.find(l=>l.pid===p.id).qty]}
function showProd(p){sheet(`<h3>${esc(p.name)}</h3><div class="k">${esc(p.bc||'')}</div><div class="row"><span>${t('price')}</span><b>${M(p.price)}</b></div><div class="row"><span>${t('cost')}</span><b>${M(p.cost)}</b></div>${ST().noQty?'':`<div class="row"><span>${t('stock')}</span><b>${p.stock} ${t(p.unit||'u')}</b></div>`}<div class="bar" style="margin-top:10px"><button class="b" style="flex:1" onclick="addP('${p.id}');ov.innerHTML=''">${ic('cart')} ${t('add')}</button><button class="b s" onclick="ov.innerHTML=''">${t('ok')}</button></div>`)}
window.__nf=c=>{try{if(AND('stopScan'))Android.stopScan()}catch(e){}pForm();setTimeout(()=>{const f=$('f1');if(f){f.value=c;bcPrev()}},60)};
function fabScan(){window._nscb=posScan;if(AND('scanToggle'))Android.scanToggle(true);else scan(posScan,1)}
const _vpos=VIEWS.pos;VIEWS.pos=()=>_vpos()+`<button class="fab" onclick="fabScan()">${ic('scan')}</button>`;
/* ---------- إضافة سريعة بالمسح (المنتجات) ---------- */
const _vprod=VIEWS.prod;VIEWS.prod=()=>`<button class="b" style="width:100%;margin-bottom:10px" onclick="window._nscb=quickScan;scan(quickScan,1)">${ic('scan')} ${L('مسح وإضافة سريعة','Scan & ajout rapide','Scan & quick add')}</button>`+_vprod();
function quickScan(c){if($('qsf'))return[0,''];const p=findP(c),nq=ST().noQty,inp=(id,l,v,ty)=>`<label class="k">${l}</label><input id="${id}" type="${ty||'number'}" step="any" inputmode="${ty==='text'?'text':'decimal'}" value="${esc(v)}">`;
 const btn=`<div class="bar" style="margin-top:12px"><button class="b" style="flex:1" onclick="qsSave('${p?p.id:''}')">${t('save')}</button><button class="b s" onclick="ov.innerHTML=''">${t('cancel')}</button></div></div>`;
 if(p){sheet(`<div id="qsf"><h3>${esc(p.name)}</h3><div class="k">${esc(p.bc||'')}${nq?'':' · '+t('stock')+': '+p.stock}</div>${nq?'':inp('qq',L('الكمية المضافة','Quantité à ajouter','Quantity to add'),1)}${inp('qc',t('cost'),p.cost/100)}${inp('qp',t('price'),p.price/100)}`+btn);setTimeout(()=>{const e=$('qq')||$('qc');e&&e.focus()},80);return[1,p.name]}
 sheet(`<div id="qsf"><h3>${L('منتج جديد','Nouveau produit','New product')}</h3>${inp('qn',t('name'),'','text')}${inp('qb',t('bc'),c,'text')}${nq?'':inp('qq',t('stock'),1)}${inp('qc',t('cost'),'')}${inp('qp',t('price'),'')}<label class="k">${t('unit')}</label><select id="qu">${UN().map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select>${inp('qf',t('fam'),'','text')}`+btn);setTimeout(()=>{const e=$('qn');e&&e.focus()},80);return[1,L('أدخل بيانات المنتج','Saisissez les données','Enter product details')]}
function qsSave(id){const q=+($('qq')?$('qq').value:0)||0,c=Math.max(0,P($('qc').value)),pr=Math.max(0,P($('qp').value));
 if(id){const p=db.products.find(x=>x.id===id);if(!p)return;if(!ST().noQty)p.stock=r3(p.stock+Math.max(0,q));p.cost=c;p.price=pr}
 else{const n=$('qn').value.trim(),bc=$('qb').value.trim();if(!n)return $('qn').focus();if(bc&&db.products.some(x=>x.bc===bc&&!x.arch))return alert(t('bc')+' ');
  db.products.push({id:uid(),arch:false,img:'',name:n,bc,cost:c,price:pr,stock:ST().noQty?0:Math.max(0,q),min:0,unit:$('qu').value,fam:$('qf').value.trim(),p2:0,p3:0,tierMin:0})}
 save();ov.innerHTML='';toast('[ok] '+t('save'));R()}
/* ---------- نموذج المنتج بدون كمية ---------- */
(function(){const _p3=pForm;pForm=function(id){_p3(id);if(ST().noQty)['f4','f5'].forEach(k=>{const e=$(k);if(e){e.style.display='none';if(e.previousElementSibling)e.previousElementSibling.style.display='none'}})}})();
/* ---------- بحث الزبائن ---------- */
let cq='';const _vc=vCust;
function cuMatch(c){const q=nz(cq).trim();if(!q)return true;const h=nz(c.name)+' '+String(c.phone||'');return q.split(/\s+/).every(w=>h.includes(w))}
function custList(){const all=db.customers;db.customers=all.filter(cuMatch);try{return _vc()}finally{db.customers=all}}
function cuUp(){const e=$('cul');if(e)e.innerHTML=custList()}
VIEWS.cust=()=>`<input id="cqi" placeholder="${L('ابحث عن زبون بالاسم أو الهاتف','Rechercher un client','Search customer by name or phone')}" value="${esc(cq)}" oninput="cq=this.value;cuUp()" autocomplete="off"><div id="cul">${custList()}</div>`;
(function(){const _cs=custSel;custSel=function(){_cs();const s=$('cs');if(!s)return;s.insertAdjacentHTML('beforebegin',`<input id="csq" placeholder="${L('ابحث عن زبون','Rechercher','Search')}" oninput="csFilter()" autocomplete="off">`)}})();
function csFilter(){const s=$('cs'),q=nz($('csq').value).trim(),cur=s.value;s.innerHTML='<option value="">'+t('walk')+'</option>'+db.customers.filter(c=>!q||q.split(/\s+/).every(w=>(nz(c.name)+' '+String(c.phone||'')).includes(w))).map(c=>`<option value="${c.id}" ${cur===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
/* ---------- أجل سداد الديون + التنبيهات ---------- */
const termDays=c=>{const n=+c.term;if(n>0)return c.termU==='m'?n*30:n;return ST().defTerm>0?ST().defTerm:0};
const fmtOver=d=>{if(d<1)return L('اليوم','aujourd\'hui','today');if(d<30)return d+' '+L('يوم','j','d');const m=Math.floor(d/30),r=d%30;return m+' '+L('شهر','mois','mo')+(r?' '+L('و','et','&')+' '+r+' '+L('يوم','j','d'):'')};
function ovdList(){const now=Date.now(),by={};db.ledger.forEach(l=>{(by[l.c]=by[l.c]||[]).push(l)});const r=[];
 db.customers.forEach(c=>{const td=termDays(c),L_=by[c.id];if(!td||!L_)return;L_.sort((a,b)=>a.d<b.d?-1:1);let pay=L_.filter(l=>l.t!=='debt').reduce((a,l)=>a+l.a,0);const es=[];
  for(const l of L_){if(l.t!=='debt')continue;const use=Math.min(l.a,pay);pay-=use;const rem=l.a-use;if(rem<=0)continue;const due=new Date(l.d).getTime()+td*864e5;if(now>due)es.push({id:l.id,rem,over:Math.floor((now-due)/864e5)})}
  if(es.length)r.push({c,es,amt:es.reduce((a,e)=>a+e.rem,0),days:Math.max(...es.map(e=>e.over))})});
 return r.sort((a,b)=>b.days-a.days)}
const ovdUnread=()=>ovdList().reduce((n,x)=>n+x.es.filter(e=>!db.alertRead[e.id]).length,0);
function ovdRows(o){return o.map(x=>{const ph=String(x.c.phone||'').replace(/[^\d]/g,'').replace(/^0/,'213'),tx=L(`مرحبا ${x.c.name}، نذكّرك بأن دينك (${M(x.amt)}) تجاوز مدة السداد بـ ${fmtOver(x.days)}. شكرًا لك.`,`Bonjour ${x.c.name}, votre dette (${M(x.amt)}) a dépassé le délai de ${fmtOver(x.days)}. Merci.`,`Hello ${x.c.name}, your balance (${M(x.amt)}) is overdue by ${fmtOver(x.days)}. Thank you.`);
 const nw=x.es.some(e=>!db.alertRead[e.id]);
 return`<div class="row" style="align-items:flex-start"><div style="flex:1" onclick="dF('${x.c.id}')"><b>${esc(x.c.name)}</b> ${nw?'<span class="tag tg2">'+L('جديد','nouveau','new')+'</span>':''}<div class="k">${esc(x.c.phone||'')}</div><div class="red">${L('تجاوز المدة بـ','Retard de','Overdue by')} ${fmtOver(x.days)}</div></div><div style="text-align:end"><b class="red">${M(x.amt)}</b><div class="bar" style="margin-top:6px;justify-content:flex-end">${x.c.phone?`<a class="b sm" href="tel:${esc(x.c.phone)}">${ic('phone')}</a>`:''}<a class="b sm s" href="https://wa.me/${ph}?text=${encodeURIComponent(tx)}">${ic('chat')}</a></div></div></div>`}).join('')}
function ovdRead(o){o.forEach(x=>x.es.forEach(e=>db.alertRead[e.id]=1));const live=new Set();o.forEach(x=>x.es.forEach(e=>live.add(e.id)));Object.keys(db.alertRead).forEach(k=>{if(!live.has(k))delete db.alertRead[k]});save()}
function ovdOpen(){const o=ovdList();sheet(`<h3>${ic('alert')} ${L('ديون تجاوزت الأجل','Dettes en retard','Overdue debts')} (${o.length})</h3>`+(ovdRows(o)||`<div class="k">${t('none')}</div>`)+`<button class="b s" style="width:100%;margin-top:10px" onclick="ov.innerHTML='';R()">${t('ok')}</button>`);ovdRead(o)}
const _vdb=VIEWS.dbt;VIEWS.dbt=function(){const o=ovdList();return(o.length?`<div class="card" style="border:1.5px solid #fecaca"><b class="red">${ic('alert')} ${L('ديون تجاوزت الأجل','Dettes en retard','Overdue debts')} (${o.length})</b>${ovdRows(o)}</div>`:'')+_vdb()};
(function(){const _d=VIEWS.dash;VIEWS.dash=function(){const n=ovdUnread();return(n?`<div class="al e" onclick="ovdOpen()">${ic('alert')}<span>${L('ديون تجاوزت الأجل — اضغط للعرض','Dettes en retard — appuyez','Overdue debts — tap to view')}</span><span class="bd">${n}</span></div>`:'')+_d()}})();
(function(){const _h=hdr;hdr=function(){_h();try{if(ovdUnread()){const b=document.querySelector('header .hb');if(b)b.insertAdjacentHTML('beforeend','<i class="dot"></i>')}}catch(e){}}})();
(function(){const _dw=dwOpen;dwOpen=function(){_dw();try{if(ST().noQty)[...dw.querySelectorAll('.di')].forEach(e=>{if(/go\('(inv|cap)'\)/.test(e.getAttribute('onclick')||''))e.remove()})}catch(e){}}})();
(function(){const _c2=cForm;cForm=function(id,sel,od){_c2(id,sel,od);const c=db.customers.find(x=>x.id===id),ok=$('fok');if(!ok)return;
 ok.parentNode.insertAdjacentHTML('beforebegin',`<label class="k">${L('مدة السداد القصوى (اختياري)','Délai max de paiement','Max payment term (optional)')}</label><div class="bar"><input id="ctm" type="number" min="0" value="${c&&c.term?c.term:''}" placeholder="${ST().defTerm||0}"><select id="ctu" style="width:120px"><option value="d">${L('أيام','jours','days')}</option><option value="m" ${c&&c.termU==='m'?'selected':''}>${L('أشهر','mois','months')}</option></select></div>`);
 const o=ok.onclick;ok.onclick=function(){const n=db.customers.length,tm=Math.max(0,+$('ctm').value||0),tu=$('ctu').value;o.call(this);const q=c||(db.customers.length>n?db.customers[db.customers.length-1]:null);if(q){q.term=tm;q.termU=tu;save()}}}})();
/* ---------- العمال: أرشيف + سلف/مكافأة/إضافي ---------- */
let WAP='m';
const wkKey=(day,per)=>{if(per==='y')return day.slice(0,4);if(per==='m')return day.slice(0,7);const d=pd_(day);return iso(addD(d,-d.getDay()))};
const WTL=()=>({pay:L('راتب','Salaire','Salary'),adv:L('سلفة','Avance','Advance'),bonus:L('مكافأة','Prime','Bonus'),ot:L('ساعات إضافية','Heures sup.','Overtime'),pen:L('خصم','Retenue','Penalty')});
VIEWS.wrk=function(){const sp='event.stopPropagation();';return`<button class="b" style="width:100%;margin-bottom:10px" onclick="wForm()">${ic('plus')} ${L('عامل جديد','Nouvel employé','New worker')}</button>`+(db.workers.map(w=>{const pe=pending(w),tot=w.paid.reduce((a,x)=>a+x.net,0);
 return`<div class="card" onclick="wArch('${w.id}')"><div style="display:flex;justify-content:space-between"><b>${esc(w.name)} <span class="k">${esc(w.job||'')}</span></b><span class="tag ${w.active?'':'tg2'}">${w.active?L('نشط','Actif','Active'):L('موقوف','Pause','Paused')}</span></div>
 <div class="k">${M(w.salary)} · ${w.cycle==='w'?L('أسبوعي','Hebdo','Weekly'):L('شهري','Mensuel','Monthly')} · ${L('المدفوع','Payé','Paid')}: ${M(tot)}</div>
 ${w.adv?`<div class="k red">${L('سلفة متبقية','Avance restante','Advance due')}: ${M(w.adv)}</div>`:''}${w.adj?`<div class="k ${w.adj>0?'grn':'red'}">${L('تعديل معلّق على الراتب القادم','Ajustement en attente','Pending adjustment')}: ${w.adj>0?'+':''}${M(w.adj)}</div>`:''}
 ${pe.length&&w.active&&w.auto===false?`<div class="tag" style="background:#fef3c7;color:#92400e">${pe.length} ${L('رواتب بانتظار تأكيدك','en attente','awaiting confirmation')}</div> <button class="b sm" onclick="${sp}wPayAll('${w.id}')">${ic('check')}</button>`:''}
 <div class="bar" style="flex-wrap:wrap;margin-top:6px">${['adv','bonus','ot','pen'].map(k=>`<button class="b sm ${k==='adv'?'':'s'}" onclick="${sp}wAdj('${w.id}','${k}')">${WTL()[k]}</button>`).join('')}<button class="b sm s" onclick="${sp}wForm('${w.id}')">${ic('pencil')}</button><button class="b sm s" onclick="${sp}(db.workers.find(x=>x.id==='${w.id}').active^=1);save();R()">${ic('power')}</button></div></div>`}).join('')||`<div class="card k">${t('empty')}</div>`)};
function wAdj(id,ty){const w=db.workers.find(x=>x.id===id);if(!w)return;form(WTL()[ty],[[t('amt'),0,'number',''],[t('note'),0,'text','']],v=>{const a=P(v[0]);if(a<=0)return false;
 if(ty==='adv'){w.adv=(w.adv||0)+a;db.expenses.push({id:uid(),n:L('سلفة: ','Avance : ','Advance: ')+w.name,a,day:day(),d:new Date().toISOString(),cat:'salary',workerId:w.id})}else w.adj=(w.adj||0)+(ty==='pen'?-a:a);
 (w.log=w.log||[]).push({id:uid(),day:day(),t:ty,a,n:v[1].trim()});save();setTimeout(()=>wArch(id))})}
function wArch(id,per){if(per)WAP=per;const w=db.workers.find(x=>x.id===id);if(!w)return;const ev=[];
 w.paid.filter(x=>!x.del).forEach(x=>ev.push({day:x.day,t:'pay',a:x.net,n:x.ded?'−'+M(x.ded)+' '+L('سلفة','avance','adv.'):''}));(w.log||[]).forEach(x=>ev.push({day:x.day,t:x.t,a:x.a,n:x.n}));
 const g={};ev.forEach(e=>{(g[wkKey(e.day,WAP)]=g[wkKey(e.day,WAP)]||[]).push(e)});const ks=Object.keys(g).sort().reverse(),TL=WTL(),sm=(a,ts)=>a.filter(e=>ts.includes(e.t)).reduce((s,e)=>s+e.a,0);
 const col={pay:'',adv:'red',bonus:'grn',ot:'grn',pen:'red'};
 sheet(`<h3>${esc(w.name)}</h3><div class="k">${L('سلفة متبقية','Avance restante','Advance due')}: ${M(w.adv||0)} · ${L('تعديل معلّق','Ajust. en attente','Pending adj.')}: ${M(w.adj||0)}</div>
 <div class="chips" style="margin-top:8px">${[['w',L('أسبوعي','Hebdo','Weekly')],['m',L('شهري','Mensuel','Monthly')],['y',L('سنوي','Annuel','Yearly')]].map(([k,l])=>`<span class="ch ${WAP===k?'on':''}" onclick="wArch('${id}','${k}')">${l}</span>`).join('')}</div>`+
 (ks.map(k=>{const a=g[k];return`<div class="card" style="box-shadow:none;border:1px solid var(--ln);padding:10px"><div style="display:flex;justify-content:space-between;align-items:center"><b>${WAP==='w'?L('أسبوع من ','Semaine du ','Week of ')+k:k}</b><button class="b sm r" onclick="wArchDel('${id}','${k}')">${ic('trash')}</button></div>
 <div class="k">${TL.pay}: ${M(sm(a,['pay']))} · ${TL.adv}: ${M(sm(a,['adv']))} · +${M(sm(a,['bonus','ot']))} · −${M(sm(a,['pen']))}</div>${a.sort((x,y)=>x.day<y.day?1:-1).map(e=>`<div class="row"><span>${e.day} · ${TL[e.t]}${e.n?` <span class="k">${esc(e.n)}</span>`:''}</span><b class="${col[e.t]}">${M(e.a)}</b></div>`).join('')}</div>`}).join('')||`<div class="k">${t('none')}</div>`)+
 `<div class="bar" style="margin-top:8px"><button class="b s" style="flex:1" onclick="ov.innerHTML=''">${t('ok')}</button>${ks.length?`<button class="b r" onclick="wArchDel('${id}','*')">${L('حذف الكل','Tout supprimer','Delete all')}</button>`:''}</div>`)}
function wArchDel(id,key){const w=db.workers.find(x=>x.id===id);if(!w||!confirm(L('حذف هذا الأرشيف؟ لا يؤثر على المصاريف المسجّلة.','Supprimer cette archive ? Les dépenses restent.','Delete this archive? Recorded expenses are kept.')))return;
 w.paid.forEach(x=>{if(key==='*'||wkKey(x.day,WAP)===key)x.del=true});w.log=(w.log||[]).filter(x=>!(key==='*'||wkKey(x.day,WAP)===key));save();wArch(id)}
/* ---------- بحث الموردين (فوري: اسم/هاتف/فئة) ---------- */
let sq='';
const sn=x=>nz(x).replace(/[\u0640\s]+/g,'');
function supMatch(s,q){const k=sn(q);if(!k)return true;const f=[sn(s.name),sn(s.cat),sn(s.phone),String(s.phone||'').replace(/\D/g,'')],all=f.join('|');
 if(f.some(x=>x&&x.includes(k)))return true;const ws=nz(q).split(/\s+/).map(w=>w.replace(/\u0640/g,'')).filter(Boolean);return ws.length>1&&ws.every(w=>all.includes(w))}
function supList(){const a=db.suppliers.filter(x=>supMatch(x,sq));
 if(!db.suppliers.length)return`<div class="k">${t('empty')}</div>`;
 if(!a.length)return`<div style="text-align:center;padding:26px 8px" class="k"><div style="font-size:15px;font-weight:700;color:var(--tx)">${L('لا توجد نتائج','Aucun résultat','No results found')}</div><div style="margin:6px 0 12px">${L('لم نجد مورّدًا يطابق','Aucun fournisseur ne correspond à','No supplier matches')} «${esc(sq.trim())}»</div><button class="b s" onclick="sq='';supClr()">${ic('x')} ${L('مسح البحث','Effacer','Clear search')}</button></div>`;
 return(sq.trim()?`<div class="k" style="margin-bottom:4px">${a.length} ${L('نتيجة','résultat(s)','result(s)')}</div>`:'')+a.map(s=>{const b=sbal(s.id);return`<div class="row" onclick="sDet('${s.id}')"><div style="flex:1"><b>${esc(s.name)}</b><div class="k">${esc(s.phone||'')} ${s.cat?'· '+esc(s.cat):''}</div></div><b class="${b>0?'red':'grn'}">${M(b)}</b></div>`}).join('')}
function supUp(){const e=$('supl');if(e)e.innerHTML=supList()}
function supClr(){const i=$('sqi');if(i){i.value='';i.focus()}supUp()}
VIEWS.sup=function(){const tot=db.suppliers.reduce((a,s)=>a+Math.max(0,sbal(s.id)),0);return`<div class="card"><div class="k">${L('إجمالي ما عليك للموردين','Total dû aux fournisseurs','Total you owe suppliers')}</div><div class="v red">${M(tot)}</div></div><button class="b" style="width:100%;margin-bottom:10px" onclick="sForm()">${ic('plus')} ${t('add')}</button>
 <input id="sqi" type="search" placeholder="${L('ابحث بالاسم أو الهاتف أو الفئة','Nom, téléphone ou catégorie','Search name, phone or category')}" value="${esc(sq)}" oninput="sq=this.value;supUp()" autocomplete="off"><div class="card" id="supl">${supList()}</div>`};
/* ---------- إقلاع الدفعة ---------- */
ensure();applyQty();R();
