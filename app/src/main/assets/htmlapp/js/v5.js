/* Tasyir BMD 2.1 — الطبقة الأخيرة: لوحة القيادة، شاشة البيع، الرسوم، الإشعارات، حالات الفراغ.
   تُحمَّل بعد v4.js وتعيد تعريف دوال العرض فقط؛ منطق البيانات والبيع لم يُمسّ. */
const RM=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ---------- اهتزاز لمسي (يحترم إعداد الصوت/الاهتزاز) ---------- */
function hap(k){try{if(ST().sound===false||!navigator.vibrate)return;navigator.vibrate({tick:10,ok:[14,36,14],err:[34,50,34],warn:24}[k]||10)}catch(e){}}

/* ---------- عدّاد رقمي سلس للمجاميع ---------- */
function animNum(el,to,fmt){fmt=fmt||M;if(!el)return;const from=+el.dataset.v||0;el.dataset.v=to;
 if(RM()||from===to||!el.isConnected){el.textContent=fmt(to);return}
 const t0=performance.now(),d=Math.min(260,120+Math.abs(to-from)/200);cancelAnimationFrame(el._r);
 const st=n=>{const k=Math.min(1,(n-t0)/d),e=1-Math.pow(1-k,3);el.textContent=fmt(Math.round(from+(to-from)*e));if(k<1)el._r=requestAnimationFrame(st)};el._r=requestAnimationFrame(st);
 el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump')}

/* ---------- حالة فراغ موحّدة ---------- */
function emptyState(icon,title,text,btn,cls){return`<div class="em ${cls||''}"><div class="ei">${ic(icon)}</div><b>${title}</b>${text?`<p>${text}</p>`:''}${btn||''}</div>`}
const skeleton=n=>Array.from({length:n||3},()=>'<div class="sk" style="height:58px;margin-bottom:10px"></div>').join('');

/* ---------- إشعار علوي بأيقونة حسب النوع ---------- */
function toast(m){try{m=String(m==null?'':m);const k=m.match(/^\[(ok|warn|err|print|pause)\]\s*/);let kind='';if(k){m=m.slice(k[0].length);kind=k[1]}
 const cls={ok:'ok',print:'ok',warn:'warn',pause:'warn',err:'err'}[kind]||'',icn={ok:'checkcircle',print:'printer',warn:'alertcircle',pause:'pause',err:'xcircle'}[kind];
 let e=document.getElementById('tst');if(!e){e=document.createElement('div');e.id='tst';e.setAttribute('role','status');e.setAttribute('aria-live','polite');document.body.appendChild(e)}
 e.className=cls;e.innerHTML=(icn?ic(icn):'')+'<span>'+esc(m)+'</span>';e.style.display='flex';e.style.animation='none';void e.offsetWidth;e.style.animation='';
 if(cls==='err')hap('err');else if(cls==='ok')hap('ok');
 clearTimeout(window._tt);window._tt=setTimeout(()=>{e.style.display='none'},2800)}catch(_){}}

/* ---------- رسوم بيانية (محور زمني ثابت من اليسار لليمين) ---------- */
const PALV=i=>`var(--chart${i%8+1})`;
const cmp=v=>{v=v/100;const a=Math.abs(v);return a>=1e6?(v/1e6).toFixed(1)+'M':a>=1e4?Math.round(v/1e3)+'k':a>=1e3?(v/1e3).toFixed(1)+'k':String(Math.round(v))};
function svgBars(a){const w=320,h=140,pt=18,pb=18,mx=Math.max(1,...a.map(x=>x.v)),n=Math.max(1,a.length),bw=(w-8)/n,ih=h-pt-pb;
 const grid=[0,.5,1].map(f=>`<line class="grid" x1="0" x2="${w}" y1="${pt+ih*(1-f)}" y2="${pt+ih*(1-f)}"/>`).join('');
 const bars=a.map((x,i)=>{const bh=Math.max(x.v>0?3:0,(x.v/mx)*ih),cx=4+i*bw,last=i===n-1;
  return`<rect class="bar-r" x="${cx+bw*.18}" y="${pt+ih-bh}" width="${bw*.64}" height="${bh}" rx="${Math.min(5,bw*.2)}" fill="${last?'var(--chart1)':'color-mix(in srgb,var(--chart1) 38%,var(--sf))'}" style="animation-delay:${i*45}ms"><title>${esc(x.l)}: ${M(x.v)}</title></rect><text x="${cx+bw/2}" y="${h-4}" text-anchor="middle" style="font-size:${n>14?7:10}px">${esc(x.l)}</text>`}).join('');
 return`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(a.map(x=>x.l+': '+M(x.v)).join(' | '))}" style="direction:ltr">${grid}<text x="0" y="${pt-6}">${cmp(mx)}</text>${bars}</svg>`}
function svgLine(a){const w=320,h=120,p=14;if(!a.length)return'';const mx=Math.max(1,...a.map(x=>x.v)),st=a.length>1?(w-2*p)/(a.length-1):0;
 const pts=a.map((x,i)=>[p+i*st,h-18-(x.v/mx)*(h-38)]);let len=0;for(let i=1;i<pts.length;i++)len+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
 const d='M'+pts.map(q=>q.map(z=>z.toFixed(1)).join(',')).join(' L'),area=d+` L${pts[pts.length-1][0].toFixed(1)},${h-18} L${pts[0][0].toFixed(1)},${h-18} Z`;
 return`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(a[0].l)} → ${esc(a[a.length-1].l)}: ${M(a[a.length-1].v)}" style="direction:ltr"><line class="grid" x1="0" x2="${w}" y1="${h-18}" y2="${h-18}"/><path d="${area}" fill="var(--chart1)" opacity=".1"/><path class="ln-p" d="${d}" fill="none" stroke="var(--chart1)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="--len:${Math.ceil(len)+4}"/>${a.length<=31?pts.map(q=>`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="2.6" fill="var(--sf)" stroke="var(--chart1)" stroke-width="1.6"/>`).join(''):''}<text x="${p}" y="${h-4}">${esc(a[0].l)}</text><text x="${w-p}" y="${h-4}" text-anchor="end">${esc(a[a.length-1].l)}</text></svg>`}
function svgPie(a){const tot=a.reduce((s,x)=>s+x.v,0)||1,R0=46,r0=30;let ang=-Math.PI/2;
 const sl=a.map((x,i)=>{const f=x.v/tot,e=ang+f*2*Math.PI,l=f>.5?1:0,P=(r,q)=>[60+r*Math.cos(q),60+r*Math.sin(q)];let d;
  if(f>=.999)d=`M60,${60-R0} A${R0},${R0} 0 1 1 59.9,${60-R0} L59.9,${60-r0} A${r0},${r0} 0 1 0 60,${60-r0} Z`;
  else{const[a1,b1]=P(R0,ang),[a2,b2]=P(R0,e),[a3,b3]=P(r0,e),[a4,b4]=P(r0,ang);d=`M${a1},${b1} A${R0},${R0} 0 ${l} 1 ${a2},${b2} L${a3},${b3} A${r0},${r0} 0 ${l} 0 ${a4},${b4} Z`}
  ang=e;return`<path d="${d}" fill="${PALV(i)}" stroke="var(--sf)" stroke-width="1.5"><title>${esc(x.l)}: ${Math.round(f*100)}%</title></path>`}).join('');
 return`<div class="bar" style="gap:14px;align-items:center"><svg viewBox="0 0 120 120" width="112" height="112" role="img" aria-label="${esc(a.map(x=>x.l+' '+Math.round(x.v/tot*100)+'%').join(' | '))}">${sl}</svg><div class="lgd" style="flex-direction:column;gap:6px;flex:1;min-width:0">${a.map((x,i)=>`<div style="display:flex;align-items:center;gap:0;color:var(--tx);font-size:13px"><i class="sw" style="background:${PALV(i)}"></i><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.l)}</span><b class="num">${Math.round(x.v/tot*100)}%</b></div>`).join('')}</div></div>`}

/* ---------- الرئيسية: لوحة قيادة المتجر ---------- */
function dashCore(){const now=new Date(),td=iso(now),yd=iso(addD(now,-1)),c=stats(td,td),p=stats(yd,yd),vs=L('مقارنة بالأمس','vs hier','vs yesterday'),nq=!!ST().noQty;
 const cd=db.customers.reduce((a,x)=>a+Math.max(0,bal(x.id)),0),sd=db.suppliers.reduce((a,x)=>a+Math.max(0,sbal(x.id)),0);
 const ap=db.products.filter(x=>!x.arch),lw=ap.filter(x=>x.stock>0&&x.stock<=x.min),out=ap.filter(x=>x.stock<=0),neg=ap.filter(x=>x.stock<0).length,svl=ap.reduce((a,x)=>a+Math.round(Math.max(0,x.cost*x.stock)),0);
 const days=[];for(let i=6;i>=0;i--){const d=iso(addD(now,-i));days.push({l:d.slice(8),v:db.sales.filter(s=>s.day===d).reduce((a,s)=>a+s.total,0)})}
 const mx=Math.max(1,...days.map(x=>x.v)),f30=iso(addD(now,-29)),fam={};
 db.sales.filter(s=>s.day>=f30).forEach(s=>s.lines.forEach(l=>{const q=db.products.find(x=>x.id===l.pid),f=(q&&q.fam)||'—';fam[f]=(fam[f]||0)+l.total}));
 const fe=Object.entries(fam).sort((x,y)=>y[1]-x[1]).slice(0,5).map(([l,v])=>({l,v}));
 const kp=(cls,ico,lab,val,extra,on)=>`<div class="card kpi" ${on?`onclick="${on}" role="button" tabindex="0"`:''}><div class="si ${cls}">${ic(ico)}</div><div class="k">${lab}</div><div class="v">${val}</div>${extra||''}</div>`;
 const al=[];
 if(out.length&&!nq)al.push(`<div class="al e" onclick="iflt='out';go('inv')" role="button">${ic('alert')}<span>${out.length} ${L('منتج نافد','produit(s) épuisé(s)','out of stock')}</span></div>`);
 if(neg&&!nq)al.push(`<div class="al w">${ic('alert')}<span>${neg} ${L('منتج بمخزون سالب','stock négatif','negative stock')}</span></div>`);
 if(sd>0)al.push(`<div class="al n" onclick="go('sup')" role="button">${ic('truck')}<span>${L('ديون الموردين','Dettes fournisseurs','Supplier debts')}: ${M(sd)}</span></div>`);
 const spark=days.map((x,i)=>`<i style="height:${Math.max(7,x.v/mx*100)}%;animation-delay:${i*55}ms" title="${esc(x.l)}: ${M(x.v)}"></i>`).join('');
 const hasSales=db.sales.length>0;
 return`<div class="hero" id="hero"><div class="l">${t('today')}</div><div class="n" id="heron" data-v="0">${M(0)}</div>
 <div class="s"><span>${ic('receipt')} ${c.cnt} ${t('cnt')}</span>${p.rev?`<span class="dl">${dd(c.rev,p.rev,'')} ${vs}</span>`:''}</div>
 ${hasSales?`<div class="spark" role="img" aria-label="${esc(L('آخر 7 أيام','7 derniers jours','Last 7 days'))}: ${esc(days.map(x=>M(x.v)).join(' | '))}">${spark}</div>`:''}</div>
 <div class="qa"><button onclick="go('pos')">${'<span class="qi">'+ic('cart')+'</span>'}${L('بيع سريع','Vente','Quick sale')}</button><button onclick="go('pos');setTimeout(()=>scan(posScan,1),80)"><span class="qi">${ic('scan')}</span>${L('مسح','Scanner','Scan')}</button><button onclick="pForm()"><span class="qi">${ic('plus')}</span>${L('إضافة منتج','Nouveau','Add item')}</button><button onclick="go('${nq?'prod':'inv'}')"><span class="qi">${ic('boxes')}</span>${nq?t('prod'):L('المخزون','Stock','Stock')}</button></div>
 ${al.join('')}
 <div class="stg">${kp('ok','trend',t('profit'),M(c.gp),dd(c.gp,p.gp,'dl2'))}${kp('wn','wallet',t('expT'),M(c.ex),dd(c.ex,p.ex,'dl2'),"go('exp')")}
 ${nq?'':kp(lw.length?'wn':'ok','package',t('low'),`${lw.length}`,`<div class="k">${out.length?out.length+' '+L('نافد','épuisé(s)','out'):L('لا نافد','aucun épuisé','none out')}</div>`,"iflt='low';go('inv')")}
 ${kp('bad','book',t('debts'),`<span class="${cd?'red':''}">${M(cd)}</span>`,'',"go('dbt')")}
 ${nq?'':`<div class="kpi-w">${kp('pr','boxes',t('sval'),M(svl),`<div class="k">${ap.length} ${t('prod')}</div>`,"go('inv')")}</div>`}</div>
 <div class="card"><div class="bar" style="justify-content:space-between"><b>${L('المبيعات: آخر 7 أيام','Ventes : 7 jours','Sales: last 7 days')}</b><span class="k">${M(days.reduce((a,x)=>a+x.v,0))}</span></div>${hasSales?svgBars(days):emptyState('chart',L('لا مبيعات بعد','Pas encore de ventes','No sales yet'),L('ستظهر هنا حركة مبيعاتك بمجرد إتمام أول عملية بيع.','Vos ventes apparaîtront ici dès la première vente.','Your sales will appear here after the first sale.'),`<button class="b" onclick="go('pos')">${ic('cart')} ${L('ابدأ البيع','Commencer','Start selling')}</button>`)}</div>
 ${fe.length?`<div class="card"><b>${t('fam')} · 30</b><div style="margin-top:10px">${svgPie(fe)}</div></div>`:''}
 ${nq?'':`<div class="card"><b>${ic('alert')} ${t('low')} (${lw.length+out.length})</b>${[...lw,...out].slice(0,8).map(x=>`<div class="row"><span>${esc(x.name)}</span>${stockPill(x)}</div>`).join('')||`<div class="k" style="margin-top:6px">${t('none')}</div>`}${lw.length+out.length>8?`<div class="k" style="margin-top:8px;cursor:pointer;color:var(--pr)" onclick="iflt='low';go('inv')">${t('more')} (${lw.length+out.length-8})</div>`:''}</div>`}
 <div class="card"><b>${ic('receipt')} ${t('hist')}</b>${db.sales.slice(-8).reverse().map(s=>`<div class="row"><span><b class="num">${esc(s.no)}</b><div class="k">${new Date(s.d).toLocaleString(LC())}</div></span><span class="bar" style="gap:8px"><b class="num">${M(s.total)}</b><button class="b sm s" aria-label="${esc(t('prt'))}" onclick="receipt(db.sales.find(x=>x.id==='${s.id}'))">${ic('printer')}</button></span></div>`).join('')||`<div class="k" style="margin-top:6px">${t('none')}</div>`}</div>`}
VIEWS.dash=function(){const n=ovdUnread();return(n?`<div class="al e" onclick="ovdOpen()" role="button">${ic('alert')}<span>${L('ديون تجاوزت الأجل — اضغط للعرض','Dettes en retard — appuyez','Overdue debts — tap to view')}</span><span class="bd">${n}</span></div>`:'')+dashCore()};
const _R5=R;R=function(){_R5();if(tab==='dash'&&!sub){const e=document.getElementById('heron');if(e){const td=iso(new Date());animNum(e,stats(td,td).rev)}}};

/* ---------- حالة المخزون ---------- */
function stockState(p){return p.stock<=0?'out':p.stock<=p.min?'low':'ok'}
function stockPill(p){const s=stockState(p),lb={ok:L('متوفر','En stock','In stock'),low:L('منخفض','Faible','Low'),out:L('نافد','Épuisé','Out')}[s];return`<span class="pill ${s}">${lb}<span class="num"> · ${p.stock}</span></span>`}

/* ---------- البيع ---------- */
VIEWS.pos=function(){return`<div class="tot"><div class="ti">${ic('cart')}</div><div><div class="k2">${t('total')}</div><div class="tv" id="tv" data-v="0">${M(0)}</div></div></div>${tiersBar()}
<div class="card" style="padding:12px"><div class="bar"><div style="position:relative;flex:1"><input id="q" type="search" enterkeyhint="search" inputmode="search" placeholder="${t('search')}" aria-label="${esc(t('search'))}" oninput="find(this.value)" onkeydown="if(event.key==='Enter')enter(this.value)" autocomplete="off" style="margin:0;padding-inline-start:42px"><span style="position:absolute;inset-inline-start:13px;top:50%;transform:translateY(-50%);color:var(--mu2);pointer-events:none">${ic('search')}</span></div><button class="b" aria-label="${esc(t('scan'))}" onclick="scan(posScan,1)" style="width:50px;padding:0">${ic('camera')}</button></div><div id="rs"></div><div id="bs"></div></div>
<div class="bar" id="cn" style="margin:6px 2px 8px;flex-wrap:wrap"></div><div id="cartbox"></div><div style="height:78px"></div>
<div class="pbar"><button class="b pay" id="pbtn" onclick="payUI()">${L('الدفع','Payer','Pay')}</button><button class="b s" aria-label="${esc(t('scan'))}" onclick="scan(posScan,1)">${ic('scan')}</button><button class="b s" aria-label="${esc(L('المزيد','Plus','More'))}" onclick="posMenu()">${ic('more')}</button></div>`+`<button class="fab" aria-label="${esc(L('مسح مستمر','Scan continu','Continuous scan'))}" onclick="fabScan()">${ic('scan')}</button>`};
function bestSellers(){const b=document.getElementById('bs');if(!b)return;if(_bsK!==db.sales.length){_bsK=db.sales.length;const c={};db.sales.slice(-300).forEach(s=>s.lines.forEach(l=>c[l.pid]=(c[l.pid]||0)+l.qty));_bsV=Object.keys(c).sort((a,b)=>c[b]-c[a]).map(id=>db.products.find(p=>p.id===id)).filter(p=>p&&!p.arch).slice(0,10)}
 b.innerHTML=_bsV.length?`<div class="k" style="margin:10px 2px 6px;font-weight:700">${L('الأكثر مبيعًا','Meilleures ventes','Best sellers')}</div><div class="chips" style="padding-bottom:2px">${_bsV.map(p=>`<span class="ch" role="button" tabindex="0" onclick="addP('${p.id}')">${esc(p.name)}</span>`).join('')}</div>`:''}
function find(v){v=v.toLowerCase().trim();const box=document.getElementById('rs');if(!box)return;
 res=v?db.products.filter(p=>!p.arch&&mt(p,v)).sort((a,b)=>mt(b,v)-mt(a,v)).slice(0,8):[];
 box.innerHTML=v&&!res.length?emptyState('search',L('لا نتائج','Aucun résultat','No results'),`${L('لم يُعثر على «','Aucun produit « ','Nothing found for “')}${esc(v)}${L('»','»','”')}`):res.map(p=>`<div class="row" role="button" onclick="addP('${p.id}')" style="${p.stock<=0&&!ST().noQty?'opacity:.7':''}">${th(p)}<span style="flex:1;min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</b>${ST().noQty?'':`<span class="qt">${stockPill(p)}</span>`}</span><b class="num">${M(p.price)}</b></div>`).join('')}
const _addP5=addP;addP=function(id,q){window._fl=id;_addP5(id,q)};
const _qtyD5=qtyD;qtyD=function(i,d){const l=cart[i];if(l)window._fl=l.pid;hap('tick');_qtyD5(i,d)};
function cartUp(){const b=document.getElementById('cartbox');if(!b)return;const sub_=subT(),dc=Math.min(sub_,cdisc),c=db.customers.find(x=>x.id===cu),tot=sub_-dc;
 animNum(document.getElementById('tv'),tot);
 document.getElementById('cn').innerHTML=`<b>${t('cart')} <span class="tag">${cart.length}</span></b>${dc?`<span class="tag tg2">${t('disc')}: −${M(dc)}</span>`:''}${c?`<span class="tag">${ic('user')} ${esc(c.name)}</span>`:''}${cnote?`<span class="tag">${ic('file')} ${esc(cnote)}</span>`:''}`;
 const pb=document.getElementById('pbtn');pb.disabled=busy||!cart.length;pb.innerHTML=L('الدفع','Payer','Pay')+(cart.length?` <span class="num">· ${M(tot)}</span>`:'');
 b.innerHTML=cart.length?cart.map((l,i)=>`<div class="card ln" data-pid="${l.pid}"><div class="bar" style="align-items:flex-start"><div style="flex:1;min-width:0"><b style="display:block">${esc(l.name)}</b>${ST().tiers&&((l.tier&&l.tier!=='p1')||l.man)?`<span class="tag">${l.man?ic('pencil'):TN()[l.tier]}</span> `:''}<span class="k" role="button" onclick="pEdit(${i})" style="text-decoration:underline dotted;text-underline-offset:3px">${M(l.price)} ${ic('pencil',12)}</span></div><button class="qb" aria-label="${esc(t('del'))}" onclick="cart.splice(${i},1);hap('tick');cartUp()">${ic('x')}</button></div>
 <div class="bar" style="margin-top:10px"><div class="step"><button class="qb" aria-label="−" onclick="qtyD(${i},-1)">${ic('minus')}</button><input type="number" step="any" inputmode="decimal" aria-label="${esc(t('qty'))}" value="${l.qty}" onchange="cart[${i}].qty=Math.max(0,N(this.value));reprice();cartUp()"><button class="qb" aria-label="+" onclick="qtyD(${i},1)">${ic('plus')}</button></div><b class="num" style="margin-inline-start:auto;font-size:17px">${M(Math.round(l.price*l.qty))}</b></div></div>`).join(''):
 emptyState('scan',L('السلة فارغة','Panier vide','Cart is empty'),L('امسح باركود المنتج أو ابحث عنه بالاسم للبدء.','Scannez un code-barres ou cherchez un produit pour commencer.','Scan a barcode or search a product to begin.'));
 if(window._fl){const e=b.querySelector(`[data-pid="${window._fl}"]`);if(e&&!RM())e.classList.add('flash');window._fl=null}}
