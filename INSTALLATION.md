# Installer Économat Pro (ordinateur, iPhone, Android)

Économat Pro est désormais **une seule application** qui s'adapte à l'écran :
barre latérale sur ordinateur, barre d'onglets en bas sur téléphone. Le même
dossier sert pour tous vos appareils.

Le dossier à utiliser est **`economat-pro`**. Les anciens dossiers
(`economat-pwa`, `pwa-pc`, `pwa-iphone`) contiennent la même version, pour que
les installations existantes se mettent à jour sans rien perdre.

---

## 1. Mettre le dossier en ligne (gratuit, 5 minutes)

**Netlify** (le plus simple) : ouvrir https://app.netlify.com/drop et glisser
tout le dossier `economat-pro` sur la page. Netlify donne une adresse du type
`https://nom-aleatoire.netlify.app`. Créez un compte gratuit pour garder
l'adresse dans le temps.

**GitHub Pages** : déposer le contenu du dossier dans un dépôt, puis
Paramètres → Pages → branche principale, dossier racine.

> Si vous aviez déjà mis en ligne un ancien dossier, remplacez simplement son
> contenu par celui de `economat-pro` **à la même adresse** : vos données
> restent attachées à l'adresse du site.

## 2. Installer

- **iPhone / iPad** : ouvrir l'adresse dans **Safari** → bouton Partager →
  « Sur l'écran d'accueil » → Ajouter.
- **Android** : ouvrir l'adresse dans Chrome → menu ⋮ → « Installer l'application ».
- **Ordinateur (Chrome / Edge)** : icône d'installation à droite de la barre
  d'adresse → Installer.

L'application s'ouvre ensuite en plein écran et fonctionne **hors connexion**
une fois ouverte au moins une fois en ligne. Les modules PDF, lecture de PDF et
OCR sont gardés en cache après leur première utilisation.

---

## Vos données

- Elles restent **sur l'appareil**, dans la base IndexedDB du navigateur : plus
  de limite de 5 Mo, les photos de recettes ne posent plus problème.
- Au premier lancement, les données de l'ancienne version (localStorage) sont
  **reprises automatiquement**.
- L'application demande au navigateur de protéger ce stockage. La page
  *Réglages & sauvegarde* indique s'il est protégé et l'espace utilisé.
- **Sauvegarde** : un rappel apparaît sur l'accueil si la dernière sauvegarde a
  plus de 7 jours. Le fichier `.json` contient recettes, catalogue, bons,
  fournisseurs, catégories et profil : rangez-le hors de l'appareil (mail, drive).

## Espace en ligne et recettes partagées

Pour retrouver vos données sur tous vos appareils et partager des recettes
(chacun gardant son espace perso), voir **`PARTAGE.md`**.

## Passer d'un appareil à l'autre

Chaque appareil a ses propres données. Pour transférer : *Réglages &
sauvegarde* → Enregistrer une sauvegarde sur l'appareil A, puis *Restaurer →
Tout remplacer* (ou *Ajouter à mes données*) sur l'appareil B.

## Dépannage

| Problème | Solution |
|---|---|
| Pas d'option « Sur l'écran d'accueil » sur iPhone | Ouvrir le lien dans Safari, pas dans Chrome |
| Ne s'ouvre pas hors connexion | L'ouvrir une fois avec du réseau |
| Le PDF ne se génère pas hors connexion | Générer un PDF une première fois avec du réseau (le module est ensuite gardé) |
| Ancienne icône | Supprimer l'icône de l'écran d'accueil et réinstaller |
