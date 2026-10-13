/* Tasyir BMD — سلوك الواجهة المشترك: تموّج اللمس (التصميم في css/app.css، الأيقونات في js/icons.js) */
document.addEventListener('pointerdown',e=>{const t=e.target.closest&&e.target.closest('.b,.ch,.sr,.di,.qa button');
 if(!t||t.disabled||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
 const r=t.getBoundingClientRect(),s=Math.max(r.width,r.height)*2,i=document.createElement('span');
 i.className='rp';i.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;
 t.appendChild(i);setTimeout(()=>i.remove(),600)},{passive:true});

/* الخط المحلي (اختياري): إن وُجد fonts/TasyirSans.woff2 يُحمَّل، وإلا يُستعمل خط النظام العربي */
try{if(window.FontFace&&document.fonts){new FontFace('TasyirSans','url(../fonts/TasyirSans.woff2)',{weight:'300 900',display:'swap'}).load().then(f=>document.fonts.add(f)).catch(()=>{})}}catch(_){}
