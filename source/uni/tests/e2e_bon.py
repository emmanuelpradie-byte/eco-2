import sys, json, base64
from playwright.sync_api import sync_playwright
FILE=sys.argv[1]
FAKE=open('/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/bon/fakejspdf.js').read()
OUT='/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/uni/shots/'
SEED=r"""
() => {
  function ing(id,name,cat,price,extra){ return Object.assign({id:id,name:name,cat:cat,unit:'kg',price:price,buyPrice:price,priceHistory:[]},extra||{}); }
  LS.setItem('v4_ingcats', JSON.stringify(['Farines','Épicerie','Crèmerie et œufs','Charcuterie et poisson','Fruits et légumes']));
  ingredients.length=0;
  [ing('f1','Farine de tradition T65','Farines',0.89), ing('f2','Farine blanche T65','Farines',0.82), ing('f3','Farine de gruau T45','Farines',1.07),
   ing('e1','Sel','Épicerie',0.67), ing('e2','Levure','Épicerie',3.75), ing('e3','Sucre','Épicerie',0.81), ing('e4','Poivre','Épicerie',0),
   ing('c1','Beurre','Crèmerie et œufs',8.10), ing('c2','Lait','Crèmerie et œufs',1.10), ing('c3','Œufs entiers','Crèmerie et œufs',2.98),
   ing('c4','Fromage frais (type Philadelphia)','Crèmerie et œufs',7.91),
   ing('v1','Citron','Fruits et légumes',6.4,{unit:'pièce',unitWeight:0.05,buyPrice:0.32})].forEach(function(i){ ingredients.push(i); });
  recipes.length=0;
  recipes.push({id:'r1',name:'Rafraîchi',cat:'Boulangerie',items:[{id:'a',type:'ingredient',refId:'f1',qty:1.5,unit:'kg'}]});
  recipes.push({id:'r2',name:'Tradition',cat:'Boulangerie',items:[{id:'b',type:'ingredient',refId:'f1',qty:3.5,unit:'kg'},{id:'c',type:'ingredient',refId:'e1',qty:70,unit:'g'},{id:'d',type:'ingredient',refId:'e2',qty:20,unit:'g'},{id:'d2',type:'recipe',refId:'r1',qty:1,unit:'x'}]});
  recipes.push({id:'r3',name:'Viennois',cat:'Viennoiserie',items:[{id:'e',type:'ingredient',refId:'f2',qty:4.6,unit:'kg'},{id:'f',type:'ingredient',refId:'e3',qty:552,unit:'g'},{id:'g',type:'ingredient',refId:'c1',qty:920,unit:'g'},{id:'h',type:'ingredient',refId:'c2',qty:920,unit:'g'},{id:'i',type:'ingredient',refId:'c3',qty:920,unit:'g'},{id:'j',type:'ingredient',refId:'e1',qty:90,unit:'g'},{id:'k',type:'ingredient',refId:'e2',qty:120,unit:'g'}]});
  recipes.push({id:'r4',name:'Béchamel',cat:'Traiteur',items:[{id:'l',type:'ingredient',refId:'f1',qty:145,unit:'g'},{id:'m',type:'ingredient',refId:'c1',qty:145,unit:'g'},{id:'n',type:'ingredient',refId:'c2',qty:2170,unit:'g'},{id:'o',type:'ingredient',refId:'e4',qty:0,unit:'g'},{id:'o2',type:'ingredient',refId:'e1',qty:0,unit:'g'}]});
  recipes.push({id:'r5',name:'Appareil fromage frais',cat:'Traiteur',items:[{id:'p',type:'ingredient',refId:'c4',qty:750,unit:'g'},{id:'q',type:'ingredient',refId:'v1',qty:1,unit:'pièce'}]});
  var many=[];
  ['Saucisse de Morteau','Saucisse de Francfort','Jambon','Chorizo en dés','Saumon fumé','Lardons','Bacon','Poulet','Thon','Pastrami','Coppa','Bresaola','Rillettes','Magret fumé','Truite fumée','Anchois','Crevettes','Speck'].forEach(function(n,k){
    ingredients.push(ing('ch'+k,n,'Charcuterie et poisson',9+k)); many.push({id:'m'+k,type:'ingredient',refId:'ch'+k,qty:200+k*50,unit:'g'}); });
  recipes.push({id:'r6',name:'Garnitures snacking',cat:'Traiteur',items:many});
  openNewBon();
  document.getElementById('e-name').value='Réception Cayenne de Lausanne';
  document.getElementById('e-notes').value='Quantités pour une production complète des fiches, snacking calculé sur 15 pièces par garniture.';
  ['r2','r3','r4','r5','r6'].forEach(function(id){ addRecToOrder(id,curBon,1); });
  renderItems(); livePreview();
  return curBon.items.map(function(i){ var g=ingredients.find(function(x){return x.id===i.ingId;}); return g.name+' '+i.qty+' uses='+JSON.stringify(i.uses); });
}
"""
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport=({'width':390,'height':844} if 'mobile' in FILE or 'iphone' in FILE else {'width':1400,'height':1100})); errs=[]
    page.on('pageerror',lambda e: errs.append(str(e)))
    page.goto('file:///mnt/user-data/outputs/'+FILE); page.wait_for_timeout(400)
    page.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})"); page.reload(); page.wait_for_timeout(600)
    items=page.evaluate(SEED)
    for i in items: print('  ',i)
    page.wait_for_timeout(300)
    page.evaluate("typeof togglePrev==='function' && getComputedStyle(document.getElementById('pd-body')).display!=='none' && !document.getElementById('pd-body').offsetParent && togglePrev()"); page.wait_for_timeout(300)
    el=page.query_selector('#pd-body')
    try: el.screenshot(path=OUT+'preview_'+FILE.replace('/','_')+'.png', timeout=3000)
    except Exception as e: print('preview not visible on this layout')
    # many items to force a 2nd page
    page.evaluate(FAKE)
    page.evaluate("document.fonts.ready")
    page.evaluate("() => { doPDF(buildData()); }")
    page.wait_for_timeout(300)
    page.evaluate("() => { doPDF(buildData()); }")   # second pass: images decoded
    pages=page.evaluate("window.__pdfPages||[]")
    for k,d in enumerate(pages):
        open(OUT+FILE.replace('/','_')+'-pdf-p%d.png'%(k+1),'wb').write(base64.b64decode(d.split(',')[1]))
    print('pdf pages:',len(pages),'imgWarn:',page.evaluate('window.__imgWarn||0'))
    # CSV
    print('errors:',errs); b.close()
