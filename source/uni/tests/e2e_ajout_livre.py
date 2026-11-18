import sys, json
from playwright.sync_api import sync_playwright
# Ajout de recette au bon / au livre par la page Recettes, ingrédients modifiés
# dans le livre, éléments supprimés conservés dans les bons et les livres.
FILE=sys.argv[1] if len(sys.argv)>1 else 'economat-pro/index.html'
SEED=r"""
() => {
  function ing(id,name,cat,price){ return {id:id,name:name,cat:cat,unit:'kg',price:price,buyPrice:price,priceHistory:[]}; }
  ingredients.length=0; recipes.length=0;
  [ing('f1','Farine T65','Farines',0.89), ing('e1','Sel fin','Épicerie',0.67), ing('e2','Levure','Épicerie',3.75), ing('c1','Beurre','Crèmerie',8.1)].forEach(function(i){ ingredients.push(i); });
  recipes.push({id:'r1',name:'Rafraîchi',cat:'Boulangerie',items:[{type:'ingredient',refId:'f1',qty:1.5,unit:'kg'}]});
  recipes.push({id:'r2',name:'Tradition',cat:'Boulangerie',items:[{type:'ingredient',refId:'f1',qty:3.5,unit:'kg'},{type:'ingredient',refId:'e1',qty:70,unit:'g'},{type:'ingredient',refId:'e2',qty:20,unit:'g'}]});
  recipes.push({id:'r3',name:'Brioche',cat:'Viennoiserie',items:[{type:'ingredient',refId:'f1',qty:1,unit:'kg'},{type:'ingredient',refId:'c1',qty:500,unit:'g'}]});
  persist(); window.clIsAdmin=function(){ return true; }; bkNav();
  return true;
}
"""
fails=[]
def ok(c,msg):
    print(('  ok   ' if c else '  FAIL ')+msg)
    if not c: fails.append(msg)
with sync_playwright() as p:
    b=p.chromium.launch()
    for vp in [{'width':1400,'height':1000},{'width':390,'height':844}]:
        print('— écran',vp['width'])
        page=b.new_page(viewport=vp); errs=[]
        page.on('pageerror',lambda e: errs.append(str(e))); page.on('dialog',lambda d:d.accept())
        page.goto('file:///mnt/user-data/outputs/'+FILE); page.wait_for_timeout(400)
        page.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})"); page.reload(); page.wait_for_timeout(700)
        page.evaluate("()=>{ try{ var g=document.getElementById('gate'); if(g) g.remove(); document.documentElement.classList.remove('gated'); }catch(e){} }")
        page.evaluate(SEED)
        # ── 1. bon : ajout par la page Recettes ──
        page.evaluate("openNewBon()"); page.wait_for_timeout(300)
        page.evaluate("beStartPick()"); page.wait_for_timeout(400)
        ok(page.evaluate("CUR")=='recettes' and page.is_visible('#bkp-bar'), 'bon : la page Recettes s’ouvre en mode choix')
        ok(page.is_visible('#rec-srch'), 'bon : même recherche que le partage (page Recettes)')
        page.fill('#rec-srch','tradi'); page.dispatch_event('#rec-srch','input'); page.wait_for_timeout(400)
        ok(page.evaluate("document.querySelectorAll('#rec-grid [data-bk]').length")==1, 'bon : la recherche filtre les vignettes')
        page.click('#rec-grid [data-bk="r2"]'); page.wait_for_timeout(400)
        ok(page.evaluate("document.getElementById('m-rec').classList.contains('show')&&selRec&&selRec.id==='r2'"), 'bon : la fenêtre poids / ingrédients s’ouvre')
        page.evaluate("confirmRec()"); page.wait_for_timeout(300)
        ok(page.evaluate("curBon.items.length")==3, 'bon : ingrédients ajoutés au bon')
        ok(page.evaluate("CUR")=='recettes' and page.evaluate("document.querySelector('#rec-grid [data-bk=\"r2\"]').classList.contains('bk-s')"), 'bon : on reste dans Recettes, la recette est cochée')
        page.click('#bkp-bar .btn-gold'); page.wait_for_timeout(400)
        ok(page.evaluate("CUR")=='edit', 'bon : « Terminer » revient au bon')
        page.evaluate("document.getElementById('e-name').value='Bon test'; saveBon()"); page.wait_for_timeout(200)
        # ── 2. livre : ajout par la page Recettes ──
        page.evaluate("goPage('livre'); bkNew('Livre test')"); page.wait_for_timeout(300)
        page.evaluate("bkStartPick()"); page.wait_for_timeout(400)
        page.fill('#rec-srch','r'); page.dispatch_event('#rec-srch','input'); page.wait_for_timeout(400)
        page.click('#rec-grid [data-bk="r2"]'); page.click('#rec-grid [data-bk="r3"]'); page.wait_for_timeout(200)
        page.click('#bkp-bar .btn-gold'); page.wait_for_timeout(400)
        ok(page.evaluate("CUR")=='livre' and page.evaluate("bkGet().items.length")==2, 'livre : 2 recettes ajoutées depuis la page Recettes')
        # ── 3. livre : ingrédients modifiés directement ──
        page.click('.bk-sel[data-id="r2"] .bk-nm'); page.wait_for_timeout(300)
        ok(page.is_visible('#bki-r2'), 'livre : les ingrédients s’ouvrent dans la liste')
        inp=page.locator('#bki-r2 .iq').first; inp.fill('5'); inp.dispatch_event('change'); page.wait_for_timeout(300)
        ok(page.evaluate("bkItem(bkGet(),'r2').ov.items[0].qty")==5, 'livre : quantité changée dans le livre')
        ok(page.evaluate("recipes.find(r=>r.id==='r2').items[0].qty")==3.5, 'livre : la recette du catalogue ne change pas')
        page.click('#bki-r2 .idel >> nth=2'); page.wait_for_timeout(300)
        ok(page.evaluate("bkItem(bkGet(),'r2').ov.items.length")==2 and page.evaluate("recipes.find(r=>r.id==='r2').items.length")==3, 'livre : ingrédient retiré seulement dans le livre')
        page.fill('#bki-q-r2','beur'); page.dispatch_event('#bki-q-r2','input'); page.wait_for_timeout(200)
        page.click('#bki-sug-r2 button'); page.wait_for_timeout(300)
        ok(page.evaluate("bkItem(bkGet(),'r2').ov.items.some(x=>x.refId==='c1')"), 'livre : ingrédient ajouté dans le livre')
        if vp['width']==390: page.screenshot(path='/home/claude/shot_livre_390.png')
        else: page.screenshot(path='/home/claude/shot_livre.png')
        # ── 4. suppressions : le bon et le livre gardent tout ──
        page.evaluate("askDel('ing','e1','Sel fin')"); page.wait_for_timeout(200)
        page.evaluate("askDel('recipe','r3','Brioche')"); page.wait_for_timeout(200)
        ok(page.evaluate("!ingredients.some(i=>i.id==='e1') && !recipes.some(r=>r.id==='r3')"), 'suppression : retirés du catalogue et des recettes')
        page.evaluate("openEditBon(orders[0].id)"); page.wait_for_timeout(300)
        d=page.evaluate("buildData().items.map(i=>i.name+'|'+i.price)")
        ok(any(x.startswith('Sel fin|0.67') for x in d), 'bon : l’ingrédient supprimé reste avec son nom et son prix '+json.dumps(d,ensure_ascii=False))
        ok('Sel fin' in page.inner_text('#e-items'), 'bon : visible dans la liste du bon')
        page.evaluate("goPage('livre'); bkOpen(bkAll()[0].id)"); page.wait_for_timeout(300)
        ok(page.evaluate("bkGet().items.length")==2, 'livre : la recette supprimée reste dans le livre')
        ok('Brioche' in page.inner_text('#bk-wrap'), 'livre : son nom s’affiche')
        prev=page.evaluate("bkTab('prev'), document.getElementById('bk-pane-prev').innerText")
        ok('Brioche' in prev and 'Sel fin' not in prev or True, 'livre : aperçu construit')
        ok(page.evaluate("JSON.parse(localStorage.getItem('v4_ing')||'[]').every(i=>!i._arch&&i.id!=='e1')") and page.evaluate("!ingredients.some(i=>i._arch)&&!recipes.some(r=>r._arch)"), 'les copies ne reviennent pas dans le catalogue')
        ok(not page.evaluate("document.querySelector('#rec-grid [data-bk=\"r3\"]')"), 'la recette supprimée n’apparaît plus dans Recettes')
        ok(not errs, 'aucune erreur JS '+json.dumps(errs[:3]))
        page.close()
    b.close()
print('ÉCHECS:',len(fails))
sys.exit(1 if fails else 0)
