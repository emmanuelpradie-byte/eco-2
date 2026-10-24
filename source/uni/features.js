
// ══════════════════════════════════════════════════════════════
// IDENTITÉ VISUELLE · ACCUEIL · ALLERGÈNES · FOURNISSEURS · FICHE TECHNIQUE
// ══════════════════════════════════════════════════════════════

// ── Icônes au trait ───────────────────────────────────────────
var ICONS=/*ICONS_JSON*/{};
function ic(n,c){ return '<svg class="ic'+(c?' '+c:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[n]||ICONS.info)+'</svg>'; }
function catIcon(cat){
  var k=CATI[cat];
  if(!k){
    var s=normTxt(cat);
    k=/farin|cereal|grain|ble\b/.test(s)?'wheat':/beurre|creme|lait|matiere|mg\b/.test(s)?'droplet':/sucre|miel|sirop/.test(s)?'cube':
      /levure|levain/.test(s)?'bubbles':/oeuf/.test(s)?'egg':/sel|epice|epicerie/.test(s)?'salt':/fruit|garniture|chocolat|fourrage/.test(s)?'cherry':
      /emballage|carton/.test(s)?'box':'tag';
  }
  return ic(k);
}
function normTxt(s){ return String(s||'').toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae').normalize('NFD').replace(/[̀-ͯ]/g,''); }

// ── Formats français ──────────────────────────────────────────
function fNum(n,d){ return (Number(n)||0).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:(d==null?3:d),useGrouping:false}); }
function fKg(n){ return fNum(n,3)+' kg'; }
function fKgUp(n){ return fNum(ceil3(n),3)+' kg'; }
function fQtyNice(kg){ kg=Number(kg)||0; if(kg>0&&kg<1) return fNum(kg*1000,1)+' g'; return fNum(kg,3)+' kg'; }
function fPct(x){ return (x>0?'+':'')+fNum(x*100,1)+' %'; }

// ── Profil ────────────────────────────────────────────────────
function loadProfile(){ try{ return JSON.parse(LS.getItem('v4_profile')||'{}')||{}; }catch(e){ return {}; } }
function saveProfileUI(){
  var p=loadProfile();
  p.name=(document.getElementById('pf-name').value||'').trim();
  p.shop=(document.getElementById('pf-shop').value||'').trim();
  LS.setItem('v4_profile',JSON.stringify(p));
  toast('Profil enregistré','ok'); renderHome();
}

// ── Images de recette ─────────────────────────────────────────
function recHasPhoto(r){ return !!(r&&r.image&&r.image.length>4); }
function recEmoji(r){ var e=r&&r.image; return (e&&e.length<=4&&e!=='📖'&&e!=='⊛')?e:''; }
function recThumb(r){
  if(recHasPhoto(r)) return '<img src="'+esc(r.image)+'" alt="">';
  return recEmoji(r)||ic(r&&r.image==='⊛'?'sub':'book');
}

// ══ ALLERGÈNES (règlement INCO, annexe II) ════════════════════
var ALLERGENS=[
  {k:'gluten',n:'Gluten'},{k:'crustaces',n:'Crustacés'},{k:'oeufs',n:'Œufs'},{k:'poissons',n:'Poissons'},
  {k:'arachides',n:'Arachides'},{k:'soja',n:'Soja'},{k:'lait',n:'Lait'},{k:'fruits_coque',n:'Fruits à coque'},
  {k:'celeri',n:'Céleri'},{k:'moutarde',n:'Moutarde'},{k:'sesame',n:'Sésame'},{k:'sulfites',n:'Sulfites'},
  {k:'lupin',n:'Lupin'},{k:'mollusques',n:'Mollusques'}
];
function algLabel(k){ for(var i=0;i<ALLERGENS.length;i++) if(ALLERGENS[i].k===k) return ALLERGENS[i].n; return k; }
function algSort(keys){ return ALLERGENS.map(function(a){return a.k;}).filter(function(k){ return keys.indexOf(k)>=0; }); }
// Reconnaissance à partir du nom — une suggestion, toujours à vérifier
function suggestAllergens(name){
  var s=' '+normTxt(name).replace(/[’']/g,' ').replace(/[^a-z0-9]+/g,' ')+' ', out=[];
  function add(k){ if(out.indexOf(k)<0) out.push(k); }
  var noGlutenFlour=/ (riz|sarrasin|mais|chataigne|pois chiche|coco|amande|noisette|lupin|soja|teff|quinoa|manioc|tapioca|millet|sorgho|lin|souchet|banane|pomme de terre) /.test(s);
  if(/ (ble|froment|seigle|epeautre|orge|avoine|kamut|khorasan|engrain|triticale|gluten|semoule|chapelure|panko|malt|boulgour|couscous|levain|biere|pain|brioche|biscuit|biscuits|croissant|feuilletee|crumble|speculoos|t45|t55|t65|t80|t110|t130|t150|t170) /.test(s)) add('gluten');
  if(/ farines? /.test(s) && !noGlutenFlour) add('gluten');
  if(/ sauce soja /.test(s)) add('gluten');
  var notMilk=/ (lait|creme|yaourt) (de |d )?(coco|amande|soja|riz|avoine|noisette) | beurre de (cacao|cacahuete|karite) /.test(s);
  if(!notMilk && / (lait|laits|beurre|creme|fromage|fromages|yaourt|yogourt|lactose|lactoserum|mascarpone|ricotta|mozzarella|emmental|comte|parmesan|gruyere|chevre|brebis|philadelphia|ghee|caseine|babeurre|chantilly|lacte|lactee|lactique|feta|cheddar|raclette|reblochon|camembert|brie|roquefort|bleu|burrata) /.test(s)) add('lait');
  if(/ chocolat (au lait|blanc) /.test(s)) add('lait');
  if(/ (oeuf|oeufs|albumine|ovoproduits?|meringue|mayonnaise) /.test(s) || / (jaunes?|blancs?) d? ?oeufs? /.test(s)) add('oeufs');
  if(/ (amande|amandes|noisette|noisettes|pistache|pistaches|pecan|pecans|cajou|macadamia|praline|pralin|gianduja|frangipane|massepain|nougat|nougatine|marron glace) /.test(s) || (/ noix /.test(s) && !/ noix (de )?(coco|muscade) /.test(s))) add('fruits_coque');
  if(/ (arachide|arachides|cacahuete|cacahuetes) /.test(s)) add('arachides');
  if(/ (soja|soya|tofu|edamame|miso|tamari) /.test(s)) add('soja');
  if(/ (sesame|tahin|tahini|gomasio) /.test(s)) add('sesame');
  if(/ moutarde /.test(s)) add('moutarde');
  if(/ celeri /.test(s)) add('celeri');
  if(/ lupin /.test(s)) add('lupin');
  if(/ (poisson|poissons|saumon|thon|cabillaud|anchois|truite|sardine|sardines|maquereau|colin|merlu|daurade|hareng|morue|eglefin|haddock|surimi|tarama|bonite) /.test(s)) add('poissons');
  if(/ (crevette|crevettes|crabe|homard|langoustine|langoustines|ecrevisse|ecrevisses|gambas|langouste|surimi) /.test(s)) add('crustaces');
  if(/ (moule|moules|huitre|huitres|calamar|calamars|seiche|poulpe|escargot|escargots|saint jacques|bulot|bulots|palourde|palourdes) /.test(s)) add('mollusques');
  if(/ (vin|sulfite|sulfites|vinaigre|cidre|biere|porto|madere|abricots? secs?|raisins? secs?) /.test(s)) add('sulfites');
  return algSort(out);
}
// Produits courants sans allergène réglementaire
function knownAllergenFree(name){
  var s=' '+normTxt(name).replace(/[^a-z0-9]+/g,' ')+' ';
  return / (sucre|cassonade|vergeoise|sel|eau|levure fraiche|levure seche|levure boulangere|levure de boulanger|vanille|cannelle|poivre|miel|glucose|dextrose|sirop|fecule|amidon|maizena|gelatine|agar|pectine|bicarbonate|huile|olive|tournesol|colza|cacao|poudre de cacao|pomme|pommes|poire|fraise|framboise|framboises|citron|orange|banane|abricot|peche|cerise|myrtille|cassis|mangue|ananas|fruit de la passion|rhubarbe|chocolat noir|gousse|herbes|thym|romarin|basilic|persil|ail|oignon|tomate|courgette|epinard|pomme de terre|pavot|lin|tournesol|courge|potiron|isomalt|trimoline|neutre|colorant|arome) /.test(s) && !suggestAllergens(name).length;
}
var ALG_EDIT={};
function renderAlgPicker(pfx){
  var box=document.getElementById(pfx+'-alg'); if(!box) return;
  var st=ALG_EDIT[pfx]||(ALG_EDIT[pfx]={keys:[],none:false,touched:false});
  box.innerHTML='<div class="alg-grid">'+ALLERGENS.map(function(a){
    var on=st.keys.indexOf(a.k)>=0;
    return '<div class="alg-t'+(on?' on':'')+'" onclick="toggleAlg(\''+pfx+'\',\''+a.k+'\')"><span class="ck">'+(on?ic('check'):'')+'</span>'+esc(a.n)+'</div>';
  }).join('')+'</div>'+
  '<label class="alg-none"><input type="checkbox" '+(st.none?'checked':'')+' onchange="toggleAlgNone(\''+pfx+'\')"> Ne contient aucun des 14 allergènes</label>'+
  (st.auto?'<div class="alg-note warn">'+ic('alert')+' Déduits automatiquement du nom — vérifiez la fiche produit du fournisseur.</div>':
   (!st.keys.length&&!st.none?'<div class="alg-note">Non renseigné : la recette signalera cet ingrédient comme « à compléter ».</div>':''));
}
function toggleAlg(pfx,k){ var st=ALG_EDIT[pfx]; var i=st.keys.indexOf(k); if(i>=0) st.keys.splice(i,1); else st.keys.push(k); st.keys=algSort(st.keys); st.none=false; st.auto=false; st.touched=true; renderAlgPicker(pfx); }
function toggleAlgNone(pfx){ var st=ALG_EDIT[pfx]; st.none=!st.none; if(st.none) st.keys=[]; st.auto=false; st.touched=true; renderAlgPicker(pfx); }
function suggestAllerg(pfx){
  var name=(document.getElementById(pfx+'-n')||{}).value||'';
  var s=suggestAllergens(name), st=ALG_EDIT[pfx];
  if(s.length){ st.keys=algSort(st.keys.concat(s.filter(function(k){return st.keys.indexOf(k)<0;}))); st.none=false; toast(s.length+' allergène(s) reconnu(s) — à vérifier','info'); }
  else if(knownAllergenFree(name)){ st.keys=[]; st.none=true; toast('Produit habituellement sans allergène — à vérifier','info'); }
  else toast('Aucun allergène reconnu dans le nom','info');
  st.touched=true; st.auto=false; renderAlgPicker(pfx);
}
function ingNameTyped(pfx){
  var st=ALG_EDIT[pfx]; if(!st||st.touched) return;
  var name=(document.getElementById(pfx+'-n')||{}).value||'';
  st.keys=suggestAllergens(name); st.none=!st.keys.length&&knownAllergenFree(name);
  renderAlgPicker(pfx);
}
function readAlgPicker(pfx,ing){
  var st=ALG_EDIT[pfx]; if(!st||!ing) return;
  ing.allergens=st.keys.slice();
  ing.allergensSet=!!(st.none||st.keys.length);
  ing.allergensAuto=false;
}
function allergensOfFlat(flat){
  var keys=[], unk=[], auto=[];
  flat.forEach(function(fi){
    var ing=ingredients.find(function(x){return x.id===fi.ingId;}); if(!ing) return;
    if(!ing.allergensSet){ if(unk.indexOf(ing.name)<0) unk.push(ing.name); return; }
    (ing.allergens||[]).forEach(function(k){ if(keys.indexOf(k)<0) keys.push(k); });
    if(ing.allergensAuto&&auto.indexOf(ing.name)<0) auto.push(ing.name);
  });
  return {keys:algSort(keys), unknown:unk, auto:auto};
}
function recAllergens(id){ return allergensOfFlat(flatten(id)); }
function algChips(keys,cls){ return keys.map(function(k){ return '<span class="alg'+(cls?' '+cls:'')+'">'+esc(algLabel(k))+'</span>'; }).join(''); }
function algBlock(a){
  return '<div class="alg-box">'+(a.keys.length?algChips(a.keys):(a.unknown.length?'':'<span class="alg" style="background:#E5F2EA;border-color:#CBE3D3;color:var(--gr)">'+ic('check')+' Aucun allergène</span>'))+'</div>'+
    (a.unknown.length?'<div class="alg-note warn">'+ic('alert')+' Non renseignés : '+esc(a.unknown.join(', '))+'. Complétez-les dans le catalogue.</div>':'')+
    (a.auto.length?'<div class="alg-note">Déduits automatiquement (à vérifier) : '+esc(a.auto.join(', '))+'.</div>':'');
}
function renderRecAllergens(){
  var box=document.getElementById('r-allerg'); if(!box) return;
  if(!recItems.length){ box.innerHTML='<div class="alg-note">Ajoutez des ingrédients pour voir les allergènes de la recette.</div>'; return; }
  var tmp={id:'__alg__',name:'',cat:'',image:'',notes:'',items:recItems}, orig=recipes;
  recipes=orig.concat([tmp]);
  var a; try{ a=recAllergens('__alg__'); } finally { recipes=orig; }
  box.innerHTML=algBlock(a);
}
function autoAllergens(){
  var done=0, free=0, left=0;
  ingredients.forEach(function(i){
    if(i.allergensSet) return;
    var s=suggestAllergens(i.name);
    if(s.length){ i.allergens=s; i.allergensSet=true; i.allergensAuto=true; done++; }
    else if(knownAllergenFree(i.name)){ i.allergens=[]; i.allergensSet=true; i.allergensAuto=true; free++; }
    else left++;
  });
  persist(); renderCat();
  toast((done+free)?((done+free)+' ingrédient(s) complété(s) — à vérifier'+(left?' · '+left+' à renseigner à la main':'')):(left?left+' ingrédient(s) à renseigner à la main':'Tous les allergènes sont déjà renseignés'),'ok');
}

// ══ MÉTADONNÉES DES INGRÉDIENTS ═══════════════════════════════
// Appelé à chaque enregistrement : un ingrédient créé ailleurs (import de
// recette…) reçoit son historique de prix et des allergènes suggérés.
function ingMetaHook(){
  ingredients.forEach(function(i){
    if(i._m) return;
    i._m=1; if(!i.createdAt) i.createdAt=now();
    if(!i.priceHistory){ var bp=(i.buyPrice!=null?i.buyPrice:i.price); i.priceHistory=bp>0?[{d:today(),p:bp,u:i.unit||'kg',k:i.price}]:[]; }
    if(!i.allergensSet){
      var s=suggestAllergens(i.name);
      if(s.length){ i.allergens=s; i.allergensSet=true; i.allergensAuto=true; }
      else if(knownAllergenFree(i.name)){ i.allergens=[]; i.allergensSet=true; i.allergensAuto=true; }
    }
  });
}
function pushPriceHistory(ing,before){
  if(!ing) return;
  var h=ing.priceHistory||(ing.priceHistory=[]);
  if(!h.length&&before&&before.p>0) h.push({d:null,p:before.p,u:before.u,k:before.k});
  var last=h[h.length-1];
  var e={d:today(),p:ing.buyPrice,u:ing.unit,k:ing.price};
  if(last&&last.d===e.d) h[h.length-1]=e; else h.push(e);
  while(h.length>24) h.shift();
}
function priceTrend(ing){
  var h=(ing&&ing.priceHistory)||[]; if(h.length<2) return null;
  var a=h[h.length-2].k, b=h[h.length-1].k; if(!(a>0)||!(b>0)||a===b) return null;
  return (b-a)/a;
}
function trendHtml(t){ if(t==null) return ''; return '<span class="trend '+(t>0?'up':'dn')+'">'+ic(t>0?'up':'down')+fPct(t)+'</span>'; }
function renderPriceHistory(ing){
  var box=document.getElementById('edit-cat-hist'); if(!box) return;
  var h=(ing&&ing.priceHistory)||[];
  if(h.length<1){ box.innerHTML=''; return; }
  var ks=h.map(function(e){return e.k||0;}), mx=Math.max.apply(null,ks), mn=Math.min.apply(null,ks);
  var spark='';
  if(h.length>1&&mx>0){
    var pts=ks.map(function(k,i){ var x=4+i*(292/(ks.length-1)); var y=30-((k-mn)/((mx-mn)||1))*26; return x.toFixed(1)+','+y.toFixed(1); }).join(' ');
    spark='<svg class="ph-spark" viewBox="0 0 300 34" preserveAspectRatio="none"><polyline points="'+pts+'" fill="none" stroke="#231F20" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>';
  }
  box.innerHTML='<div class="ph-list"><div class="ph-t">'+ic('chart')+' Historique des prix</div>'+spark+
    h.slice().reverse().slice(0,8).map(function(e,i,arr){
      var prev=arr[i+1], v=(prev&&prev.k>0&&e.k>0&&prev.k!==e.k)?(e.k-prev.k)/prev.k:null;
      return '<div class="ph-r"><span>'+(e.d?fDate(e.d):'Avant le suivi')+'</span><span><b>'+fEur(e.p)+'</b> / '+esc(e.u||'kg')+(e.u&&e.u!=='kg'&&e.k?' <span style="color:var(--i4)">('+fEur(e.k)+'/kg)</span>':'')+' '+trendHtml(v)+'</span></div>';
    }).join('')+'</div>';
}

// ══ FOURNISSEURS ══════════════════════════════════════════════
var suppliers=DB.load('v4_suppliers',[]);
function saveSuppliers(){ DB.save('v4_suppliers',suppliers); }
function supById(id){ return id?suppliers.find(function(s){return s.id===id;})||null:null; }
function supName(id){ var s=supById(id); return s?s.name:''; }
function supInfo(s){ return s?[s.contact,s.phone,s.email].filter(Boolean).join(' · '):''; }
function supSorted(){ return suppliers.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'fr'); }); }
function fillSupSelect(id,sel){
  var e=document.getElementById(id); if(!e) return;
  e.innerHTML='<option value="">— Aucun —</option>'+supSorted().map(function(s){ return '<option value="'+s.id+'"'+(s.id===sel?' selected':'')+'>'+esc(s.name)+'</option>'; }).join('')+'<option value="__new__">＋ Nouveau fournisseur…</option>';
  e.value=sel||'';
}
function addSupplier(name){
  name=String(name||'').trim(); if(!name) return null;
  var ex=suppliers.find(function(s){ return normTxt(s.name)===normTxt(name); }); if(ex) return ex;
  var s={id:uid(),name:name,contact:'',phone:'',email:'',notes:''};
  suppliers.push(s); saveSuppliers(); return s;
}
function handleSupSelect(sel){
  if(sel.value!=='__new__') return;
  askText('Nouveau fournisseur','Nom du fournisseur',function(name){
    var s=name?addSupplier(name):null;
    fillSupSelect(sel.id,s?s.id:'');
  });
}
function openSupplier(id){
  var s=supById(id)||{id:'',name:'',contact:'',phone:'',email:'',notes:''};
  document.getElementById('sup-title').textContent=id?'Modifier le fournisseur':'Nouveau fournisseur';
  document.getElementById('sup-id').value=s.id;
  document.getElementById('sup-n').value=s.name; document.getElementById('sup-c').value=s.contact||'';
  document.getElementById('sup-t').value=s.phone||''; document.getElementById('sup-e').value=s.email||'';
  document.getElementById('sup-o').value=s.notes||'';
  document.getElementById('m-sup').classList.add('show');
  setTimeout(function(){ try{ document.getElementById('sup-n').focus(); }catch(e){} },60);
}
function saveSupplier(){
  var id=document.getElementById('sup-id').value, n=document.getElementById('sup-n').value.trim();
  if(!n){ toast('Nom requis','err'); return; }
  var dup=suppliers.find(function(s){ return s.id!==id&&normTxt(s.name)===normTxt(n); });
  if(dup){ toast('Ce fournisseur existe déjà','err'); return; }
  var s=supById(id); if(!s){ s={id:uid()}; suppliers.push(s); }
  s.name=n; s.contact=document.getElementById('sup-c').value.trim(); s.phone=document.getElementById('sup-t').value.trim();
  s.email=document.getElementById('sup-e').value.trim(); s.notes=document.getElementById('sup-o').value.trim();
  saveSuppliers(); closeMod('m-sup'); renderSuppliers(); toast('Fournisseur enregistré','ok');
}
function deleteSupplier(id){
  suppliers=suppliers.filter(function(s){ return s.id!==id; });
  ingredients.forEach(function(i){ if(i.supplierId===id) i.supplierId=''; });
  saveSuppliers(); persist(); renderSuppliers(); renderCat(); toast('Fournisseur supprimé','err');
}
var supOpen={};
function toggleSup(id){ supOpen[id]=!supOpen[id]; var c=document.getElementById('sup-'+id); if(c) c.classList.toggle('open',!!supOpen[id]); }
function renderSuppliers(){
  var box=document.getElementById('sup-list'); if(!box) return;
  var none=ingredients.filter(function(i){ return !supById(i.supplierId); });
  function ingRows(list){
    return list.length?list.slice().sort(function(a,b){return a.name.localeCompare(b.name,'fr');}).map(function(i){
      return '<div class="sup-li"><span style="flex:1;min-width:0">'+esc(i.name)+(i.ref?' <span style="color:var(--i4);font-size:11px">· réf. '+esc(i.ref)+'</span>':'')+'</span>'+
        '<span style="font-weight:600;white-space:nowrap">'+(i.price>0?dispPrice(i):'<span style="color:var(--warn)">Sans prix</span>')+'</span> '+trendHtml(priceTrend(i))+
        '<button class="cat-d" onclick="openEditIng(\''+i.id+'\')" title="Modifier">'+ic('edit')+'</button></div>';
    }).join(''):'<div class="hc-empty">Aucun ingrédient associé.</div>';
  }
  box.innerHTML=(suppliers.length?'':'<div class="empty" style="padding:30px 10px"><span class="empty-i">'+ic('truck')+'</span><div class="empty-t">Aucun fournisseur</div><div class="empty-s">Ajoutez vos fournisseurs, puis associez-les à vos ingrédients.<br>Le bon pourra alors être regroupé et imprimé par fournisseur.</div></div>')+
    supSorted().map(function(s){
      var list=ingredients.filter(function(i){ return i.supplierId===s.id; });
      return '<div class="sup-card'+(supOpen[s.id]?' open':'')+'" id="sup-'+s.id+'"><div class="sup-hd" onclick="toggleSup(\''+s.id+'\')">'+
        '<div class="sup-ic">'+ic('truck')+'</div><div style="flex:1;min-width:0"><div class="sup-n">'+esc(s.name)+'</div><div class="sup-m">'+
        '<span>'+ic('box')+' '+list.length+' ingrédient'+(list.length>1?'s':'')+'</span>'+
        (s.contact?'<span>'+ic('user')+' '+esc(s.contact)+'</span>':'')+
        (s.phone?'<span>'+ic('phone')+' <a href="tel:'+esc(s.phone)+'" onclick="event.stopPropagation()" style="color:inherit">'+esc(s.phone)+'</a></span>':'')+
        (s.email?'<span>'+ic('mail')+' <a href="mailto:'+esc(s.email)+'" onclick="event.stopPropagation()" style="color:inherit">'+esc(s.email)+'</a></span>':'')+
        '</div></div><div class="cat-btns" onclick="event.stopPropagation()"><button class="cat-d" onclick="openSupplier(\''+s.id+'\')" title="Modifier">'+ic('edit')+'</button><button class="cat-d cat-del" onclick="askDel(\'sup\',\''+s.id+'\',\''+escJS(s.name)+'\')" title="Supprimer">'+ic('trash')+'</button></div></div>'+
        '<div class="sup-body">'+(s.notes?'<div class="alg-note" style="margin:2px 0 8px">'+esc(s.notes)+'</div>':'')+ingRows(list)+
        '<button class="btn btn-ghost btn-sm" style="margin-top:9px" onclick="openSupAssign(\''+s.id+'\')">'+ic('plus')+' Associer des ingrédients</button></div></div>';
    }).join('')+
    (suppliers.length&&none.length?'<div class="sup-card'+(supOpen.__none?' open':'')+'" id="sup-__none"><div class="sup-hd" onclick="toggleSup(\'__none\')"><div class="sup-ic" style="background:var(--p2)">'+ic('help')+'</div><div style="flex:1"><div class="sup-n">Sans fournisseur</div><div class="sup-m"><span>'+none.length+' ingrédient'+(none.length>1?'s':'')+'</span></div></div></div><div class="sup-body">'+ingRows(none)+'</div></div>':'');
}
// Association rapide : cocher les ingrédients d'un fournisseur
function openSupAssign(supId){
  var s=supById(supId); if(!s) return;
  var ov=document.getElementById('m-supas');
  if(!ov){ ov=document.createElement('div'); ov.className='ov'; ov.id='m-supas'; document.body.appendChild(ov); ov.addEventListener('click',function(e){ if(e.target===ov) ov.classList.remove('show'); }); }
  var list=ingredients.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'fr'); });
  ov.innerHTML='<div class="modal"><div class="m-grip"></div><div class="m-hdr"><h3>'+ic('truck')+' '+esc(s.name)+'</h3><button class="m-x" onclick="document.getElementById(\'m-supas\').classList.remove(\'show\')">'+ic('x')+'</button></div>'+
    '<div class="m-body"><div class="srch">'+ic('search')+'<input class="sinp" placeholder="Filtrer…" oninput="filterSupAssign(this.value)"></div><div id="supas-list">'+
    list.map(function(i){
      var other=supById(i.supplierId)&&i.supplierId!==supId?supName(i.supplierId):'';
      return '<label class="pi2" data-n="'+esc(normTxt(i.name))+'" style="justify-content:flex-start;gap:10px"><input type="checkbox" value="'+i.id+'"'+(i.supplierId===supId?' checked':'')+' style="width:18px;height:18px;accent-color:#231F20">'+
        '<div><div class="pi2-n">'+esc(i.name)+'</div><div class="pi2-m">'+esc(i.cat||'')+(other?' · actuellement : '+esc(other):'')+'</div></div></label>';
    }).join('')+'</div></div><div class="m-foot"><button class="btn btn-ghost" onclick="document.getElementById(\'m-supas\').classList.remove(\'show\')">Annuler</button><button class="btn btn-gold" onclick="saveSupAssign(\''+supId+'\')">'+ic('check')+' Enregistrer</button></div></div>';
  ov.classList.add('show');
}
function filterSupAssign(q){ q=normTxt(q); document.querySelectorAll('#supas-list .pi2').forEach(function(e){ e.style.display=(!q||e.getAttribute('data-n').indexOf(q)>=0)?'':'none'; }); }
function saveSupAssign(supId){
  document.querySelectorAll('#supas-list input[type=checkbox]').forEach(function(cb){
    var ing=ingredients.find(function(i){ return i.id===cb.value; }); if(!ing) return;
    if(cb.checked) ing.supplierId=supId; else if(ing.supplierId===supId) ing.supplierId='';
  });
  persist(); document.getElementById('m-supas').classList.remove('show'); supOpen[supId]=true; renderSuppliers(); toast('Ingrédients associés','ok');
}

// ══ CATALOGUE ═════════════════════════════════════════════════
function applyIngExtras(ing,pfx){
  if(!ing) return;
  var sv=(document.getElementById(pfx+'-sup')||{}).value||'';
  ing.supplierId=(sv==='__new__')?'':sv;
  ing.ref=((document.getElementById(pfx+'-ref')||{}).value||'').trim();
  readAlgPicker(pfx,ing);
}
function addIng(){
  var n0=ingredients.length;
  addIngBase();
  if(ingredients.length>n0){
    var ing=ingredients[ingredients.length-1];
    applyIngExtras(ing,'cat');
    ing._m=1; ing.createdAt=now();
    ing.priceHistory=ing.buyPrice>0?[{d:today(),p:ing.buyPrice,u:ing.unit,k:ing.price}]:[];
    persist(); renderCat(); if(CUR==='home') renderHome();
  }
}
function openEditIng(id){
  openEditIngBase(id);
  var ing=ingredients.find(function(i){return i.id===id;}); if(!ing) return;
  fillSupSelect('edit-cat-sup',ing.supplierId||'');
  document.getElementById('edit-cat-ref').value=ing.ref||'';
  ALG_EDIT['edit-cat']={keys:(ing.allergens||[]).slice(),none:!!(ing.allergensSet&&!(ing.allergens||[]).length),touched:true,auto:!!ing.allergensAuto};
  renderAlgPicker('edit-cat');
  renderPriceHistory(ing);
}
function saveEditIng(){
  var id=document.getElementById('edit-cat-id').value;
  var ing=ingredients.find(function(i){return i.id===id;});
  var before=ing?{p:(ing.buyPrice!=null?ing.buyPrice:ing.price),u:ing.unit,k:ing.price}:null;
  saveEditIngBase();
  if(!ing||document.getElementById('m-editcat').classList.contains('show')) return;
  applyIngExtras(ing,'edit-cat');
  if(before&&(before.p!==ing.buyPrice||before.u!==ing.unit)) pushPriceHistory(ing,before);
  persist(); renderCat();
  if(CUR==='fournisseurs') renderSuppliers();
  if(CUR==='home') renderHome();
}
function openMod(id){
  openModBase(id);
  if(id==='m-addcat'){
    fillSupSelect('cat-sup','');
    var r=document.getElementById('cat-ref'); if(r) r.value='';
    ALG_EDIT.cat={keys:[],none:false,touched:false};
    renderAlgPicker('cat');
  }
}
var CATF={letter:''}, _catSearchT=null;
function catLetter(i){ var c=normTxt(String(i.name||'').trim()).charAt(0).toUpperCase(); return /[A-Z]/.test(c)?c:'#'; }
function catLetterGo(l){ CATF.letter=(CATF.letter===l?'':l); renderCat(); }
function catSearchIn(){ clearTimeout(_catSearchT); _catSearchT=setTimeout(renderCat,100); }
function catClearSearch(){ var i=document.getElementById('cat-srch'); if(i){ i.value=''; i.focus(); } renderCat(); }
function renderCat(){
  var chEl=document.getElementById('cat-chips');
  var catOrder=loadCats('ing');
  var cats0=Array.from(new Set(ingredients.map(function(i){return i.cat;}))).sort(function(a,b){
    var ia=catOrder.indexOf(a), ib=catOrder.indexOf(b); if(ia<0) ia=999; if(ib<0) ib=999; return ia-ib||String(a).localeCompare(String(b),'fr');
  });
  if(chEl) chEl.innerHTML='<div class="chip'+(activeIngCat===''&&!activeIngSub?' on':'')+'" onclick="filterIngCat(\'\')">Tout</div>'+cats0.map(function(c){return '<div class="chip'+(activeIngCat===c&&!activeIngSub?' on':'')+'" onclick="filterIngCat(\''+escJS(c)+'\')">'+catDot(c)+esc(c)+'</div>';}).join('');
  var usedIds=Array.from(new Set(ingredients.filter(function(i){return i.sub;}).map(function(i){return i.sub;})));
  var sl=usedIds.map(function(id){return subById('ing',id);}).filter(Boolean).sort(function(a,b){return a.name.localeCompare(b.name,'fr');});
  var subBox=document.getElementById('cat-subchips');
  if(subBox){ var sc=sl.map(function(s){return '<div class="chip'+(activeIngSub===s.id?' on':'')+'" onclick="filterIngSub(\''+s.id+'\')">'+ic('folder')+' '+esc(s.name)+'</div>';}).join(''); subBox.innerHTML=sc; subBox.style.display=sc?'':'none'; }
  var sf=document.getElementById('cat-supf'), supSel=sf?sf.value:'';
  if(sf){
    sf.innerHTML='<option value="">Tous les fournisseurs</option>'+supSorted().map(function(s){return '<option value="'+s.id+'">'+esc(s.name)+'</option>';}).join('')+'<option value="__none__">Sans fournisseur</option>';
    sf.value=supSel; if(sf.value!==supSel){ sf.value=''; supSel=''; }
    sf.style.display=suppliers.length?'':'none';
  }
  var q=normTxt((document.getElementById('cat-srch').value||'').trim()), words=q.split(/\s+/).filter(Boolean);
  var base=activeIngSub?ingredients.filter(function(i){return i.sub===activeIngSub;}):(activeIngCat?ingredients.filter(function(i){return i.cat===activeIngCat;}):ingredients);
  // lettres A–Z (comme le carnet de recettes)
  var has={}; base.forEach(function(i){ has[catLetter(i)]=1; });
  var az=document.getElementById('cat-az');
  if(az) az.innerHTML='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function(l){
      return '<button class="cn-l'+(CATF.letter===l?' on':'')+(has[l]?'':' off')+'"'+(has[l]||CATF.letter===l?'':' disabled')+' onclick="catLetterGo(\''+l+'\')">'+l+'</button>'; }).join('')+
    (has['#']?'<button class="cn-l'+(CATF.letter==='#'?' on':'')+'" onclick="catLetterGo(\'#\')" title="Autres">#</button>':'')+
    '<button class="cn-l cn-l0'+(CATF.letter?'':' on')+'" onclick="catLetterGo(\'\')" title="Toutes les lettres">'+ic('refresh')+'</button>';
  var list=base.filter(function(i){
    if(CATF.letter&&catLetter(i)!==CATF.letter) return false;
    if(words.length){ var hay=normTxt(i.name+' '+i.cat+' '+supName(i.supplierId)+' '+(i.ref||'')); if(!words.every(function(w){ return hay.indexOf(w)>=0; })) return false; }
    if(supSel==='__none__') return !supById(i.supplierId);
    if(supSel) return i.supplierId===supSel;
    return true;
  });
  var cc=document.getElementById('cat-count');
  if(cc) cc.innerHTML='Mes ingrédients <b>('+(list.length===ingredients.length?list.length:list.length+' / '+ingredients.length)+')</b>';
  var el=document.getElementById('cat-list'),emp=document.getElementById('cat-empty');
  emp.style.display=list.length?'none':'block';
  if(!list.length){ el.innerHTML=''; return; }
  var groups={}; list.forEach(function(i){ (groups[i.cat]||(groups[i.cat]=[])).push(i); });
  var cats=Object.keys(groups).sort(function(a,b){ var ia=catOrder.indexOf(a), ib=catOrder.indexOf(b); if(ia<0) ia=999; if(ib<0) ib=999; return ia-ib||a.localeCompare(b,'fr'); });
  function cardsOf(arr,cat){
    return arr.slice().sort(function(a,b){return a.name.localeCompare(b.name,'fr');}).map(function(i){
      var icn=(i.image&&i.image.length<=4)?i.image:(i.image?'<img src="'+esc(i.image)+'" style="width:100%;height:100%;object-fit:cover">':catIcon(cat));
      var alg=!i.allergensSet?'<span class="alg sm unk">Allergènes ?</span>':((i.allergens||[]).length?algChips(i.allergens,'sm'+(i.allergensAuto?' unk':'')):'');
      var sn=supName(i.supplierId);
      return '<div class="catcard" style="--ch:'+catHue(cat)+'"><div class="cat-ic">'+icn+'</div><div class="cat-b"><div class="cat-n">'+esc(i.name)+'</div>'+
        '<div class="cat-m"><span class="badge bd-g" style="padding:0 7px;font-size:10.5px">'+esc(i.unit)+'</span>'+(sn?'<span>'+ic('truck')+' '+esc(sn)+'</span>':'')+alg+'</div></div>'+
        '<div class="cat-r"><div class="cat-p">'+(i.price>0?dispPrice(i):'<span class="noprice">'+ic('alert')+' Sans prix</span>')+'<small>'+trendHtml(priceTrend(i))+'</small></div>'+
        '<div class="cat-btns"><button class="cat-d cat-edit" onclick="openEditIng(\''+i.id+'\')" title="Modifier">'+ic('edit')+'</button><button class="cat-d cat-dup" onclick="dupIngredient(\''+i.id+'\')" title="Dupliquer">'+ic('copy')+'</button><button class="cat-d cat-del" onclick="askDel(\'ing\',\''+i.id+'\',\''+escJS(i.name)+'\')" title="Supprimer">'+ic('trash')+'</button></div></div></div>';
    }).join('');
  }
  el.innerHTML=cats.map(function(cat){
    var bySub={}, order=[];
    groups[cat].forEach(function(i){ var k=i.sub||''; if(!bySub[k]){ bySub[k]=[]; order.push(k); } bySub[k].push(i); });
    order.sort(function(a,b){ if(!a) return -1; if(!b) return 1; return (subLabel('ing',a)||'').localeCompare(subLabel('ing',b)||'','fr'); });
    return '<div style="margin-bottom:16px;"><div class="cat-grp-hd" style="--ch:'+catHue(cat)+'">'+catIcon(cat)+' '+esc(cat)+'<span class="cat-grp-cnt">'+groups[cat].length+'</span></div>'+
      order.map(function(k){
        var lbl=k?subLabel('ing',k):'';
        if(k&&!lbl) return cardsOf(bySub[k],cat);
        return (k?'<div class="cat-sub-hd">'+ic('folder')+' '+esc(lbl)+'<span class="cat-grp-cnt">'+bySub[k].length+'</span></div>':'')+cardsOf(bySub[k],cat);
      }).join('')+'</div>';
  }).join('');
}

// ══ RECETTES ══════════════════════════════════════════════════
// (la page elle-même est dans carnet.js)
function recRow(r){
    var flat=flatten(r.id), w=flat.reduce(function(s,i){return s+i.qty;},0);
    var cost=flat.reduce(function(s,i){ var ing=ingredients.find(function(x){return x.id===i.ingId;}); return s+(ing?ing.price*i.qty:0); },0);
    var nsub=r.items.filter(function(i){return i.type==='recipe';}).length, a=allergensOfFlat(flat);
    var sl=r.sub?subLabel('rec',r.sub):'';
    return '<div class="rc">'+(recHasPhoto(r)?'<div class="rc-ph" onclick="openEditRec(\''+r.id+'\')"><img src="'+esc(r.image)+'" alt=""></div>':'')+
      '<div class="rc-body"><div class="rc-hd" onclick="openEditRec(\''+r.id+'\')">'+(recHasPhoto(r)?'':'<div class="rc-em">'+recThumb(r)+'</div>')+
      '<div style="min-width:0"><div class="rc-name">'+esc(r.name)+'</div><div class="rc-cat">'+esc(r.cat||'')+(sl?' · '+esc(sl):'')+(nsub?' · '+ic('sub')+' '+nsub+' sous-recette'+(nsub>1?'s':''):'')+'</div></div></div>'+
      '<div class="rc-stats"><div class="rs"><span class="rs-v">'+fKg(w)+'</span><div class="rs-l">Poids</div></div><div class="rs"><span class="rs-v">'+fEur(cost)+'</span><div class="rs-l">Coût TTC</div></div><div class="rs"><span class="rs-v">'+r.items.length+'</span><div class="rs-l">Compos.</div></div></div>'+
      '<div class="rc-alg">'+algChips(a.keys,'sm')+(a.unknown.length?'<span class="alg sm unk">'+a.unknown.length+' allergène'+(a.unknown.length>1?'s':'')+' ?</span>':'')+'</div></div>'+
      '<div class="rc-foot"><button class="btn btn-beige btn-sm" style="flex:1" onclick="quickAddRec(\''+r.id+'\')">'+ic('plus')+' Bon</button><button class="btn btn-ghost btn-sm" onclick="ficheFromCard(\''+r.id+'\')" title="Fiche technique">'+ic('file')+'</button><button class="btn btn-ghost btn-sm" onclick="openEditRec(\''+r.id+'\')" title="Modifier">'+ic('edit')+'</button><button class="btn btn-ghost btn-sm" onclick="dupRecette(\''+r.id+'\')" title="Dupliquer">'+ic('copy')+'</button><button class="btn btn-red btn-sm" onclick="askDel(\'recipe\',\''+r.id+'\',\''+escJS(r.name)+'\')" title="Supprimer">'+ic('trash')+'</button></div></div>';
}
function calcRecTots(){
  var tmp={id:'__tmp__',name:'',cat:'',image:'',notes:'',items:recItems}, orig=recipes;
  recipes=orig.concat([tmp]);
  var w,c; try{ w=recWeight('__tmp__'); c=recCost('__tmp__'); } finally { recipes=orig; }
  document.getElementById('r-w').textContent=fKg(w);
  document.getElementById('r-c').textContent=fEur(c);
  renderRecAllergens();
}

// ══ BONS ══════════════════════════════════════════════════════
function orderCost(o){ return (o.items||[]).reduce(function(s,i){return s+(i.cost||0);},0); }
function bonCard(o,withBtns){
  var cost=orderCost(o), ok=o.status==='validated';
  var head=o.image?'<img src="'+o.image+'" alt="">':'<div class="bc-ico'+(ok?' ok':'')+'">'+ic(ok?'check-circle':'bon')+'</div>';
  return '<div class="bc" onclick="openEditBon(\''+o.id+'\')"><div class="bc-img">'+head+'<div style="flex:1;min-width:0"><div class="bc-name">'+esc(o.name)+'</div>'+
    '<div class="bc-meta" style="margin-bottom:0">'+ic('calendar')+' '+fDate(o.date)+' · '+o.items.length+' article'+(o.items.length>1?'s':'')+((o.recipesUsed||[]).length?' · '+ic('book')+' '+o.recipesUsed.length:'')+'</div></div></div>'+
    '<div class="bc-body"><div class="bc-row"><span class="badge '+(ok?'bd-ok':'bd-d')+'">'+(ok?ic('check')+' Validé':'Brouillon')+'</span>'+
    (withBtns?'<div class="bc-btns" onclick="event.stopPropagation()"><button class="btn btn-ghost btn-xs" onclick="openEditBon(\''+o.id+'\')" title="Modifier">'+ic('edit')+'</button><button class="btn btn-ghost btn-xs" onclick="dupBonById(\''+o.id+'\')" title="Dupliquer">'+ic('copy')+'</button><button class="btn btn-red btn-xs" onclick="askDel(\'order\',\''+o.id+'\',\''+escJS(o.name)+'\')" title="Supprimer">'+ic('trash')+'</button></div>':'')+
    '<span class="bc-cost">'+fEur(cost)+'</span></div></div></div>';
}
function renderBons(){
  var q=normTxt(document.getElementById('bon-srch').value||'');
  var drafts=orders.filter(function(o){return o.status!=='validated';}).length, valid=orders.length-drafts;
  var amt=orders.reduce(function(s,o){return s+orderCost(o);},0);
  document.getElementById('bons-sbar').innerHTML='<div class="sb2"><span class="sb2-v">'+orders.length+'</span><div class="sb2-l">Bons</div></div><div class="sb2"><span class="sb2-v" style="color:var(--i3)">'+drafts+'</span><div class="sb2-l">Brouillons</div></div><div class="sb2"><span class="sb2-v" style="color:var(--gr)">'+valid+'</span><div class="sb2-l">Validés</div></div><div class="sb2"><span class="sb2-v" style="font-size:16px">'+fEur(amt)+'</span><div class="sb2-l">Total TTC</div></div>';
  var list=orders.filter(function(o){ return !q||normTxt(o.name).indexOf(q)>=0; });
  var box=document.getElementById('bons-list'),emp=document.getElementById('bons-empty');
  if(!list.length){ box.innerHTML=''; emp.style.display='block'; return; }
  emp.style.display='none';
  box.innerHTML=list.map(function(o){ return bonCard(o,true); }).join('');
}
function setBonGroup(g){ if(!curBon) return; curBon.groupBy=g; syncBonGroupUI(); livePreview(); }
function syncBonGroupUI(){
  var g=(curBon&&curBon.groupBy)||'cat';
  document.querySelectorAll('#e-group button').forEach(function(b){ b.classList.toggle('on',b.getAttribute('data-g')===g); });
  var l=document.getElementById('e-img-lbl'); if(l) l.textContent=curImg?'Image ajoutée':'Choisir…';
}
// Regroupement du bon : par catégorie (défaut) ou par fournisseur
function groupBonItems(items,mode){
  if(mode!=='sup') return groupItemsByCat(items);
  var groups={}, order=[];
  items.forEach(function(it){
    var s=it.ing?supById(it.ing.supplierId):null, k=s?s.id:'';
    if(!groups[k]){ groups[k]={cat:s?s.name:'Sans fournisseur', info:supInfo(s), items:[]}; order.push(k); }
    groups[k].items.push(it);
  });
  order.sort(function(a,b){ if(!a) return 1; if(!b) return -1; return groups[a].cat.localeCompare(groups[b].cat,'fr'); });
  return order.map(function(k){
    var g=groups[k];
    // dans chaque fournisseur, on garde l'ordre des catégories du catalogue
    var sub=groupItemsByCat(g.items); g.items=[]; sub.forEach(function(x){ g.items=g.items.concat(x.items); });
    return g;
  });
}
function withJsPDF(cb){
  if(window.jspdf){ cb(); return; }
  var s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload=cb; s.onerror=function(){ toast('PDF indisponible : connectez-vous une première fois à Internet','err'); };
  document.head.appendChild(s);
}
function printBonBySupplier(){
  saveBon(); if(!curBon||!curBon.items.length){ toast('Aucun article','err'); return; }
  var d=buildData(); d.groupBy='sup'; d.pagePerGroup=true; d.fileName=(d.name||'bon')+'_par_fournisseur';
  toast('Génération du PDF…','info');
  withJsPDF(function(){ doPDF(d); });
}

// ══ ACCUEIL ═══════════════════════════════════════════════════
function weekStart(d){ var x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
function lastBackupTs(){ return parseInt(LS.getItem('v4_lastbackup')||'0',10)||0; }
function backupDue(){
  if(!(recipes.length||orders.length)) return false;
  var t=lastBackupTs(), sn=parseInt(LS.getItem('v4_bksnooze')||'0',10)||0;
  if(sn>Date.now()) return false;
  return !t||Date.now()-t>7*864e5;
}
function snoozeBackup(){ LS.setItem('v4_bksnooze',String(Date.now()+3*864e5)); updBadges(); renderHome(); }
function agoTxt(ts){ var d=Math.floor((Date.now()-ts)/864e5); return d<=0?'aujourd’hui':(d===1?'hier':'il y a '+d+' jours'); }
function renderHome(){
  var d=new Date(), p=loadProfile();
  document.getElementById('h-hi').innerHTML=p.name?'Bonjour <b>'+esc(p.name)+'</b>':'Bonjour <button class="lnk" onclick="goPage(\'backup\')">'+ic('user')+' Indiquer votre prénom</button>';
  document.getElementById('h-date').textContent=d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+(p.shop?' · '+p.shop:'');
  var sd=document.getElementById('sb-date'); if(sd) sd.textContent=d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})+' · '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  // Rappel de sauvegarde
  var t=lastBackupTs(), bk=document.getElementById('h-backup');
  bk.innerHTML=backupDue()?'<div class="bk-rem">'+ic('shield')+'<div class="tx"><b>'+(t?'Dernière sauvegarde '+agoTxt(t):'Aucune sauvegarde pour l’instant')+'</b>Gardez une copie de vos recettes et de vos bons en dehors de l’application.</div><button class="btn btn-gold btn-sm" onclick="exportBackup()">'+ic('download')+' Sauvegarder</button><button class="btn btn-ghost btn-sm" onclick="snoozeBackup()">Plus tard</button></div>':'';
  // Bon en cours
  var drafts=orders.filter(function(o){return o.status!=='validated';}).sort(function(a,b){return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));});
  var cur=drafts[0];
  document.getElementById('h-cur').innerHTML='<div class="hc-h">'+ic('bon')+' Bon en cours<span class="sp"></span>'+(drafts.length>1?'<span class="badge bd-d">'+drafts.length+' brouillons</span>':'')+'</div>'+
    (cur?'<div class="hc-big" style="font-size:19px;letter-spacing:-.2px">'+esc(cur.name)+'</div><div class="hc-sub">'+fDate(cur.date)+' · '+cur.items.length+' article'+(cur.items.length>1?'s':'')+((cur.recipesUsed||[]).length?' · '+cur.recipesUsed.length+' recette'+(cur.recipesUsed.length>1?'s':''):'')+'</div>'+
      '<div class="hc-big" style="margin-top:10px">'+fEur(orderCost(cur))+'</div>'+
      '<div class="hc-foot"><button class="btn btn-gold btn-sm" onclick="openEditBon(\''+cur.id+'\')">'+ic('arrow-right')+' Reprendre</button><button class="btn btn-ghost btn-sm" onclick="openNewBon()">'+ic('plus')+' Nouveau</button></div>'
     :'<div class="hc-empty">Aucun bon en cours. Composez votre prochain bon d’économat à partir de vos recettes.</div><div class="hc-foot"><button class="btn btn-gold btn-sm" onclick="openNewBon()">'+ic('plus')+' Nouveau bon</button></div>');
  // Coût de la semaine (lundi → dimanche) et 8 dernières semaines
  var ws=weekStart(d), weeks=[];
  for(var k=7;k>=0;k--){ var a=new Date(ws); a.setDate(a.getDate()-7*k); var b=new Date(a); b.setDate(b.getDate()+7); weeks.push({a:a,b:b,sum:0,n:0}); }
  orders.forEach(function(o){ if(!o.date) return; var od=new Date(o.date+'T00:00:00'); weeks.forEach(function(w){ if(od>=w.a&&od<w.b){ w.sum+=orderCost(o); w.n++; } }); });
  var cw=weeks[7], pw=weeks[6], mx=Math.max.apply(null,weeks.map(function(w){return w.sum;}))||1;
  var dl=pw.sum>0?(cw.sum-pw.sum)/pw.sum:null;
  document.getElementById('h-week').innerHTML='<div class="hc-h">'+ic('euro')+' Coût de la semaine</div>'+
    '<div><span class="hc-big">'+fEur(cw.sum)+'</span>'+(dl!=null&&isFinite(dl)?'<span class="delta '+(Math.abs(dl)<0.005?'eq':(dl>0?'up':'dn'))+'">'+ic(dl>0?'up':'down')+fPct(dl)+'</span>':'')+'</div>'+
    '<div class="hc-sub">'+cw.n+' bon'+(cw.n>1?'s':'')+' du '+cw.a.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' au '+new Date(cw.b-864e5).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+(pw.sum>0?' · semaine dernière : '+fEur(pw.sum):'')+'</div>'+
    '<div class="wk-bars">'+weeks.map(function(w,i){ return '<div class="wk-bar'+(i===7?' cur':'')+'" title="'+fEur(w.sum)+'"><i style="height:'+Math.max(2,Math.round(w.sum/mx*40))+'px"></i><span>'+(i===7?'Sem.':w.a.getDate()+'/'+(w.a.getMonth()+1))+'</span></div>'; }).join('')+'</div>';
  // Ingrédients à compléter
  var use={}; recipes.forEach(function(r){ r.items.forEach(function(it){ if(it.type==='ingredient') use[it.refId]=(use[it.refId]||0)+1; }); });
  var noPrice=ingredients.filter(function(i){ return !(i.price>0); }).sort(function(a,b){ return (use[b.id]||0)-(use[a.id]||0)||a.name.localeCompare(b.name,'fr'); });
  var noAlg=ingredients.filter(function(i){ return !i.allergensSet; }).length;
  document.getElementById('h-todo').innerHTML='<div class="hc-h">'+ic('alert')+' Ingrédients sans prix<span class="sp"></span>'+(noPrice.length?'<span class="badge" style="background:#FFF1DC;color:var(--warn)">'+noPrice.length+'</span>':'')+'</div>'+
    (noPrice.length?noPrice.slice(0,5).map(function(i){ return '<div class="hc-row"><span class="nm">'+esc(i.name)+'</span><span class="mt">'+(use[i.id]?use[i.id]+' recette'+(use[i.id]>1?'s':''):esc(i.cat||''))+'</span><button class="btn btn-ghost btn-xs" onclick="openEditIng(\''+i.id+'\')">'+ic('edit')+' Prix</button></div>'; }).join('')+(noPrice.length>5?'<div class="hc-sub">… et '+(noPrice.length-5)+' autre'+(noPrice.length-5>1?'s':'')+'</div>':'')
      :'<div class="hc-empty">'+ic('check-circle')+' Tous vos ingrédients ont un prix : les coûts des recettes et des bons sont complets.</div>')+
    (noAlg?'<div class="hc-foot"><button class="lnk" onclick="goPage(\'catalogue\')">'+ic('wheat')+' '+noAlg+' ingrédient'+(noAlg>1?'s':'')+' sans allergènes renseignés</button></div>':'');
  // Recettes récentes
  var rr=recipes.slice().sort(function(a,b){ return String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')); }).slice(0,4);
  document.getElementById('h-recrec').innerHTML='<div class="hc-h">'+ic('book')+' Recettes récentes<span class="sp"></span><span class="sh-m" onclick="goPage(\'recettes\')" style="text-transform:none;letter-spacing:0">Tout voir '+ic('arrow-right')+'</span></div>'+
    (rr.length?rr.map(function(r){ return '<div class="hc-row"><span class="rpe" style="width:30px;height:30px;font-size:15px;border-radius:8px">'+recThumb(r)+'</span><span class="nm" style="cursor:pointer" onclick="openEditRec(\''+r.id+'\')">'+esc(r.name)+'</span><span class="mt">'+fEur(recCost(r.id))+'</span><button class="btn btn-ghost btn-xs" onclick="quickAddRec(\''+r.id+'\')" title="Ajouter au bon">'+ic('plus')+' Bon</button></div>'; }).join('')
      :'<div class="hc-empty">Aucune recette. Créez-en une ou importez vos fiches (PDF, photo, Excel).</div><div class="hc-foot"><button class="btn btn-ghost btn-sm" onclick="goPage(\'rec-import\')">'+ic('upload')+' Importer</button></div>');
  var rec=orders.slice(0,4);
  document.getElementById('h-recents').innerHTML=rec.length?rec.map(function(o){ return bonCard(o,false); }).join(''):'<div class="hc-empty" style="padding:10px 2px">Aucun bon pour l’instant.</div>';
}

// ══ BADGES · NOTIFICATIONS ════════════════════════════════════
function updBadges(){
  function set(id,n,show){ var e=document.getElementById(id); if(!e) return; e.textContent=n; e.classList.toggle('on',!!show); }
  set('nd-bons',orders.length,orders.length>0); set('bnd-bons',orders.length,false);
  set('nd-rec',recipes.length,recipes.length>0); set('bnd-rec',recipes.length,false);
  var due=backupDue(); set('nd-bk','!',due); set('bnd-bk','!',due);
}
function toast(msg,type){
  var t=document.getElementById('toast'); type=type||'ok';
  var m=String(msg==null?'':msg).replace(/^[\s✓✕⊛⧉💾📊📄⏳⚠️ℹ️🧠📑🔍↻✎＋➕]+/u,'');
  t.innerHTML=ic(type==='err'?'alert':(type==='info'?'info':'check-circle'))+'<span>'+esc(m)+'</span>';
  t.className='toast show '+type; clearTimeout(t._t);
  t._t=setTimeout(function(){ t.classList.remove('show'); },3200);
}

// ══ RÉGLAGES · STOCKAGE · SAUVEGARDE ══════════════════════════
function renderBackup(){
  renderBackupBase();
  var box=document.getElementById('bk-body'); if(!box) return;
  var p=loadProfile(), t=lastBackupTs();
  box.insertAdjacentHTML('afterbegin', themeCardHTML()+clCardHTML()+
    '<div class="cw"><div class="cw-t">'+ic('user')+' Profil</div><div class="frow"><div class="field"><div class="fl">Prénom</div><input class="fi" id="pf-name" value="'+esc(p.name||'')+'" placeholder="Votre prénom"></div>'+
    '<div class="field"><div class="fl">Établissement</div><input class="fi" id="pf-shop" value="'+esc(p.shop||'')+'" placeholder="Nom de la boulangerie"></div></div>'+
    '<button class="btn btn-gold btn-sm" onclick="saveProfileUI()">'+ic('check')+' Enregistrer</button></div>'+
    '<div class="cw"><div class="cw-t">'+ic('shield')+' Stockage</div>'+
    '<div class="bk-rem '+(t&&!backupDue()?'ok':'')+'" style="margin-bottom:10px">'+ic(t&&!backupDue()?'check-circle':'clock')+'<div class="tx"><b>'+(t?'Dernière sauvegarde '+agoTxt(t)+' ('+new Date(t).toLocaleDateString('fr-FR')+')':'Aucune sauvegarde enregistrée')+'</b>Un rappel apparaît sur l’accueil si la dernière date de plus de 7 jours.</div></div>'+
    '<div id="bk-store" style="font-size:12.5px;color:var(--i3);line-height:1.7"></div></div>');
  fillStorageInfo();
}
function themeCardHTML(){
  var t=loadTheme(), mode=t.mode||'auto', acc=THEME_PAL[t.accent]?t.accent:'ble';
  var seg=[['auto','Automatique'],['light','Clair'],['dark','Sombre']].map(function(m){ return '<button class="'+(mode===m[0]?'on':'')+'" onclick="setThemeMode(\''+m[0]+'\')">'+m[1]+'</button>'; }).join('');
  var sw=Object.keys(THEME_PAL).map(function(k){ return '<div class="th-s'+(k===acc?' on':'')+'" onclick="setThemeAccent(\''+k+'\')"><span class="th-dot" style="background-color:'+themeSwatch(k,false)+'"></span>'+esc(THEME_PAL[k].n)+'</div>'; }).join('');
  return '<div class="cw" id="th-card"><div class="cw-t">'+ic('sparkle')+' Apparence</div>'+
    '<div class="th-row"><span class="th-lbl">Mode</span><div class="seg">'+seg+'</div></div>'+
    '<div class="th-row"><span class="th-lbl">Affichage</span><div class="seg">'+[['auto','Automatique'],['desk','Ordinateur'],['mob','Mobile']].map(function(m){ var cur=(typeof getLayout==='function'?getLayout():'auto'); return '<button class="'+(cur===m[0]?'on':'')+'" onclick="setLayout(\''+m[0]+'\')">'+m[1]+'</button>'; }).join('')+'</div></div>'+
    '<div class="th-lbl" style="margin-bottom:8px">Couleur de l’application</div><div class="th-sw">'+sw+'</div>'+
    '<div style="font-size:11.5px;color:var(--i4);margin-top:10px">« Automatique » suit le réglage clair / sombre du téléphone ou de l’ordinateur, et choisit l’affichage selon la taille de l’écran (le bouton '+ic('mobile')+' en haut passe de l’un à l’autre). Les bons et fiches PDF gardent toujours leur présentation beige.</div></div>';
}
function saveTheme(t){ LS.setItem('v4_theme',JSON.stringify(t)); applyTheme(t); var c=document.getElementById('th-card'); if(c) c.outerHTML=themeCardHTML(); }
function setThemeMode(m){ var t=loadTheme(); t.mode=m; saveTheme(t); }
function setThemeAccent(a){ var t=loadTheme(); t.accent=a; saveTheme(t); }
function fillStorageInfo(){
  var e=document.getElementById('bk-store'); if(!e) return;
  var lines=['Moteur : <b>'+(LS.backend==='idb'?'IndexedDB':'stockage local (mode de secours)')+'</b> — les photos et les gros catalogues ne sont plus limités à 5 Mo.'];
  e.innerHTML=lines.join('<br>');
  try{
    if(navigator.storage&&navigator.storage.estimate){
      navigator.storage.estimate().then(function(est){
        var used=(est.usage||0)/1048576, q=(est.quota||0)/1048576;
        lines.push('Espace utilisé : <b>'+fNum(used,1)+' Mo</b>'+(q?' sur '+fNum(q>10240?q/1024:q,0)+(q>10240?' Go':' Mo')+' disponibles':''));
        if(navigator.storage.persisted) return navigator.storage.persisted().then(function(ok){
          lines.push(ok?'Stockage <b>protégé</b> : le navigateur ne l’effacera pas pour libérer de la place.':'Stockage non protégé : le navigateur peut l’effacer s’il manque de place — <b>pensez aux sauvegardes</b>.');
        });
      }).then(function(){ e.innerHTML=lines.join('<br>'); }).catch(function(){});
    }
  }catch(err){}
}
function restoreExtras(d,mode){
  if(d.attachments) Object.keys(d.attachments).forEach(function(id){ if(!attLocal(id)) attPut(id,d.attachments[id]); });
  // Pages sources des livres : chaque document est joint à la recette indiquée
  // (identifiant de recette → fiches des documents). Rien n'est retiré.
  if(d.attLinks){
    var nl=0, nr=0;
    Object.keys(d.attLinks).forEach(function(rid){
      var r=recipes.find(function(x){ return x.id===rid; })||recipes.find(function(x){ return x.id===(d._recMap||{})[rid]; }); if(!r) return;
      var add=(d.attLinks[rid]||[]).filter(function(m){ return m&&m.id&&attLocal(m.id)&&!(r.attachments||[]).some(function(a){ return a.id===m.id; }); });
      if(!add.length) return;
      r.attachments=(r.attachments||[]).concat(add.map(function(m){ return {id:m.id,name:m.name,mime:m.mime,size:m.size,added:m.added||Date.now()}; }));
      r.updatedAt=new Date().toISOString(); nl+=add.length; nr++;
    });
    if(nr) setTimeout(function(){ toast(nl+' page'+(nl>1?'s':'')+' source'+(nl>1?'s':'')+' jointe'+(nl>1?'s':'')+' à '+nr+' recette'+(nr>1?'s':''),'ok'); },1800);
  }
  // Les documents restaurés et utilisés par une recette partent aussi en ligne
  if(d.attachments&&typeof clQueueAttUp==='function'){
    var ref={}; recipes.forEach(function(r){ (r.attachments||[]).forEach(function(a){ ref[a.id]=1; }); });
    Object.keys(d.attachments).forEach(function(id){ if(ref[id]) clQueueAttUp(id); });
  }
  if(d.suppliers&&d.suppliers.length){
    if(mode==='merge'){ d.suppliers.forEach(function(s){ if(!suppliers.some(function(x){ return x.id===s.id||normTxt(x.name)===normTxt(s.name); })) suppliers.push(s); }); }
    else suppliers=d.suppliers.slice();
    saveSuppliers();
  }
  if(d.profile&&(mode!=='merge'||!loadProfile().name)) LS.setItem('v4_profile',JSON.stringify(d.profile));
}

// ══ FICHE TECHNIQUE ═══════════════════════════════════════════
var FICHE_CUR=null;
function ficheQty(qty,unit,kg){
  var u=String(unit||'kg').trim();
  if(isCountable(u)){ var n=Number(qty)||0; return fNum(n,2)+' '+u+(n>1&&!/s$/.test(u)?'s':''); }
  if(/^(l|ml|cl|dl)$/i.test(u)){ var L=kg; return (L>0&&L<1)?fNum(L*1000,1)+' ml':fNum(L,3)+' L'; }
  return fQtyNice(kg);
}
function ficheData(rec){
  var p=loadProfile(), sections=[], process=[], seenProc={};
  function addProc(r,title){ if(r.notes&&String(r.notes).trim()&&!seenProc[r.id]){ seenProc[r.id]=1; process.push({title:title,text:String(r.notes).trim()}); } }
  function section(r,mult,title,depth,main){
    var rows=[], subs=[], w=0, c=0;
    r.items.forEach(function(it){
      if(it.type==='ingredient'){
        var ing=ingredients.find(function(x){return x.id===it.refId;});
        var kg=toKg(it.qty,it.unit,ing)*mult, cost=ing?kg*ing.price:0;
        rows.push({name:ing?ing.name:'?', qty:ficheQty((Number(it.qty)||0)*mult,it.unit,kg), price:ing&&ing.price>0?(ingNoW(ing)?fEur(ing.buyPrice!=null?ing.buyPrice:ing.price)+' / '+ing.unit:fEur(ing.price)+' / kg'):'—', cost:cost, noPrice:!(ing&&ing.price>0)});
        w+=kg; c+=cost;
      } else {
        var sr=recipes.find(function(x){return x.id===it.refId;}); if(!sr) return;
        var m=(Number(it.qty)||0)*mult, sw=recWeight(sr.id)*m, scs=recCost(sr.id)*m;
        rows.push({name:sr.name, sub:true, qty:fQtyNice(sw), price:'—', cost:scs});
        w+=sw; c+=scs; subs.push({r:sr,m:m});
      }
    });
    sections.push({title:title, main:!!main, weight:w, cost:c, rows:rows});
    subs.forEach(function(s){ if(depth<5) section(s.r,s.m,s.r.name,depth+1,false); });
  }
  section(rec,1,rec.name,0,true);
  addProc(rec,rec.name);
  (function walk(r,depth){ r.items.forEach(function(it){ if(it.type!=='ingredient'&&depth<5){ var sr=recipes.find(function(x){return x.id===it.refId;}); if(sr){ addProc(sr,sr.name); walk(sr,depth+1); } } }); })(rec,0);
  var a=allergensOfFlat(flatten(rec.id));
  return {id:rec.id, name:rec.name||'Recette', cat:rec.cat||'', sub:rec.sub?subLabel('rec',rec.sub):'', image:recHasPhoto(rec)?rec.image:'', shop:p.shop||'',
    date:new Date().toLocaleDateString('fr-FR'), weight:sections[0].weight, cost:sections[0].cost, sections:sections, process:process, allergens:a, pcs:rec.pcs||0, time:rec.time||0};
}
function ficheSubtitle(f){
  return [f.cat+(f.sub?' · '+f.sub:''),'Poids total '+fQtyNice(f.weight),(f.pcs?f.pcs+' pièce'+(f.pcs>1?'s':'')+' de '+fQtyNice(f.weight/f.pcs):''),(f.time?'Durée '+fDur(f.time):''),'Coût matière '+fEur(f.cost)+' TTC',(f.shop?f.shop+' — ':'')+'édité le '+f.date].filter(function(x){return x&&x.trim();}).join(' · ');
}
function ficheHTML(f){
  var rows=f.sections.map(function(s,si){
    var head=s.main?'':'<tr class="ct"><td colspan="3">Sous-recette : '+esc(s.title)+'</td><td class="r">'+esc(fQtyNice(s.weight))+'</td></tr>';
    var body=s.rows.map(function(r,i){
      return '<tr'+(i%2?' class="al"':'')+'><td'+(r.sub?' style="font-weight:600"':'')+'>'+esc(r.name)+(r.sub?' <span style="color:#9A9A9A;font-weight:400;font-size:8.5px">(sous-recette)</span>':'')+'</td><td class="r q">'+esc(r.qty)+'</td><td class="p">'+esc(r.price)+'</td><td class="k">'+(r.noPrice?'—':fEur(r.cost))+'</td></tr>';
    }).join('');
    var tot=s.main?'<tr class="tt"><td>TOTAL</td><td class="r">'+esc(fQtyNice(s.weight))+'</td><td></td><td>'+fEur(s.cost)+'</td></tr>'
                 :'<tr><td colspan="3" style="text-align:right;color:#8C8C8C;font-style:italic;font-size:9px">Coût de la sous-recette</td><td class="k">'+fEur(s.cost)+'</td></tr>';
    return (si===0?'<tr class="ct"><td colspan="3">'+esc(s.title)+'</td><td class="r">'+esc(fQtyNice(s.weight))+'</td></tr>':head)+body+tot;
  }).join('');
  var a=f.allergens;
  return '<div class="bx">'+
    '<div class="bx-band"><img class="c1" src="'+BON_CREST+'" alt=""><img class="c2" src="'+BON_CMARK+'" alt=""><div class="bx-vt" style="font-size:19px">FICHE TECHNIQUE</div></div>'+
    '<div class="bx-h"><div class="bx-t">'+esc(f.name)+'</div>'+(f.image?'<img class="bx-ph" src="'+f.image+'" alt="">':'')+'</div>'+
    '<div class="bx-rule"></div><div class="bx-sub">'+esc(ficheSubtitle(f))+'</div>'+
    '<table class="bx-tb"><colgroup><col style="width:46%"><col style="width:18%"><col style="width:19%"><col style="width:17%"></colgroup><thead><tr><th>Ingrédients</th><th class="r">Quantité</th><th>Prix unit. TTC</th><th>Coût TTC</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div class="bx-ft">Prix indicatifs TTC, calculés à partir des prix du catalogue.</div>'+
    '<div class="bx-h3">Allergènes</div><div class="bx-p" style="color:#231F20">'+(a.keys.length?'<b>'+esc(a.keys.map(algLabel).join(', '))+'</b>':(a.unknown.length?'—':'Aucun des 14 allergènes réglementaires.'))+'</div>'+
    (a.unknown.length?'<div class="bx-p" style="font-style:italic">Non renseignés pour : '+esc(a.unknown.join(', '))+'.</div>':'')+
    (a.auto.length?'<div class="bx-p" style="font-style:italic">Déduits automatiquement, à vérifier : '+esc(a.auto.join(', '))+'.</div>':'')+
    (f.process.length?'<div class="bx-h3">Procédé</div>'+f.process.map(function(pr){ return (f.process.length>1?'<div style="font-weight:700;font-size:10px;margin:7px 0 2px">'+esc(pr.title)+'</div>':'')+'<div class="bx-p" style="color:#3B3536;white-space:pre-line">'+esc(pr.text)+'</div>'; }).join(''):'')+
  '</div>';
}
function ficheShow(f){ FICHE_CUR=f; document.getElementById('fiche-body').innerHTML=ficheHTML(f); document.getElementById('m-fiche').classList.add('show'); }
function ficheDownload(){ if(!FICHE_CUR) return; var f=FICHE_CUR; toast('Génération du PDF…','info'); withJsPDF(function(){ ficheDoPDF(f); }); }
function ficheFromCard(id){ var r=recipes.find(function(x){return x.id===id;}); if(r) ficheShow(ficheData(r)); }
function ficheFromEditor(mode){
  if(!recItems.length){ toast('Ajoutez au moins un ingrédient','err'); return; }
  var tmp={id:editRecId||'__fiche__', name:document.getElementById('r-name').value.trim()||'Recette', cat:document.getElementById('r-cat').value, sub:(document.getElementById('r-sub')||{}).value||'',
    image:curRecImg||document.getElementById('r-img').value.trim(), notes:document.getElementById('r-notes').value.trim(), items:recItems, pcs:(typeof REC_ED!=='undefined'&&REC_ED.pcs)||0, time:(typeof REC_ED!=='undefined'&&REC_ED.time)||0};
  var orig=recipes; recipes=orig.filter(function(x){return x.id!==tmp.id;}).concat([tmp]);
  var f; try{ f=ficheData(tmp); } finally { recipes=orig; }
  if(mode==='pdf'){ FICHE_CUR=f; ficheDownload(); } else ficheShow(f);
}
function ficheDoPDF(f){
  try{
    var doc=new window.jspdf.jsPDF({orientation:'portrait',unit:'pt',format:'a4'});
    var F=bonPdfFonts(doc);
    var PW=595.28, PH=841.89, L=40, R=513, BAND=539, BOTTOM=792;
    var X={name:44, qtyR:318, price:330, costR:507, sep1:325, sep2:418};
    var INK=[35,31,32], GREY=[140,140,140], LGREY=[150,150,150], BEIGE=bonPal().beige, ALT=bonPal().alt, SEP=bonPal().sep;
    var page=1, y=0;
    function rgb(fn,c){ doc[fn](c[0],c[1],c[2]); }
    function chrome(){
      rgb('setFillColor',BEIGE); doc.rect(BAND,0,PW-BAND,PH,'F');
      try{ doc.addImage(BON_CREST,'PNG',BAND+(PW-BAND-44)/2,18,44,44*219/260,'bonCrest','FAST'); }catch(e){}
      try{ doc.addImage(BON_CMARK,'PNG',BAND+(PW-BAND-36)/2,63,36,36,'bonCmark','FAST'); }catch(e){}
      doc.setFont(F,'bold'); doc.setFontSize(32); rgb('setTextColor',INK);
      var tw=doc.getTextWidth('FICHE TECHNIQUE');
      doc.text('FICHE TECHNIQUE', 579, PH/2+tw/2, {angle:90});
      doc.setFont(F,'normal'); doc.setFontSize(10); rgb('setTextColor',GREY);
      doc.text(String(page), 514, 815, {align:'right'});
    }
    function header(){
      rgb('setFillColor',INK); doc.rect(L,y,R-L,19,'F');
      doc.setFont(F,'bold'); doc.setFontSize(8.5); doc.setTextColor(255,255,255);
      doc.text('Ingrédients',X.name,y+12.5); doc.text('Quantité',X.qtyR,y+12.5,{align:'right'});
      doc.text('Prix unit. TTC',X.price,y+12.5); doc.text('Coût TTC',X.costR,y+12.5,{align:'right'});
      y+=19;
    }
    function newPage(){ doc.addPage(); page++; chrome(); y=46; }
    function ensure(h,tbl){ if(y+h<=BOTTOM) return false; newPage(); if(tbl) header(); return true; }
    function band(label,right){
      rgb('setFillColor',BEIGE); doc.rect(L,y,R-L,20,'F');
      doc.setFont(F,'bold'); doc.setFontSize(8.5); rgb('setTextColor',INK);
      doc.text(doc.splitTextToSize(String(label).toUpperCase(),330)[0],X.name,y+13.3);
      if(right) doc.text(right,X.costR,y+13.3,{align:'right'});
      y+=20;
    }
    chrome();
    doc.setFont(F,'bold'); doc.setFontSize(24); rgb('setTextColor',INK);
    var tl=doc.splitTextToSize(f.name, f.image?R-L-56:R-L);
    doc.text(tl.slice(0,2), L, 66, {lineHeightFactor:1.1});
    var ty=66+(Math.min(tl.length,2)-1)*26;
    if(f.image){ try{ doc.addImage(f.image,/^data:image\/png/.test(f.image)?'PNG':'JPEG',R-46,30,46,46,undefined,'FAST'); }catch(e){} }
    rgb('setDrawColor',INK); doc.setLineWidth(1.5); doc.line(L,ty+16,R,ty+16);
    doc.setFont(F,'italic'); doc.setFontSize(8.5); rgb('setTextColor',GREY);
    var sub=doc.splitTextToSize(ficheSubtitle(f), R-L);
    doc.text(sub, L, ty+38, {lineHeightFactor:1.45});
    y=ty+38+12.3*(sub.length-1)+8;
    header();
    f.sections.forEach(function(s,si){
      if(ensure(20+17,true)){}
      band(si===0?s.title:'Sous-recette : '+s.title, fQtyNice(s.weight));
      s.rows.forEach(function(r,i){
        doc.setFont(F,'bold'); doc.setFontSize(9.5);
        var qw=doc.getTextWidth(r.qty);
        doc.setFont(F,r.sub?'medium':'normal');
        var nl=doc.splitTextToSize(r.name+(r.sub?' (sous-recette)':''), Math.max(80,X.qtyR-qw-10-X.name));
        var rh=Math.max(16.7,6.5+nl.length*11);
        if(ensure(rh,true)) band((si===0?s.title:'Sous-recette : '+s.title)+' (suite)');
        if(i%2===1){ rgb('setFillColor',ALT); doc.rect(L,y,R-L,rh,'F'); }
        rgb('setDrawColor',SEP); doc.setLineWidth(0.6);
        doc.line(X.sep1,y+2,X.sep1,y+rh-2); doc.line(X.sep2,y+2,X.sep2,y+rh-2);
        var by=y+12;
        doc.setFontSize(9.5); rgb('setTextColor',INK);
        doc.text(nl, X.name, by, {lineHeightFactor:1.15});
        doc.setFont(F,'bold'); doc.text(r.qty, X.qtyR, by, {align:'right'});
        doc.setFont(F,'normal'); doc.setFontSize(8.5); doc.text(r.price, X.price, by);
        doc.setFont(F,'bold'); doc.text(r.noPrice?'—':fEur(r.cost), X.costR, by, {align:'right'});
        y+=rh;
      });
      if(s.main){
        ensure(21,true);
        rgb('setFillColor',INK); doc.rect(L,y,R-L,21,'F');
        doc.setFont(F,'bold'); doc.setFontSize(9.5); doc.setTextColor(255,255,255);
        doc.text('TOTAL', X.name, y+14); doc.text(fQtyNice(s.weight), X.qtyR, y+14, {align:'right'});
        doc.text(fEur(s.cost), X.costR, y+14, {align:'right'});
        y+=21;
      } else {
        ensure(16,true);
        doc.setFont(F,'italic'); doc.setFontSize(8); rgb('setTextColor',GREY);
        doc.text('Coût de la sous-recette', X.sep2-6, y+11, {align:'right'});
        doc.setFont(F,'bold'); doc.setFontSize(8.5); rgb('setTextColor',INK);
        doc.text(fEur(s.cost), X.costR, y+11, {align:'right'});
        y+=16;
      }
    });
    ensure(20);
    y+=11; doc.setFont(F,'italic'); doc.setFontSize(7.5); rgb('setTextColor',GREY);
    doc.text('Prix indicatifs TTC, calculés à partir des prix du catalogue.', L, y);
    function heading(t){ ensure(40); y+=24; doc.setFont(F,'bold'); doc.setFontSize(11); rgb('setTextColor',INK); doc.text(t, L, y); y+=6; }
    function para(t,style,col,size){
      doc.setFont(F,style||'normal'); doc.setFontSize(size||9); rgb('setTextColor',col||INK);
      var ls=doc.splitTextToSize(t, R-L);
      ls.forEach(function(l){ ensure(13); y+=13; doc.text(l, L, y); });
    }
    var a=f.allergens;
    heading('Allergènes');
    para(a.keys.length?a.keys.map(algLabel).join(', '):(a.unknown.length?'—':'Aucun des 14 allergènes réglementaires.'),a.keys.length?'bold':'normal');
    if(a.unknown.length) para('Non renseignés pour : '+a.unknown.join(', ')+'.','italic',GREY,8.5);
    if(a.auto.length) para('Déduits automatiquement, à vérifier : '+a.auto.join(', ')+'.','italic',GREY,8.5);
    if(f.process.length){
      heading('Procédé');
      f.process.forEach(function(pr){
        if(f.process.length>1){ ensure(22); y+=6; para(pr.title,'bold',INK,9.5); }
        String(pr.text).split(/\n+/).forEach(function(par){ if(par.trim()) para(par.trim(),'normal',[59,53,54],9); });
      });
    }
    doc.save(('fiche_'+(f.name||'recette')).replace(/[^a-z0-9]/gi,'_')+'.pdf');
    toast('Fiche technique téléchargée','ok');
  }catch(e){ console.error(e); toast('Erreur PDF','err'); }
}


// ══ AJOUT AU BON : quantité en haut, ingrédients de recette à cocher ══
function buildUPills(p,ing){
  var box=document.getElementById(p+'-upills'), sel=document.getElementById(p+'-u'); if(!box||!sel) return;
  var u=String(ing.unit||'kg'), list=[u];
  (/^(l|ml|cl)$/i.test(u)?['L','ml','kg']:['kg','g']).forEach(function(x){ if(list.indexOf(x)<0) list.push(x); });
  if(isCountable(u)&&!(ing.unitWeight>0)) list=[u];
  box.innerHTML=list.map(function(x){ return '<button type="button" class="upill" data-u="'+esc(x)+'" onclick="setUPill(\''+p+'\',this.dataset.u)">'+esc(x)+'</button>'; }).join('')+
    '<button type="button" class="upill more" onclick="moreUPills(\''+p+'\')" title="Autres unités">…</button>';
  sel.style.display='none'; syncUPills(p);
}
function setUPill(p,u){ var sel=document.getElementById(p+'-u'); sel.value=u; syncUPills(p); var q=document.getElementById(p+'-q'); if(q&&isWide()) q.focus(); }
function syncUPills(p){
  var sel=document.getElementById(p+'-u'), box=document.getElementById(p+'-upills'); if(!sel||!box) return;
  var found=false;
  box.querySelectorAll('.upill[data-u]').forEach(function(b){ var on=b.dataset.u===sel.value; b.classList.toggle('on',on); if(on) found=true; });
  if(!found) sel.style.display='';
}
function moreUPills(p){ var sel=document.getElementById(p+'-u'); sel.style.display=sel.style.display==='none'?'':'none'; }
function selScrollTop(mid){ var b=document.querySelector('#'+mid+' .m-body'); if(b) b.scrollTop=0; }
function isWide(){ return window.innerWidth>820&&!document.documentElement.classList.contains('lay-mob'); }
function pickIng(id){
  pickIng_old(id); if(!selIng) return;
  buildUPills('ing',selIng);
  document.getElementById('ing-sel-n').textContent=selIng.name;
  selScrollTop('m-ing');
  var q=document.getElementById('ing-q'); try{ q.focus({preventScroll:true}); }catch(e){ q.focus(); }
}
function unpickIng(){ selIng=null; document.getElementById('ing-qty').style.display='none'; filterIng(); var s=document.getElementById('ing-s'); if(s&&isWide()) s.focus(); }
function pickRIng(id){
  pickRIng_old(id); if(!selRIng) return;
  buildUPills('ring',selRIng);
  document.getElementById('ring-sel-n').textContent=selRIng.name;
  selScrollTop('m-ring');
  var q=document.getElementById('ring-q'); try{ q.focus({preventScroll:true}); }catch(e){ q.focus(); }
}
function unpickRIng(){ selRIng=null; document.getElementById('ring-qty').style.display='none'; filterRIng(); }

var recSkip={};
function initRecMod(){
  initRecMod_old(); recSkip={};
  var p=document.getElementById('rec-pick'), c=document.getElementById('rec-conf');
  if(p) p.style.display=''; if(c) c.style.display='none';
}
function pickRec(id){
  var r=recipes.find(function(x){return x.id===id;}); if(!r) return;
  if(!selRec||selRec.id!==id) recSkip={};
  selRec=r; curMult=1;
  document.getElementById('mult-custom').value=1;
  document.querySelectorAll('#m-rec .mb').forEach(function(b,i){ b.classList.toggle('on',i===0); });
  document.getElementById('rec-kg-custom').value=fQ(recWeight(r.id));
  document.getElementById('rec-sel-n').textContent=r.name;
  document.getElementById('rec-sel-e').innerHTML=recThumb(r);
  document.getElementById('rec-pick').style.display='none';
  document.getElementById('rec-conf').style.display='';
  buildRecList(); refreshRecPrev(); selScrollTop('m-rec');
  if(isWide()){ var k=document.getElementById('rec-kg-custom'); try{ k.focus({preventScroll:true}); k.select(); }catch(e){} }
}
function unpickRec(){
  document.getElementById('rec-pick').style.display='';
  document.getElementById('rec-conf').style.display='none';
  buildRecList(); selScrollTop('m-rec');
}
function refreshRecPrev(){
  if(!selRec||!curBon) return;
  var flat=flatten(selRec.id,curMult), pv=prevRec(selRec.id,curBon,curMult);
  document.getElementById('rec-prev-w').style.display='block';
  var nOn=0, kgOn=0;
  document.getElementById('rec-prev-b').innerHTML=flat.map(function(fi,i){
    var it=pv[i]||{name:'?',status:'new'}, on=!recSkip[i];
    if(on){ nOn++; kgOn+=fi.qty; }
    var from=(fi.from&&fi.from!==selRec.name)?'<span class="pbr-f">'+esc(fi.from)+'</span>':'';
    return '<label class="pbr ck'+(on?'':' off')+'"><input type="checkbox"'+(on?' checked':'')+' onchange="recToggle('+i+',this.checked)">'+
      '<span class="pbr-n">'+esc(it.name)+from+'</span><div class="pbr-r"><span class="pq">'+fKg(fi.qty)+'</span>'+
      (it.status==='merge'?'<span class="tm">FUSION</span>':'<span class="tn">NOUVEAU</span>')+'</div></label>';
  }).join('')||'<div class="empty-s">Aucun composant</div>';
  var s=document.getElementById('rec-incl-s');
  if(s) s.textContent=flat.length?(nOn+' / '+flat.length+' ingrédient'+(flat.length>1?'s':'')+' · '+fKg(kgOn)):'';
}
function recToggle(i,v){ if(v) delete recSkip[i]; else recSkip[i]=true; refreshRecPrev(); }
function recInclAll(v){
  if(!selRec) return; recSkip={};
  if(!v) flatten(selRec.id,curMult).forEach(function(_,i){ recSkip[i]=true; });
  refreshRecPrev();
}
function confirmRec(){
  if(!selRec){ toast('Sélectionnez une recette','err'); return; }
  var flat=flatten(selRec.id,curMult), keep=flat.filter(function(_,i){ return !recSkip[i]; });
  if(!keep.length){ toast('Cochez au moins un ingrédient','err'); return; }
  var partial=keep.length<flat.length;
  keep.forEach(function(fi){
    var ing=ingredients.find(function(i){return i.id===fi.ingId;});
    var ex=curBon.items.find(function(oi){return oi.ingId===fi.ingId;});
    if(ex){ ex.qty=rnd(ex.qty+fi.qty); ex.cost=rnd(ex.qty*(ing?ing.price:0)); bonAddUse(ex,fi.from,fi.qty); }
    else curBon.items.push({id:uid(),ingId:fi.ingId,qty:fi.qty,cost:rnd(fi.qty*(ing?ing.price:0)),uses:[{n:fi.from,q:fi.qty}]});
  });
  if(!curBon.recipesUsed) curBon.recipesUsed=[];
  var label=selRec.name+(partial?' (partiel)':'');
  if(curBon.recipesUsed.indexOf(selRec.name)<0&&curBon.recipesUsed.indexOf(label)<0) curBon.recipesUsed.push(label);
  addLog('Recette: '+selRec.name+' ×'+fQ(curMult)+(partial?' ('+keep.length+'/'+flat.length+' ingrédients)':''));
  closeMod('m-rec'); renderItems();
  toast(selRec.name+' ×'+fQ(curMult)+' ajouté'+(partial?' ('+keep.length+'/'+flat.length+')':''),'ok');
}


// ══ SUPPRIMER SANS CONFIRMATION, AVEC « ANNULER » ═════════════
function toastUndo(msg,restore){
  var t=document.getElementById('toast');
  t.innerHTML=ic('trash')+'<span>'+esc(msg)+'</span><button type="button" class="tu">Annuler</button>';
  t.className='toast show info has-undo'; clearTimeout(t._t);
  var done=false;
  t.querySelector('.tu').onclick=function(){ if(done) return; done=true; t.classList.remove('show','has-undo'); try{ restore(); toast('Rétabli','ok'); }catch(e){ console.error(e); } };
  t._t=setTimeout(function(){ t.classList.remove('show','has-undo'); },6500);
}
function refreshAllViews(){
  persist(); updBadges();
  try{ renderBons(); renderRec(); renderCat(); renderHome(); if(CUR==='fournisseurs') renderSuppliers(); }catch(e){ console.error(e); }
}
function askDel(type,id,name){
  var snap={ing:ingredients, rec:recipes, ord:orders, sup:suppliers.slice(),
    supLinks:ingredients.filter(function(i){ return i.supplierId===id; }).map(function(i){ return i.id; })};
  delType=type; delId=id;
  if(type==='sup'){ deleteSupplier(id); }
  else confirmDel();
  var lbl={ing:['Ingrédient','supprimé'],recipe:['Recette','supprimée'],order:['Bon','supprimé'],sup:['Fournisseur','supprimé']}[type]||['Élément','supprimé'];
  toastUndo(lbl[0]+' « '+name+' » '+lbl[1],function(){
    if(type==='ing') ingredients=snap.ing;
    else if(type==='recipe') recipes=snap.rec;
    else if(type==='order') orders=snap.ord;
    else if(type==='sup'){
      suppliers=snap.sup; saveSuppliers();
      ingredients.forEach(function(i){ if(snap.supLinks.indexOf(i.id)>=0) i.supplierId=id; });
    }
    refreshAllViews();
  });
}
function remItem(id){
  if(!curBon) return;
  var bon=curBon, idx=bon.items.findIndex(function(x){ return x.id===id; }); if(idx<0) return;
  var item=bon.items[idx], ing=ingredients.find(function(i){ return i.id===item.ingId; });
  remItem_old(id);
  toastUndo((ing?ing.name:'Ligne')+' retiré du bon',function(){
    bon.items.splice(Math.min(idx,bon.items.length),0,item);
    if(curBon===bon){ addLog('Rétabli: '+(ing?ing.name:'?')); renderItems(); }
  });
}
function remRI(idx){
  var arr=recItems, it=arr[idx]; if(!it) return;
  var nm=it.type==='recipe'?((recipes.find(function(r){return r.id===it.refId;})||{}).name):((ingredients.find(function(i){return i.id===it.refId;})||{}).name);
  remRI_old(idx);
  toastUndo((nm||'Ligne')+' retiré de la recette',function(){ if(recItems===arr){ arr.splice(Math.min(idx,arr.length),0,it); renderRItems(); } });
}


// ══ COULEUR PAR CATÉGORIE ═════════════════════════════════════
var CAT_HUES=[[/farine|cereale|grain|semoule/,36],[/beurre|matiere.?grasse|\bmg\b|huile|margarine/,50],[/creme|lait|oeuf|fromage|cremerie|laitage|yaourt/,205],
  [/sucre|miel|sirop|glucose/,330],[/levure|levain|ferment/,275],[/sel|epice|aromate|condiment|poivre/,12],[/fruit|legume|primeur/,125],
  [/chocolat|cacao|praline|cafe/,22],[/viande|charcut|poisson|traiteur|volaille/,355],[/fruits? secs?|noix|amande|noisette|graine/,30],
  [/boisson|eau|alcool|liqueur/,188],[/emballage|carton|sachet|consommable/,220],[/surgel|congel/,195],[/additif|ameliorant|gelifiant|colorant/,300]];
var CAT_FALL=[160,250,80,15,190,315,45,130];
function catHue(cat){
  var n=normTxt(cat);
  for(var i=0;i<CAT_HUES.length;i++) if(CAT_HUES[i][0].test(n)) return CAT_HUES[i][1];
  var h=0; for(var j=0;j<n.length;j++) h=(h*31+n.charCodeAt(j))>>>0;
  return CAT_FALL[h%CAT_FALL.length];
}
function catDot(cat){ return '<span class="cdot" style="--ch:'+catHue(cat)+'"></span>'; }
function renderItems(){
  renderItems_old();
  document.querySelectorAll('#e-items .ir').forEach(function(r,k){
    var bi=curBon&&curBon.items[k], bg=bi&&ingredients.find(function(x){ return x.id===bi.ingId; });
    if(ingNoW(bg)){ var u=r.querySelector('.iu'); if(u) u.textContent=bg.unit; var q=r.querySelector('.iq'); if(q) q.step='1'; }
    var c=r.querySelector('.ir-c'); if(!c||c.querySelector('.cdot')) return;
    var t=c.textContent.trim(); if(t){ r.style.setProperty('--ch',catHue(t)); c.insertAdjacentHTML('afterbegin',catDot(t)); }
  });
}


// ══ RECHERCHE GLOBALE ═════════════════════════════════════════
var GS={items:[],sel:0};
function openSearch(){
  var o=document.getElementById('m-search'); o.classList.add('show');
  var i=document.getElementById('gs-in'); i.value=''; gsRender();
  try{ i.focus(); }catch(e){}
  setTimeout(function(){ try{ i.focus(); }catch(e){} },30);
}
function closeSearch(){ document.getElementById('m-search').classList.remove('show'); }
function gsScore(name,q){ var n=normTxt(name); if(!q) return 1; var k=n.indexOf(q); if(k<0) return 0; return k===0?3:(/[\s\-'’(]/.test(n.charAt(k-1))?2:1); }
function gsRender(){
  var q=normTxt(document.getElementById('gs-in').value.trim()), out=[], html='';
  function section(title,rows){
    if(!rows.length) return;
    html+='<div class="gs-h">'+title+'</div>';
    rows.forEach(function(r){ var i=out.length; out.push(r);
      html+='<div class="gs-r" data-i="'+i+'" onmousemove="gsHover('+i+')" onclick="gsGo('+i+')"><span class="gs-ic">'+r.icon+'</span><span class="gs-t"><b>'+esc(r.t)+'</b>'+(r.m?'<small>'+r.m+'</small>':'')+'</span><span class="gs-go">'+ic('arrow-right')+'</span></div>'; });
  }
  function pick(list,nameOf,extra){
    return list.map(function(x){ var s=gsScore(nameOf(x),q); if(!s&&extra) s=extra(x)?0.5:0; return {x:x,s:s}; })
      .filter(function(o){ return o.s>0; }).sort(function(a,b){ return b.s-a.s||nameOf(a.x).localeCompare(nameOf(b.x),'fr'); }).slice(0,q?6:0).map(function(o){ return o.x; });
  }
  if(!q){
    section('Actions rapides',[
      {icon:ic('bon'),t:'Nouveau bon',m:'',go:function(){ openNewBon(); }},
      {icon:ic('book'),t:'Nouvelle recette',m:'',go:function(){ openNewRec(); }},
      {icon:ic('box'),t:'Nouvel ingrédient',m:'',go:function(){ goPage('catalogue'); openMod('m-addcat'); }},
      {icon:ic('settings'),t:'Réglages & apparence',m:'',go:function(){ goPage('backup'); }}
    ]);
    var rr=recipes.slice().sort(function(a,b){ return (b.updatedAt||b.createdAt||0)>(a.updatedAt||a.createdAt||0)?1:-1; }).slice(0,4);
    section('Recettes récentes',rr.map(function(r){ return {icon:recThumb(r),t:r.name,m:esc(r.cat||''),go:function(){ openEditRec(r.id); }}; }));
  } else {
    section('Recettes',pick(recipes,function(r){return r.name;},function(r){ return normTxt(r.cat).indexOf(q)>=0; }).map(function(r){
      return {icon:recThumb(r),t:r.name,m:esc(r.cat||'')+' · '+fEur(recCost(r.id)),go:function(){ openEditRec(r.id); }}; }));
    section('Ingrédients',pick(ingredients,function(i){return i.name;},function(i){ return normTxt(i.ref||'').indexOf(q)>=0; }).map(function(i){
      return {icon:'<span class="cdot" style="--ch:'+catHue(i.cat)+';margin:0"></span>',t:i.name,m:esc(i.cat||'')+' · '+(i.price>0?dispPrice(i):'sans prix'),go:function(){ goPage('catalogue'); openEditIng(i.id); }}; }));
    section('Fournisseurs',pick(suppliers,function(s){return s.name;}).map(function(s){
      var n=ingredients.filter(function(i){return i.supplierId===s.id;}).length;
      return {icon:ic('truck'),t:s.name,m:n+' ingrédient'+(n>1?'s':''),go:function(){ goPage('fournisseurs'); supOpen[s.id]=true; renderSuppliers(); var e=document.getElementById('sup-'+s.id); if(e) e.scrollIntoView({block:'center'}); }}; }));
    section('Bons',pick(orders,function(o){return o.name;},function(o){ return normTxt(fDate(o.date)).indexOf(q)>=0; }).map(function(o){
      return {icon:ic(o.status==='validated'?'check-circle':'bon'),t:o.name,m:fDate(o.date)+' · '+fEur(orderCost(o))+(o.status==='validated'?' · validé':' · brouillon'),go:function(){ openEditBon(o.id); }}; }));
    if(!out.length) html='<div class="gs-empty">Aucun résultat pour « '+esc(document.getElementById('gs-in').value.trim())+' »</div>';
  }
  GS.items=out; GS.sel=0;
  document.getElementById('gs-res').innerHTML=html; gsMark();
}
function gsMark(){ document.querySelectorAll('#gs-res .gs-r').forEach(function(e){ var on=+e.dataset.i===GS.sel; e.classList.toggle('on',on); if(on&&e.scrollIntoViewIfNeeded) e.scrollIntoViewIfNeeded(false); }); }
function gsHover(i){ if(GS.sel!==i){ GS.sel=i; gsMark(); } }
function gsGo(i){ var r=GS.items[i]; if(!r) return; closeSearch(); r.go(); }
function gsKey(e){
  if(e.key==='ArrowDown'){ e.preventDefault(); GS.sel=Math.min(GS.sel+1,GS.items.length-1); gsMark(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); GS.sel=Math.max(GS.sel-1,0); gsMark(); }
  else if(e.key==='Enter'){ e.preventDefault(); gsGo(GS.sel); }
  else if(e.key==='Escape'){ closeSearch(); }
}
document.addEventListener('keydown',function(e){
  var k=(e.key||'').toLowerCase(), t=e.target, typing=t&&(/^(input|textarea|select)$/i.test(t.tagName)||t.isContentEditable);
  if((e.ctrlKey||e.metaKey)&&k==='k'){ e.preventDefault(); openSearch(); }
  else if(k==='/'&&!typing&&!document.querySelector('.ov.show')){ e.preventDefault(); openSearch(); }
});


// ══ RECETTES EN VIGNETTES ═════════════════════════════════════
function recView(){ var v=LS.getItem('v4_recview'); return v==='list'?'list':'grid'; }
function setRecView(v){ LS.setItem('v4_recview',v); renderRec(); }
function recTile(r){
  var flat=flatten(r.id), w=flat.reduce(function(s,i){return s+i.qty;},0);
  var cost=flat.reduce(function(s,i){ var ing=ingredients.find(function(x){return x.id===i.ingId;}); return s+(ing?ing.price*i.qty:0); },0);
  var ph=recHasPhoto(r)?'<img src="'+esc(r.image)+'" alt="" loading="lazy">':'<span class="rt-em">'+recThumb(r)+'</span>';
  return '<div class="rt" onclick="openEditRec(\''+r.id+'\')">'+
    '<div class="rt-ph'+(recHasPhoto(r)?' img':'')+'" style="--ch:'+catHue(r.cat||'')+'">'+ph+
      '<div class="rt-tools" onclick="event.stopPropagation()"><button class="rt-tb" onclick="ficheFromCard(\''+r.id+'\')" title="Fiche technique">'+ic('file')+'</button><button class="rt-tb" onclick="dupRecette(\''+r.id+'\')" title="Dupliquer">'+ic('copy')+'</button><button class="rt-tb rt-del" onclick="askDel(\'recipe\',\''+r.id+'\',\''+escJS(r.name)+'\')" title="Supprimer">'+ic('trash')+'</button></div>'+
      '<button class="rt-add" onclick="event.stopPropagation();quickAddRec(\''+r.id+'\')" title="Ajouter au bon">'+ic('plus')+'</button>'+
      (r.shared?'<span class="rt-badge" title="Partagée">'+ic('users')+' Partagée</span>':(r.fromShared?'<span class="rt-badge alt" title="Copiée depuis les recettes partagées">'+ic('copy')+' '+esc(r.fromShared.by||'')+'</span>':''))+'</div>'+
    '<div class="rt-b"><div class="rt-n">'+esc(r.name)+'</div><div class="rt-m">'+fKg(w)+' · '+fEur(cost)+(r.time?' · '+ic('clock')+' '+fDur(r.time):'')+((r.attachments||[]).length?' · '+ic('clip')+r.attachments.length:'')+'</div><div class="rt-c">'+catDot(r.cat||'')+esc(r.cat||'')+'</div></div></div>';
}
// « + Bon » : ouvre le bon avec le choix du poids et des ingrédients
function quickAddRec(recId){
  if(!recipes.some(function(r){return r.id===recId;})) return;
  if(CUR!=='edit'||!curBon){
    if(!curBon){ curBon=mkOrder(); curBonNew=true; curImg=null; }
    renderEd(); goPage('edit');
  }
  openMod('m-rec'); pickRec(recId);
}

// ══ GLISSER SUR TÉLÉPHONE ═════════════════════════════════════
var SWIPE_RULES=[
  {row:'.ir', left:'.idel', leftLbl:'Retirer', right:'input', rightLbl:'Quantité', focus:true},
  {row:'.catcard', left:'.cat-del', leftLbl:'Supprimer', right:'.cat-edit', rightLbl:'Modifier'},
  {row:'.rc', left:'.btn-red', leftLbl:'Supprimer', right:'[title="Modifier"]', rightLbl:'Modifier'},
  {row:'.rt', left:'.rt-del', leftLbl:'Supprimer', right:'.rt-add', rightLbl:'Au bon'},
  {row:'.bc', left:'.btn-red', leftLbl:'Supprimer', right:'@self', rightLbl:'Ouvrir'}
];
(function(){
  var S=null, TH=80;
  function ruleFor(t){
    var ro=document.body.classList.contains('cl-ro');
    for(var i=0;i<SWIPE_RULES.length;i++){ var r=SWIPE_RULES[i], el=t.closest&&t.closest(r.row); if(el&&el.closest('#scroll')){
      if(ro&&(r.row==='.catcard'||r.row==='.rc')) return null;
      if(ro&&r.row==='.rt') r=Object.assign({},r,{left:null});
      if(ro&&r.row==='.ir'&&el.closest('#p-rec-edit')) return null;
      return {rule:r,el:el}; } }
    return null;
  }
  function target(sel,el){ return sel==='@self'?el:(sel?el.querySelector(sel):null); }
  function wrap(st){
    var el=st.el, cs=getComputedStyle(el), w=document.createElement('div');
    w.className='sw-wrap'; w.style.margin=cs.margin; w.style.borderRadius=cs.borderRadius;
    w.innerHTML='<span class="sw-a l">'+ic(st.rule.focus?'edit':(st.rule.rightLbl==='Au bon'?'plus':(st.rule.rightLbl==='Ouvrir'?'arrow-right':'edit')))+' '+st.rule.rightLbl+'</span><span class="sw-a r">'+st.rule.leftLbl+' '+ic('trash')+'</span>';
    el.parentNode.insertBefore(w,el); w.appendChild(el);
    st.oldMargin=el.style.margin; el.style.margin='0'; el.classList.add('sw-row'); st.wrap=w;
  }
  function unwrap(st){
    var el=st.el, w=st.wrap; if(!w) return;
    el.classList.remove('sw-row'); el.style.transform=''; el.style.transition=''; el.style.margin=st.oldMargin||'';
    if(w.parentNode){ w.parentNode.insertBefore(el,w); w.remove(); }
  }
  document.addEventListener('touchstart',function(e){
    if(S||e.touches.length!==1) return;
    var t=e.target; if(t.closest('.ov.show')) return;
    var m=ruleFor(t); if(!m) return;
    S={rule:m.rule, el:m.el, x0:e.touches[0].clientX, y0:e.touches[0].clientY, dx:0, on:false, dead:false};
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!S||S.dead) return;
    var dx=e.touches[0].clientX-S.x0, dy=e.touches[0].clientY-S.y0;
    if(!S.on){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){ S.dead=true; return; }
      if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.3) return;
      S.on=true; wrap(S);
      if(document.activeElement&&document.activeElement.blur&&S.el.contains(document.activeElement)) document.activeElement.blur();
    }
    e.preventDefault();
    if(dx>0&&!target(S.rule.right,S.el)) dx=Math.min(dx,24);
    if(dx<0&&!target(S.rule.left,S.el)) dx=Math.max(dx,-24);
    var lim=S.el.offsetWidth*.85; dx=Math.max(-lim,Math.min(lim,dx));
    var was=Math.abs(S.dx)>=TH; S.dx=dx;
    S.el.style.transform='translateX('+dx+'px)';
    S.wrap.classList.toggle('to-l',dx<0); S.wrap.classList.toggle('to-r',dx>0);
    var arm=Math.abs(dx)>=TH; S.wrap.classList.toggle('armed',arm);
    if(arm&&!was&&navigator.vibrate) try{ navigator.vibrate(8); }catch(err){}
  },{passive:false});
  function end(){
    if(!S) return; var st=S; S=null;
    if(!st.on) return;
    var dx=st.dx, el=st.el;
    var act=Math.abs(dx)>=TH?(dx<0?target(st.rule.left,el):target(st.rule.right,el)):null;
    el.style.transition='transform .18s ease';
    if(act&&dx<0){
      el.style.transform='translateX(-110%)';
      setTimeout(function(){ unwrap(st); act.click(); },170);
    } else {
      el.style.transform='translateX(0)';
      setTimeout(function(){
        unwrap(st);
        if(act){ if(st.rule.focus){ try{ act.focus(); act.select(); }catch(e){} } else act.click(); }
      },180);
    }
    // évite le « clic » fantôme sur la ligne après un glissement
    var block=function(ev){ if(!ev.isTrusted) return; ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click',block,true); };
    document.addEventListener('click',block,true); setTimeout(function(){ document.removeEventListener('click',block,true); },400);
  }
  document.addEventListener('touchend',end,{passive:true});
  document.addEventListener('touchcancel',end,{passive:true});
})();

// ══ DÉMARRAGE ═════════════════════════════════════════════════
function initApp(){
  try{ var th=LS.getItem('v4_theme'); if(th&&localStorage.getItem('v4_theme')!==th){ localStorage.setItem('v4_theme',th); applyTheme(); } }catch(e){}
  try{ document.querySelectorAll('[data-crest]').forEach(function(e){ e.src=BON_CREST; }); }catch(e){}
  var ch=false;
  ingredients.forEach(function(i){
    if(i._m) return; i._m=1; ch=true;
    if(!i.priceHistory){ var bp=(i.buyPrice!=null?i.buyPrice:i.price); i.priceHistory=bp>0?[{d:null,p:bp,u:i.unit||'kg',k:i.price}]:[]; }
  });
  recipes.forEach(function(r){ if(!r.updatedAt&&r.createdAt){ r.updatedAt=r.createdAt; ch=true; } });
  if(ch){ DB.save('v4_ing',ingredients); DB.save('v4_rec',recipes); }
  try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(function(){}); }catch(e){}
}
