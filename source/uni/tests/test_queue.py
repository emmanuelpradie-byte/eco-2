from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("file:///mnt/user-data/outputs/economat-pro/index.html")
    page.wait_for_timeout(300)
    page.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})")
    page.reload()
    page.wait_for_timeout(400)

    # Simulate runImport's multi-doc branch directly by fabricating "docs"
    r = page.evaluate("""
    () => {
      // build 3 fake parsed recipes and inject them the same way runImport would
      var docs = [
        {name:'Brioche', parsed:{recipeName:'Brioche', main:[{detectedName:'Farine',quantity:1,unit:'kg',unitDetected:true,confidence:90}], subRecipes:[], process:[]}},
        {name:'Croissant', parsed:{recipeName:'Croissant', main:[{detectedName:'Beurre',quantity:0.5,unit:'kg',unitDetected:true,confidence:90}], subRecipes:[], process:[]}},
        {name:'Pain', parsed:{recipeName:'Pain', main:[{detectedName:'Farine',quantity:2,unit:'kg',unitDetected:true,confidence:90}], subRecipes:[], process:[]}}
      ];
      var res = {src:{}, thumb:null, fileName:'multi.pdf', text:''};
      draftQueue = docs.map(function(doc){
        var d = buildDraft(doc.parsed, res, []);
        d.queueDone = false;
        return d;
      });
      draftQueueIdx = 0;
      draft = draftQueue[0];
      goPage('rec-valid');
      document.getElementById('ri-loading').style.display='none';
      document.getElementById('ri-result').style.display='block';
      renderDraft();
      return {names: draftQueue.map(function(d){return d.name;})};
    }
    """)
    print("queue built:", r)

    nav = page.evaluate("document.getElementById('ri-queuenav').innerHTML")
    print("queue nav shows 1/3:", '1 / 3' in nav)
    print("queue nav shows all 3 names:", 'Brioche' in nav and 'Croissant' in nav and 'Pain' in nav)

    # save first recipe (Brioche) via the actual commitRecipe button
    page.evaluate("document.getElementById('ri-save').click();")
    page.wait_for_timeout(100)
    state1 = page.evaluate("""
    () => ({
      curName: draft && draft.name,
      idx: draftQueueIdx,
      recipesCount: recipes.filter(r=>r.name==='Brioche').length,
      page: CUR
    })
    """)
    print("after saving Brioche:", state1)

    # save second (should be Croissant now, auto-advanced)
    page.evaluate("document.getElementById('ri-save').click();")
    page.wait_for_timeout(100)
    state2 = page.evaluate("""
    () => ({
      curName: draft && draft.name,
      idx: draftQueueIdx,
      recipesCount: recipes.filter(r=>r.name==='Croissant').length,
      page: CUR
    })
    """)
    print("after saving Croissant:", state2)

    # save third -> should navigate back to recettes with all done
    page.evaluate("document.getElementById('ri-save').click();")
    page.wait_for_timeout(100)
    state3 = page.evaluate("""
    () => ({
      page: CUR,
      draftQueue: draftQueue,
      totalNamed: recipes.filter(r=>['Brioche','Croissant','Pain'].includes(r.name)).length
    })
    """)
    print("after saving Pain (last):", state3['page'], state3['draftQueue'], "total saved:", state3['totalNamed'])

    print("errors:", errors)
    browser.close()
