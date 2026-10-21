from playwright.sync_api import sync_playwright

def mk_line(name, qty=1, unit='kg'):
    return {"id":"l_"+name,"sel":True,"name":name,"originalName":name,"corrected":False,
            "fixSource":"","qty":qty,"unit":unit,"unitDetected":True,"unitInferred":False,
            "unitGuessedKg":False,"confidence":90,"matchId":"","matchScore":0,"candidates":[],
            "subName":"","useRecipeId":"","newCat":"Autre","newPrice":0,"newUnit":"kg",
            "newUnitWeight":0,"newSupplier":""}

single_draft = {"name":"Baguette solo","cat":"Boulangerie","emoji":"📖","lines":[mk_line("Farine")],
                "subs":[],"process":[],"blocks":[],
                "src":{"thumb":None,"fileName":"solo.pdf","ts":0},"raw":""}

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

    page.evaluate("(d) => (LS.setItem('v4_ridraft', JSON.stringify({single:d})), LS.flush())", single_draft)
    page.evaluate("RIMP.resumeDraft();")
    page.wait_for_timeout(150)
    nav = page.evaluate("document.getElementById('ri-queuenav') ? document.getElementById('ri-queuenav').innerHTML : ''")
    print("no queue nav shown for single import:", nav == '')

    page.evaluate("document.getElementById('ri-save').click();")
    page.wait_for_timeout(100)
    state = page.evaluate("""
    () => ({ page: CUR, saved: recipes.some(r=>r.name==='Baguette solo') })
    """)
    print("single recipe saved:", state['saved'], "back on recettes page:", state['page'])
    ls = page.evaluate("LS.getItem('v4_ridraft')")
    print("localStorage cleared:", ls)
    print("errors:", errors)
    browser.close()
