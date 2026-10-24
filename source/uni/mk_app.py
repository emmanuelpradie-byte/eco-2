import re, json, sys
sys.path.insert(0, '.')
from icons import ICONS

s = open('m.js', encoding='utf-8').read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, (n, count, old[:90])
    s = s.replace(old, new)

# ── Stockage : tout passe par LS (IndexedDB + miroir localStorage) ──
s = s.replace('localStorage.', 'LS.')

# ── persist : métadonnées des ingrédients créés ailleurs ──
rep("function persist(){\n  DB.save('v4_ing'", "function persist(){\n  try{ ingMetaHook(); }catch(e){}\n  DB.save('v4_ing'")

# ── Navigation ──
rep("var ALLP=['home','bons','edit','recettes','rec-edit','catalogue','backup'];",
    "var ALLP=['home','bons','edit','recettes','rec-edit','catalogue','backup','fournisseurs','partage','admin','rec-import','rec-valid'];")
rep("var NAVP=['home','bons','recettes','catalogue'];", "var NAVP=['home','bons','recettes','catalogue','fournisseurs','backup','partage','admin'];")
rep("var labels={home:'Accueil',bons:'Bons',recettes:'Recettes',catalogue:'Catalogue',backup:'Sauvegarde'};",
    "var labels={home:'Accueil',bons:'Bons d’économat',recettes:'Recettes',catalogue:'Catalogue',backup:'Réglages & sauvegarde',fournisseurs:'Fournisseurs'};")
rep("""act.innerHTML='<button class="tbtn gold" onclick="openNewBon()">＋ Nouveau</button>';""",
    """act.innerHTML='<button class="tbtn gold" onclick="openNewBon()">'+ic('plus')+' Nouveau</button>';""")
rep("""act.innerHTML='<button class="tbtn gold" onclick="openNewRec()">＋ Créer</button>';""",
    """act.innerHTML='<button class="tbtn gold cn-tbnew" onclick="openNewRec()">'+ic('plus')+' Créer</button>';""")
rep("""act.innerHTML='<button class="tbtn gold" onclick="openMod(\\'m-addcat\\')">＋ Ajouter</button>';""",
    """act.innerHTML='<button class="tbtn gold" onclick="openMod(\\'m-addcat\\')">'+ic('plus')+' Ajouter</button>';\n  if(p==='fournisseurs')act.innerHTML='<button class="tbtn gold" onclick="openSupplier(\\'\\')">'+ic('plus')+' Ajouter</button>';""")
rep("  if(p==='backup')renderBackup();\n}", "  if(p==='backup')renderBackup();\n  if(p==='fournisseurs')renderSuppliers();\n}")
# module d'import : sa propre navigation doit connaître les nouvelles pages
rep("['home','bons','edit','recettes','rec-edit','catalogue','backup','rec-import','rec-valid'].forEach",
    "['home','bons','edit','recettes','rec-edit','catalogue','backup','fournisseurs','partage','admin','rec-import','rec-valid'].forEach")
rep("    ['home','bons','recettes','catalogue'].forEach(function(id){\n      var a=document.getElementById('nav-'+id)",
    "    ['home','bons','recettes','catalogue','fournisseurs','backup'].forEach(function(id){\n      var a=document.getElementById('nav-'+id)")

# ── Éditeur de bon ──
rep("  renderItems();renderMlog();\n}", "  renderItems();renderMlog();syncBonGroupUI();\n}")
rep("addLog('Image ajoutée');livePreview();", "addLog('Image ajoutée');livePreview();syncBonGroupUI();")
rep("document.getElementById('t-w').textContent=fQup(w);", "document.getElementById('t-w').textContent=fKgUp(w);")
rep("""<span class="pq">'+fQ(item.qty)+' kg</span>""", """<span class="pq">'+fKg(item.qty)+'</span>""")
rep("""<div class="iu">kg</div><button class="idel" onclick="remItem(\\''+item.id+'\\')">✕</button>""",
    """<div class="iu">kg</div><button class="idel" onclick="remItem(\\''+item.id+'\\')" title="Retirer">'+ic('x')+'</button>""")
# Regroupement du bon (catégorie / fournisseur) dans l'aperçu, le PDF et le CSV
rep("return{name:ing?ing.name:'?',cat:ing?ing.cat:'',qty:item.qty,cost:item.cost,price:ing?ing.price:0,ing:ing||null,uses:item.uses||[]};});\n  var totalCost",
    "return{name:ing?ing.name:'?',cat:ing?ing.cat:'',qty:item.qty,cost:item.cost,price:ing?ing.price:0,ing:ing||null,uses:item.uses||[]};});\n  var totalCost")
rep("return{id:curBon.id,name:name,date:date,notes:notes,status:curBon.status,",
    "return{id:curBon.id,groupBy:curBon.groupBy||'cat',name:name,date:date,notes:notes,status:curBon.status,")
rep("  var rows=groupItemsByCat(d.items).map(function(g){", "  var rows=groupBonItems(d.items,d.groupBy).map(function(g){")
rep("  groupItemsByCat(full).forEach(function(g){", "  groupBonItems(full,curBon.groupBy).forEach(function(g){")
# PDF : une page par fournisseur, avec sous-total
rep("    y=108.5+12.3*(sub.length-1)+5;\n    header();",
    "    y=108.5+12.3*(sub.length-1)+5;\n    if(!d.pagePerGroup) header();")
rep("""    groupItemsByCat(d.items).forEach(function(g){
      if(ensure(20+17)){} catBand(g.cat);""",
    """    function supTitle(g,gi){
      if(gi>0){ doc.addPage(); page++; chrome(); y=46; } else { y+=6; }
      doc.setFont(F,'bold'); doc.setFontSize(15); rgb('setTextColor',INK);
      doc.text(doc.splitTextToSize(g.cat,R-L)[0], L, y+14); y+=20;
      doc.setFont(F,'italic'); doc.setFontSize(8.5); rgb('setTextColor',GREY);
      doc.text(g.info||(gi>0?(d.name||'Bon')+' — '+fDate(d.date):' '), L, y+6); y+=14;
      header();
    }
    function groupTotal(g){
      ensure(21);
      rgb('setFillColor',INK); doc.rect(L,y,R-L,21,'F');
      doc.setFont(F,'bold'); doc.setFontSize(9.5); doc.setTextColor(255,255,255);
      doc.text(doc.splitTextToSize('SOUS-TOTAL '+String(g.cat).toUpperCase(),X.cost-X.name-8)[0], X.name, y+14);
      doc.text(fEur(g.items.reduce(function(s,i){return s+i.cost;},0)), X.cost, y+14);
      y+=21;
    }
    groupBonItems(d.items,d.groupBy).forEach(function(g,gi){
      if(d.pagePerGroup) supTitle(g,gi);
      else if(ensure(20+17)){}
      if(!d.pagePerGroup) catBand(g.cat);""")
rep("""        y+=rh;
      });
    });""", """        y+=rh;
      });
      if(d.pagePerGroup) groupTotal(g);
    });""")
rep("doc.save((d.name||'bon').replace(/[^a-z0-9]/gi,'_')+'.pdf');", "doc.save((d.fileName||d.name||'bon').replace(/[^a-z0-9]/gi,'_')+'.pdf');")

# ── Fonctions remplacées (nouvelles versions dans features.js) ──
for name in ['renderBons', 'renderHome', 'renderRec', 'calcRecTots', 'renderCat', 'updBadges', 'toast', 'pickIng', 'pickRIng', 'pickRec', 'initRecMod', 'refreshRecPrev', 'confirmRec', 'askDel', 'remItem', 'remRI', 'renderItems', 'quickAddRec']:
    rep('function %s(' % name, 'function %s_old(' % name)
for name in ['addIng', 'openEditIng', 'saveEditIng', 'openMod', 'renderBackup', 'openNewRec', 'openEditRec', 'saveRecipe']:
    rep('function %s(' % name, 'function %sBase(' % name)
rep("createdAt:editRecId?(function(){var r=recipes.find", "updatedAt:now(),createdAt:editRecId?(function(){var r=recipes.find")

# ── Vignettes de recettes dans les listes ──
rep("""<div class="rpe">'+(r.image&&r.image.length<=4?r.image:'📖')+'</div>""", """<div class="rpe">'+recThumb(r)+'</div>""", 2)
rep("""<div class="ir-n" style="color:var(--bl)">⊛ '+esc(rec?rec.name:'?')+'""", """<div class="ir-n" style="color:var(--g2)">'+ic('sub')+' '+esc(rec?rec.name:'?')+'""")
rep("""<button class="idel" onclick="remRI('+idx+')">✕</button>""", """<button class="idel" onclick="remRI('+idx+')" title="Retirer">'+ic('x')+'</button>""", 2)
rep("""<div class="ir" style="border-left:2px solid var(--bl)">""", """<div class="ir" style="box-shadow:inset 3px 0 0 var(--beige2)">""")

# ── Sauvegarde ──
rep("ocrFix: (function(){ try{ return JSON.parse(LS.getItem('v4_ocrfix')||'{}'); }catch(e){ return {}; } })()",
    "ocrFix: (function(){ try{ return JSON.parse(LS.getItem('v4_ocrfix')||'{}'); }catch(e){ return {}; } })(),\n    suppliers: (typeof suppliers!=='undefined'?suppliers:[]), profile: (typeof loadProfile==='function'?loadProfile():{})")
rep("  a.click(); URL.revokeObjectURL(a.href);\n  toast('💾 Sauvegarde",
    "  a.click(); URL.revokeObjectURL(a.href);\n  LS.setItem('v4_lastbackup',String(Date.now())); LS.removeItem('v4_bksnooze'); updBadges();\n  if(CUR==='home') renderHome(); if(CUR==='backup') renderBackup();\n  toast('💾 Sauvegarde")
rep("  persist(); updBadges(); renderCat(); renderRec(); renderHome(); renderBackup();",
    "  restoreExtras(d, mode);\n  persist(); updBadges(); renderCat(); renderRec(); renderHome(); renderBackup();")
rep("""'<button class="btn btn-gold btn-full" onclick="exportBackup()">💾 Enregistrer une sauvegarde</button>'""",
    """'<button class="btn btn-gold btn-full" onclick="exportBackup()">'+ic('download')+' Enregistrer une sauvegarde</button>'""")

# ── Suppression d'un fournisseur ──
rep("function confirmDel(){", "function confirmDel(){if(delType==='sup'){closeMod('m-del');deleteSupplier(delId);return;}")

# ── Catégories : icônes au trait ──
rep("var CATI={'Farines & Céréales':'🌾','Beurres & MG':'🧈','Sucres':'🍬','Levures':'🧫','Œufs & Laitages':'🥚','Sel & Épices':'🧂','Fruits & Garnitures':'🍓','Emballages':'📦','Autre':'📦'};",
    "var CATI={'Farines & Céréales':'wheat','Beurres & MG':'droplet','Sucres':'cube','Levures':'bubbles','Œufs & Laitages':'egg','Sel & Épices':'salt','Fruits & Garnitures':'cherry','Emballages':'box','Autre':'tag'};")
rep("var icon=(kind==='ing'?(CATI[cat]||'🗂'):'📁');", "var icon=(kind==='ing'?catIcon(cat):ic('folder'));")
rep("""onclick="renameSubUI(\\''+s.id+'\\')">✎</button>'""", """onclick="renameSubUI(\\''+s.id+'\\')" title="Renommer">'+ic('edit')+'</button>'""")
rep("""onclick="moveSubUI(\\''+s.id+'\\')">⇄</button>'""", """onclick="moveSubUI(\\''+s.id+'\\')" title="Déplacer">'+ic('arrow-right')+'</button>'""")
rep("""onclick="deleteSubUI(\\''+s.id+'\\')">✕</button>'""", """onclick="deleteSubUI(\\''+s.id+'\\')" title="Supprimer">'+ic('trash')+'</button>'""")
rep("""onclick="addSubUI(\\''+esc(cat).replace(/'/g,"\\\\'")+'\\')">＋ Sous-catégorie</button>'""",
    """onclick="addSubUI(\\''+esc(cat).replace(/'/g,"\\\\'")+'\\')">'+ic('plus')+' Sous-catégorie</button>'""")
rep("""'<span style="font-size:11px;color:var(--i4)">'+(open?'▾':'▸')+'</span>'""", """'<span style="font-size:13px;color:var(--i4);display:flex">'+ic(open?'chev-down':'chev-right')+'</span>'""")
rep("""'<button class="m-x" onclick="closeAsk(false)">✕</button></div>'""", """'<button class="m-x" onclick="closeAsk(false)">'+ic('x')+'</button></div>'""")
rep("""ov.innerHTML='<div class="modal" style="max-width:380px">'+""", """ov.innerHTML='<div class="modal" style="max-width:380px"><div class="m-grip"></div>'+""")

# ── Module d'import : icônes ──
rep("""<span class="ri-opt-ic">📄</span>""", """<span class="ri-opt-ic">'+ic('pdf')+'</span>""")
rep("""<span class="ri-opt-ic">📷</span>""", """<span class="ri-opt-ic">'+ic('camera')+'</span>""")
rep("""<span class="ri-opt-ic">🖼️</span>""", """<span class="ri-opt-ic">'+ic('image')+'</span>""")
rep("""<span class="ri-opt-ic">📊</span>""", """<span class="ri-opt-ic">'+ic('sheet')+'</span>""")
rep("""<span class="ri-opt-ic">📑</span>""", """<span class="ri-opt-ic">'+ic('layers')+'</span>""")
rep("""'<div class="cw-t">🧠 Analyse par IA """, """'<div class="cw-t">'+ic('sparkle')+' Analyse par IA """)
rep("""onclick="RIMP.openFixes()">🧠 Corrections apprises</button>'""", """onclick="RIMP.openFixes()">'+ic('sparkle')+' Corrections apprises</button>'""")
rep("""<div class="m-hdr"><h3>🧠 Corrections apprises</h3><button class="m-x" onclick="RIMP.closeFixes()">✕</button></div>""",
    """<div class="m-grip"></div><div class="m-hdr"><h3>Corrections apprises</h3><button class="m-x" onclick="RIMP.closeFixes()">'+ic('x')+'</button></div>""")
rep("""var b=el('button','btn btn-ghost btn-full','📄 Importer une recette');""", """var b=el('div','cn-imp','<span class="cn-imp-ic">'+ic('upload')+'</span><span class="cn-imp-t"><b>Importer une recette</b><span>PDF, photo ou fichier Excel</span></span><button type="button" class="cn-imp-b">Importer '+ic('chev-right')+'</button>'); b.id='rec-imp';""")
rep("""id="ri-add">＋ Ligne</button>""", """id="ri-add">'+ic('plus')+' Ligne</button>""")
rep("""id="ri-save">✓ Enregistrer</button>""", """id="ri-save">'+ic('check')+' Enregistrer</button>""")
rep("""'.ri-opt-ic{font-size:22px;flex-shrink:0}',""", """'.ri-opt-ic{font-size:20px;flex-shrink:0;width:42px;height:42px;border-radius:11px;background:var(--beige);display:flex;align-items:center;justify-content:center;color:var(--i)}',""")
rep("""'.ri-sum{background:var(--i);color:#fff;border-radius:10px;padding:13px 15px;margin-bottom:12px}',""", """'.ri-sum{background:var(--i);color:#fff;border-radius:12px;padding:13px 15px;margin-bottom:12px}',""")
rep("""'.ri-step{font-size:11px;color:var(--i4);margin-bottom:12px}.ri-step b{color:var(--g)}'""", """'.ri-step{font-size:12px;color:var(--i4);margin-bottom:12px}.ri-step b{color:var(--i)}'""")
rep("""'.ri-sub{background:rgba(46,107,168,.06);border:1px solid rgba(46,107,168,.2);border-radius:9px;padding:10px 12px;margin-bottom:10px}',""",
    """'.ri-sub{background:var(--alt);border:1px solid var(--beige2);border-radius:10px;padding:10px 12px;margin-bottom:10px}',""")
rep("""'.ri-sub-t{font-size:12px;font-weight:600;color:var(--bl);margin-bottom:3px}',""", """'.ri-sub-t{font-size:12.5px;font-weight:600;color:var(--i);margin-bottom:3px}',""")
rep("""'<div class="ri-sub"><div class="ri-sub-t">⊛ '+esc(s.name)+'</div>'""", """'<div class="ri-sub"><div class="ri-sub-t">'+ic('sub')+' '+esc(s.name)+'</div>'""")
rep("""<span class="ri-badge b-new" style="flex-shrink:0">⊛ '+esc(p.section)+'</span>""", """<span class="ri-badge b-new" style="flex-shrink:0">'+esc(p.section)+'</span>""")
rep("""Aucun ingrédient — utilisez ＋ Ligne""", """Aucun ingrédient — utilisez « Ligne »""")
rep("""margin:12px 0 6px">⊛ '+esc(l.subName)+'</div>""", """margin:12px 0 6px">'+ic('sub')+' '+esc(l.subName)+'</div>""")
rep("""'<span class="ri-badge b-new">⊛ Sous-recette</span>'""", """'<span class="ri-badge b-new">'+ic('sub')+' Sous-recette</span>'""")
rep("""'<span class="ri-badge b-ok2">✓ Correspondance '""", """'<span class="ri-badge b-ok2">'+ic('check')+' Correspondance '""")
rep("""'<span class="ri-badge b-warn">⚠ À valider '""", """'<span class="ri-badge b-warn">'+ic('alert')+' À valider '""")
rep("""'<span class="ri-badge b-warn">❓ Incertain '""", """'<span class="ri-badge b-warn">'+ic('help')+' Incertain '""")
rep("""'<span class="ri-badge b-new">➕ À créer</span>'""", """'<span class="ri-badge b-new">'+ic('plus')+' À créer</span>'""")
rep(""">⊛ '+esc(r.name)+'</option>""", """>'+esc(r.name)+' (recette)</option>""")
rep("""onclick="RIMP.del('+idx+')">✕</button>'""", """onclick="RIMP.del('+idx+')" title="Supprimer la ligne">'+ic('x')+'</button>'""")
rep("""style="color:#B42318">⚠ Lecture incertaine""", """style="color:#B42318">'+ic('alert')+' Lecture incertaine""")
rep("""style="color:#B54708">✎ Lu « '""", """style="color:#B54708">'+ic('edit')+' Lu « '""")
rep("""style="color:#B54708">⚠ Aucune unité lue""", """style="color:#B54708">'+ic('alert')+' Aucune unité lue""")
rep("""style="color:#B54708">⚠ Aucune unité écrite""", """style="color:#B54708">'+ic('alert')+' Aucune unité écrite""")
rep("""style="color:var(--bl)">⊛ Rattaché à la recette""", """style="color:var(--g2)">'+ic('sub')+' Rattaché à la recette""")
rep("""'<div class="cw-t" style="color:#B42318">⚠ '+w.length""", """'<div class="cw-t" style="color:#B42318">'+ic('alert')+' '+w.length""")
rep("""'<span>📑 Recette '+(draftQueueIdx""", """'<span>'+ic('layers')+' Recette '+(draftQueueIdx""")
rep("""onclick="RIMP.delFix(\\''+k.replace(/'/g,"\\\\'")+'\\')">✕</button>'""", """onclick="RIMP.delFix(\\''+k.replace(/'/g,"\\\\'")+'\\')">'+ic('x')+'</button>'""")
rep("""box.innerHTML='<div class="cw" style="border-color:var(--g)"><div class="cw-t">↻ Vérification interrompue</div>'""",
    """box.innerHTML='<div class="cw" style="border-color:var(--beige2);background:var(--alt)"><div class="cw-t">'+ic('refresh')+' Vérification interrompue</div>'""")
# Journal d'analyse : icônes au lieu des emojis
rep("function logLine(txt){\n  var l=document.getElementById('ri-log');",
    "function logLine(txt){\n  txt=String(txt).replace(/^(🧠|⚠️|✓|🔍)\\s*/u,function(m,g){ return ic(g==='🧠'?'sparkle':g==='⚠️'?'alert':g==='🔍'?'search':'check')+' '; });\n  var l=document.getElementById('ri-log');")

# ── Bon PDF : couleur du thème ──
rep("var INK=[35,31,32], GREY=[140,140,140], LGREY=[150,150,150], BEIGE=[242,220,186], ALT=[250,244,234], SEP=[228,220,207];",
    "var INK=[35,31,32], GREY=[140,140,140], LGREY=[150,150,150], BEIGE=bonPal().beige, ALT=bonPal().alt, SEP=bonPal().sep;")

# ── Démarrage ──
rep("loadDefaults();migrateUnits();updBadges();renderHome();", "initApp();var _acctNew=!ingredients.length;loadDefaults();migrateUnits();if(_acctNew)acctMarkPristine();cloudInit();updBadges();renderHome();")

# ── Import : l'écran de vérification est remplacé par l'éditeur de recette ──
# (dans le module d'import, pour accéder à son état privé : draft, draftQueue…)
imp = open('impedit.js', encoding='utf-8').read()
rep("// ── 9. NAVIGATION ─────────────────────────────────────────────", imp + "\n// ── 9. NAVIGATION ─────────────────────────────────────────────")

# ── Insertion des nouveautés avant le démarrage ──
feat = open('features.js', encoding='utf-8').read() + '\n' + open('cloud.js', encoding='utf-8').read() + '\n' + open('share.js', encoding='utf-8').read() + '\n' + open('partage.js', encoding='utf-8').read() + '\n' + open('nav.js', encoding='utf-8').read() + '\n' + open('admin.js', encoding='utf-8').read() + '\n' + open('gate.js', encoding='utf-8').read() + '\n' + open('compte.js', encoding='utf-8').read() + '\n' + open('carnet.js', encoding='utf-8').read() + '\n' + open('swap.js', encoding='utf-8').read() + '\n' + open('refcat.js', encoding='utf-8').read() + '\n' + open('boned.js', encoding='utf-8').read() + '\n' + open('polish.js', encoding='utf-8').read() + '\n' + open('notif.js', encoding='utf-8').read()
rep("c.name='Copie — '+r.name;c.createdAt=now();", "c.name='Copie — '+r.name;delete c.shared;delete c.shareFolder;delete c.fromShared;c.createdAt=now();")
rep("function exportBackup(){\n  var d=collectData();", "function exportBackup(){\n  var d=collectData(); try{ d.attachments=collectAttachments(); }catch(e){}")
feat = feat.replace('/*ICONS_JSON*/{}', json.dumps(ICONS, ensure_ascii=False))
rep("// ── BOOT ", feat + "\n// ── BOOT ")

assert '</script' not in s
open('app.js', 'w', encoding='utf-8').write(s)
print('ok', len(s))
