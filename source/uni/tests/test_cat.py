from playwright.sync_api import sync_playwright
import json

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

    # seed ingredients across 2 categories sharing sub "Essai"
    res = page.evaluate("""
    () => {
      addSub('ing','Boulangerie','Essai');
      var subId = loadSubs('ing').find(s=>s.name==='Essai' && s.parent==='Boulangerie').id;
      ingredients.push({id:'ix1', name:'Farine TEST UNIQ', cat:'Boulangerie', sub: subId, unit:'kg', price:1, buyPrice:1});
      ingredients.push({id:'ix2', name:'Beurre TEST UNIQ', cat:'Patisserie', sub: subId, unit:'kg', price:2, buyPrice:2});
      ingredients.push({id:'ix3', name:'Sel TEST UNIQ', cat:'Boulangerie', unit:'kg', price:1, buyPrice:1});
      persist();
      renderCat();
      return {subId: subId};
    }
    """)
    print("seed result", res)

    # click the sub chip for Essai
    page.evaluate("""
    () => {
      var chip = Array.from(document.querySelectorAll('#cat-subchips .chip')).find(c=>c.textContent.includes('Essai'));
      if(chip) chip.click();
    }
    """)
    page.wait_for_timeout(200)

    names = page.evaluate("""
    () => Array.from(document.querySelectorAll('#cat-list .cat-n')).map(e=>e.textContent)
    """)
    print("visible names after clicking Essai chip:", names)

    print("errors:", errors)
    browser.close()
