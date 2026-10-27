import sys, base64
from playwright.sync_api import sync_playwright
NOGATE="document.addEventListener('DOMContentLoaded',function(){var s=document.createElement('style');s.textContent='html.gated #shell{visibility:visible!important}html.gated #gate{display:none!important}html.gated body{overflow:auto!important}';document.head.appendChild(s);});"
S='/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/'
FAKE=open(S+'bon/fakejspdf.js').read()
OUT=S+'uni/shots/'
F='file:///mnt/user-data/outputs/'+(sys.argv[1] if len(sys.argv)>1 else 'economat-pro/index.html')
def ok(c,msg): print(('PASS ' if c else 'FAIL ')+msg)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1300,'height':900}); pg=ctx.new_page(); pg.add_init_script(NOGATE); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('dialog',lambda d: d.accept())
    pg.goto(F); pg.wait_for_timeout(800)
    # reset complet
    pg.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})")
    pg.reload(); pg.wait_for_timeout(900)
    ok(pg.evaluate("LS.backend")=='idb','IndexedDB actif')
    # Fournisseur via UI
    pg.evaluate("goPage('fournisseurs')"); pg.click('#tb-act .tbtn'); pg.fill('#sup-n','Moulins Bourgeois'); pg.fill('#sup-c','Paul'); pg.fill('#sup-t','0102030405'); pg.click('#m-sup .btn-gold')
    pg.wait_for_timeout(200)
    ok(pg.evaluate("suppliers.length")==1,'fournisseur créé')
    # Ingrédient via UI avec allergènes suggérés
    pg.evaluate("goPage('catalogue')"); pg.click('#tb-act .tbtn')
    pg.fill('#cat-n','Farine de seigle T130'); pg.dispatch_event('#cat-n','input'); pg.wait_for_timeout(100)
    ok('Gluten' in pg.inner_text('#cat-alg .alg-t.on'),'suggestion gluten en direct')
    pg.fill('#cat-p','1.2'); pg.select_option('#cat-sup',pg.evaluate("suppliers[0].id")); pg.fill('#cat-ref','SEI130')
    pg.click('#m-addcat .btn-gold'); pg.wait_for_timeout(200)
    ing=pg.evaluate("ingredients.find(i=>i.name==='Farine de seigle T130')")
    ok(ing and ing['supplierId'] and ing['allergens']==['gluten'] and ing['allergensSet'] and not ing['allergensAuto'] and ing['ref']=='SEI130' and len(ing['priceHistory'])==1,'ingrédient: fournisseur/allergènes/réf/historique')
    # modification du prix -> historique + tendance
    pg.evaluate("openEditIng(ingredients.find(i=>i.name==='Farine de seigle T130').id)"); pg.wait_for_timeout(100)
    ok(pg.evaluate("document.getElementById('edit-cat-sup').value")==ing['supplierId'],'fournisseur prérempli')
    pg.fill('#edit-cat-p','1.32'); pg.click('#m-editcat .btn-gold'); pg.wait_for_timeout(150)
    ing=pg.evaluate("ingredients.find(i=>i.name==='Farine de seigle T130')")
    ok(len(ing['priceHistory'])==1 and ing['priceHistory'][0]['p']==1.32,'même jour : historique remplacé (pas de doublon)')
    pg.evaluate("(()=>{var i=ingredients.find(i=>i.name==='Farine de seigle T130'); i.priceHistory[0].d='2026-09-01'; persist();})()")
    pg.evaluate("openEditIng(ingredients.find(i=>i.name==='Farine de seigle T130').id)"); pg.fill('#edit-cat-p','1.452'); pg.click('#m-editcat .btn-gold'); pg.wait_for_timeout(150)
    t=pg.evaluate("priceTrend(ingredients.find(i=>i.name==='Farine de seigle T130'))")
    ok(t and abs(t-0.1)<1e-6,'tendance +10 %% (%s)'%t)
    pg.fill('#cat-srch','seigle T130'); pg.wait_for_timeout(300)
    ok('+10 %' in pg.inner_text('#cat-list'),'tendance affichée dans le catalogue')
    pg.evaluate("openEditIng(ingredients.find(i=>i.name==='Farine de seigle T130').id)"); pg.wait_for_timeout(100)
    pg.locator('#m-editcat .modal').screenshot(path=OUT+'d_editing.png'); pg.evaluate("closeMod('m-editcat')")
    # recette avec sous-recette
    pg.evaluate("""()=>{
      var f=ingredients.find(i=>i.name==='Farine de seigle T130');
      var beurre=ingredients.find(i=>/Beurre/.test(i.name)), sel=ingredients.find(i=>/Sel/.test(i.name)), eau=ingredients.find(i=>/Eau/.test(i.name));
      recipes.unshift({id:'lev',name:'Levain de seigle',cat:'Boulangerie',image:'⊛',notes:'Rafraîchir la veille.\\nPointage 12 h à 20 °C.',items:[{id:'a',type:'ingredient',refId:f.id,qty:500,unit:'g'},{id:'b',type:'ingredient',refId:eau.id,qty:500,unit:'g'}],createdAt:now()});
      recipes.unshift({id:'tourte',name:'Tourte de seigle',cat:'Boulangerie',image:'',notes:'Pétrissage 5 min en 1re.\\nFaçonnage en boule, cuisson 45 min à 240 °C.',items:[{id:'c',type:'ingredient',refId:f.id,qty:1,unit:'kg'},{id:'d',type:'ingredient',refId:eau.id,qty:800,unit:'g'},{id:'e',type:'ingredient',refId:sel.id,qty:20,unit:'g'},{id:'g',type:'ingredient',refId:beurre.id,qty:50,unit:'g'},{id:'h',type:'recipe',refId:'lev',qty:0.4,unit:'x'}],createdAt:now(),updatedAt:now()});
      persist(); }""")
    a=pg.evaluate("recAllergens('tourte')")
    ok(a['keys']==['gluten','lait'],'allergènes déduits sur recette %s'%a)
    pg.evaluate("goPage('recettes')"); pg.wait_for_timeout(200)
    pg.screenshot(path=OUT+'d_recettes2.png')
    pg.evaluate("ficheFromCard('tourte')"); pg.wait_for_timeout(300)
    fh=pg.inner_text('#fiche-body')
    ok('levain de seigle' in fh.lower() and 'Procédé' in fh and 'Gluten, Lait' in fh,'fiche technique : sections/procédé/allergènes')
    pg.locator('#m-fiche .modal').screenshot(path=OUT+'d_fiche_preview.png')
    pg.evaluate(FAKE); pg.evaluate("document.fonts.ready")
    pg.evaluate("ficheDoPDF(FICHE_CUR)"); pg.wait_for_timeout(300); pg.evaluate("ficheDoPDF(FICHE_CUR)")
    pages=pg.evaluate("window.__pdfPages||[]")
    for k,d in enumerate(pages): open(OUT+'fiche-p%d.png'%(k+1),'wb').write(base64.b64decode(d.split(',')[1]))
    ok(len(pages)>=1,'fiche PDF %d page(s)'%len(pages))
    pg.evaluate("closeMod('m-fiche')")
    # bon : recette + regroupement fournisseur
    pg.evaluate("quickAddRec('tourte')"); pg.wait_for_timeout(200)
    ok(pg.evaluate("document.getElementById('m-rec').classList.contains('show')&&selRec&&selRec.id==='tourte'"),'« + Bon » ouvre le choix du poids')
    pg.click('#m-rec .m-foot .btn-gold'); pg.wait_for_timeout(200)
    pg.click('#e-group button[data-g=sup]'); pg.wait_for_timeout(150)
    ok('MOULINS BOURGEOIS' in pg.inner_text('#pd-body').upper() and 'SANS FOURNISSEUR' in pg.inner_text('#pd-body').upper(),'aperçu groupé par fournisseur')
    pg.evaluate("window.__pdfPages=null; printBonBySupplier()"); pg.wait_for_timeout(300)
    pages=pg.evaluate("window.__pdfPages||[]")
    for k,d in enumerate(pages): open(OUT+'bonsup-p%d.png'%(k+1),'wb').write(base64.b64decode(d.split(',')[1]))
    ok(len(pages)==2,'bon par fournisseur : une page par fournisseur (%d)'%len(pages))
    pg.evaluate("saveBon()")
    ok(pg.evaluate("orders[0].groupBy")=='sup','regroupement mémorisé')
    pg.evaluate("window.__pdfPages=null; printBon()"); pg.wait_for_timeout(300)
    ok(len(pg.evaluate("window.__pdfPages||[]"))>=1,'bon PDF classique OK')
    # accueil
    pg.evaluate("goPage('home')"); pg.wait_for_timeout(200)
    h=pg.inner_text('#p-home')
    ok('Reprendre' in h and 'semaine' in h.lower(),'accueil : bon en cours')
    wk=pg.inner_text('#h-week'); ok(pg.evaluate("fEur(orderCost(orders[0]))") in wk,'coût de la semaine = bon du jour')
    ok('Aucune sauvegarde' in h,'rappel de sauvegarde affiché')
    # profil
    pg.evaluate("goPage('backup')"); pg.fill('#pf-name','Emmanuel'); pg.evaluate("saveProfileUI()"); pg.evaluate("goPage('home')")
    ok('Bonjour Emmanuel' in pg.inner_text('#h-hi'),'prénom sur l’accueil')
    # sauvegarde
    with pg.expect_download() as dl: pg.evaluate("exportBackup()")
    path=dl.value.path(); import json; d=json.load(open(path))
    ok(len(d.get('suppliers',[]))==1 and d['profile'].get('name')=='Emmanuel','sauvegarde contient fournisseurs + profil')
    ok(pg.evaluate("backupDue()")==False and 'Aucune sauvegarde' not in pg.inner_text('#p-home'),'rappel disparu après sauvegarde')
    pg.screenshot(path=OUT+'d_home2.png')
    # persistance IndexedDB après rechargement, localStorage vidé
    pg.evaluate("LS.flush()"); pg.wait_for_timeout(300)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(900)
    ok(pg.evaluate("suppliers.length")==1 and pg.evaluate("recipes.some(r=>r.id==='tourte')"),'données relues depuis IndexedDB')
    # gros volume : photo de 6 Mo (dépasse localStorage)
    pg.evaluate("(()=>{var big='data:image/png;base64,'+'A'.repeat(6*1024*1024); recipes[0].image=big; persist();})()"); pg.wait_for_timeout(200)
    pg.evaluate("LS.flush()"); pg.wait_for_timeout(500); pg.reload(); pg.wait_for_timeout(1500)
    ok(pg.evaluate("recipes[0].image.length")>6*1024*1024,'6 Mo stockés et relus (au-delà de la limite localStorage)')
    # migration localStorage -> IndexedDB
    pg.evaluate("()=>new Promise(r=>{var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})")
    pg.evaluate("localStorage.clear(); localStorage.setItem('v4_ing',JSON.stringify([{id:'x',name:'Farine',cat:'Farines',unit:'kg',price:1}]));localStorage.setItem('v4_rec',JSON.stringify([{id:'old',name:'Ancienne recette',cat:'Boulangerie',items:[]}]))")
    pg.reload(); pg.wait_for_timeout(900)
    ok(pg.evaluate("recipes.length===1&&recipes[0].name==='Ancienne recette'"),'reprise des anciennes données localStorage')
    pg.evaluate("LS.flush()"); pg.wait_for_timeout(300)
    n=pg.evaluate("()=>new Promise(r=>{var q=indexedDB.open('economat-pro');q.onsuccess=()=>{var g=q.result.transaction('kv').objectStore('kv').get('v4_rec');g.onsuccess=()=>{r(g.result)}}})")
    ok(n and 'Ancienne recette' in n,'copiées dans IndexedDB')
    print('errors',errs)
    b.close()
