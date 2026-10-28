(() => {
 const $=(s,r=document)=>r.querySelector(s);
 const config=window.F4NTPromoConfig||{whatsappNumber:'6281335350504',message:'Halo Admin F4NTASTIC, saya ingin bertanya mengenai layanan promosi dan peluang kerja sama.'};
 const wa=`https://wa.me/${String(config.whatsappNumber).replace(/\D/g,'')}?text=${encodeURIComponent(config.message)}`;
 document.querySelectorAll('[data-whatsapp]').forEach(a=>{a.href=wa;a.target='_blank';a.rel='noopener noreferrer';});
 const packages=window.F4NTPromoPackages||[]; const grid=$('#packageGrid');
 if(grid) grid.innerHTML=packages.map((p,i)=>`<article class="package-card ${p.className||''} reveal" style="--tier-color:${['#b9b9b9','#d8b45a','#f0d98f'][i]||'#d8b45a'}"><span class="package-tier">${p.tier}</span><div class="package-crest" aria-hidden="true">${['L','M','I'][i]||'F'}</div><h3>${p.name}</h3><p class="package-summary">${p.summary}</p><div class="package-rule"></div><ul>${p.benefits.map(b=>`<li>${b}</li>`).join('')}</ul></article>`).join('');
 const faq=window.F4NTPromoFAQ||[]; const faqGrid=$('#faqGrid'); if(faqGrid) faqGrid.innerHTML=faq.map((f,i)=>`<article class="faq-item reveal"><span class="faq-number">${String(i+1).padStart(2,'0')}</span><div><h3>${f[0]}</h3><p>${f[1]}</p></div></article>`).join('');
 const steps=window.F4NTPromoProcess||[];const track=$('#processTrack');if(track)track.innerHTML=steps.map((s,i)=>`<article class="process-step reveal"><span class="process-number">${String(i+1).padStart(2,'0')}</span><h3>${s.title}</h3><p>${s.desc}</p></article>`).join('');
 const toggle=$('#menuToggle'),nav=$('#mainNav');if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Tutup navigasi':'Buka navigasi');});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');}));}
 // Keep reveal effects lightweight and accessible.
 if('IntersectionObserver'in window&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');obs.unobserve(e.target);}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));}
})();
