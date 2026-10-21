from playwright.sync_api import sync_playwright
import json

def mk_line(name, qty=1, unit='kg'):
    return {"id":"l_"+name,"sel":True,"name":name,"originalName":name,"corrected":False,
            "fixSource":"","qty":qty,"unit":unit,"unitDetected":True,"unitInferred":False,
            "unitGuessedKg":False,"confidence":90,"matchId":"","matchScore":0,"candidates":[],
            "subName":"","useRecipeId":"","newCat":"Autre","newPrice":0,"newUnit":"kg",
            "newUnitWeight":0,"newSupplier":""}

def mk_draft(name, ing):
    return {"name":name,"cat":"Boulangerie","emoji":"📖","lines":[mk_line(ing)],
            "subs":[],"process":[],"blocks":[],
            "src":{"thumb":None,"fileName":"multi.pdf","ts":0},"raw":"",
            "queueDone": False}

queue = [mk_draft("Brioche","Farine"), mk_draft("Croissant","Beurre"), mk_draft("Pain","Farine")]

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.goto("file:///mnt/user-data/outputs/economat-pro/index.html")
    page.wait_for_timeout(300)
    page.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})")
    page.reload()
    page.wait_for_timeout(400)

    page.evaluate("(d) => (LS.setItem('v4_ridraft', JSON.stringify(d)), LS.flush())", {"queue": queue, "idx": 0})
    page.evaluate("RIMP.resumeDraft();")
    page.wait_for_timeout(150)

    nav = page.evaluate("document.getElementById('ri-queuenav').innerHTML")
    print("queue nav shows 1/3:", '1 / 3' in nav)
    print("queue nav shows all 3 names:", 'Brioche' in nav and 'Croissant' in nav and 'Pain' in nav)

    name_field = page.evaluate("document.getElementById('ri-name').value")
    print("current recipe field shows Brioche:", name_field)

    # Test Next/Prev navigation without saving
    page.evaluate("RIMP.queueNext();")
    page.wait_for_timeout(80)
    print("after queueNext, field shows:", page.evaluate("document.getElementById('ri-name').value"))
    page.evaluate("RIMP.queuePrev();")
    page.wait_for_timeout(80)
    print("after queuePrev, field shows:", page.evaluate("document.getElementById('ri-name').value"))

    # Save first recipe (Brioche) via real save button -> should auto-advance to Croissant
    page.evaluate("document.getElementById('ri-save').click();")
    page.wait_for_timeout(100)
    state1 = page.evaluate("""
    () => ({
      curName: document.getElementById('ri-name').value,
      recipesCount: recipes.filter(r=>r.name==='Brioche').length,
      page: CUR,
      navHtml: document.getElementById('ri-queuenav').innerHTML
    })
    """)
    print("after saving Brioche -> now showing:", state1['curName'], "| saved count:", state1['recipesCount'], "| page:", state1['page'])
    print("nav shows 2/3 and 1 done:", '2 / 3' in state1['navHtml'], '1 enregistrée' in state1['navHtml'])

    # Save second (Croissant) -> advance to Pain
    page.evaluate("document.getElementById('ri-save').click();")
    page.wait_for_timeout(100)
    state2 = page.evaluate("""
    () => ({ curName: document.getElementById('ri-name').value, page: CUR })
    """)
    print("after saving Croissant -> now showing:", state2['curName'], "page:", state2['page'])

    # Save third (Pain) -> should finish and go back to recettes
    page.evaluate("document.getElementById('ri-save').click();")
    page.wait_for_timeout(100)
    state3 = page.evaluate("""
    () => ({
      page: CUR,
      totalSaved: recipes.filter(r=>['Brioche','Croissant','Pain'].includes(r.name)).length
    })
    """)
    print("after saving Pain (last) -> page:", state3['page'], "total saved:", state3['totalSaved'])

    localstorage_after = page.evaluate("LS.getItem('v4_ridraft')")
    print("localStorage cleared after full queue done:", localstorage_after)

    print("errors:", errors)
    browser.close()
