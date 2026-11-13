# Espace en ligne et recettes partagées

Avec un compte, chaque personne a **son espace perso** : ses recettes, son
catalogue, ses fournisseurs et ses bons, retrouvés sur tous ses appareils.
Personne d'autre ne les voit.

En plus, un espace **Partage** (dans la barre de navigation) :

- **Dossiers partagés** : onglet « Les miens » → **Nouveau dossier partagé**
  (ex. « Stage traiteur »), puis coche toutes les recettes que tu veux.
  **Partager une catégorie** partage d'un coup toutes les recettes d'une
  catégorie. « + Recettes » sur un dossier permet d'en ajouter ou d'en retirer ;
  le crayon le renomme ; la croix arrête le partage du dossier ;
- **une recette seule** : ouvre-la, coche **« Partager cette recette »** et
  choisis éventuellement un dossier ;
- tout ce que tu partages est visible par tous les comptes, avec ton prénom ;
  **toi seul peux le modifier** : la version partagée se met à jour
  automatiquement quand tu modifies ta recette (ou un prix de ton catalogue) ;
- onglet « Des autres » : **un dossier par compte qui partage** (au nom de la
  personne). On l'ouvre pour voir ses dossiers (ex. « Stage traiteur ») et ses
  recettes seules. Les autres peuvent consulter (composition, procédé,
  allergènes, documents) et **copier une recette ou tout un dossier** dans leur
  espace (un dossier copié devient une catégorie du même nom). Leur copie leur
  appartient : elle ne change plus quand tu modifies l'original ;
- **bons d'économat** : « Partager un bon » (ou coche-les dans un dossier).
  Les autres voient les articles, quantités et coûts, et peuvent **copier le
  bon** dans leurs bons (les ingrédients manquants sont ajoutés à leur
  catalogue) ;
- **PDF et images** : « Partager un PDF » (ou « Ajouter un PDF » dans un
  dossier). Les autres peuvent l'ouvrir et le télécharger ;
- **mot de passe sur un dossier** : bouton cadenas sur le dossier (onglet
  « Les miens »). Les autres voient le dossier avec un cadenas, mais son
  contenu (recettes, bons, documents) leur reste invisible — le serveur le
  refuse — tant qu'ils n'ont pas saisi le mot de passe. Une seule saisie
  suffit, sur tous leurs appareils. Changer le mot de passe oblige à le
  ressaisir ; l'administrateur voit tout ;
- arrêter un partage le retire pour tout le monde (les copies déjà faites
  restent chez leurs propriétaires).

## Documents joints (PDF, images)

Dans chaque recette, la carte **Documents** permet de joindre des PDF et des
images (fiche d'origine, photo du produit fini, schéma de façonnage…), 15 Mo
maximum par fichier. Les grandes photos sont réduites automatiquement.

- Les documents fonctionnent aussi **sans compte** (gardés sur l'appareil).
- Avec un compte, ils sont envoyés en ligne et retrouvés sur vos autres
  appareils.
- Les documents d'une recette partagée sont consultables par tous ; ils
  redeviennent privés si vous ne la partagez plus.
- La sauvegarde `.json` contient aussi les documents.

L'appli continue de marcher **sans connexion** : les modifications sont gardées
sur l'appareil et envoyées au retour du réseau.

---

## Écran de connexion

L'appli s'ouvre sur un écran de connexion : il faut **se connecter ou créer un
compte** avant d'y accéder. Un compte en attente de validation voit un écran
d'attente, qui s'ouvre tout seul dès que l'administrateur l'a validé.

Pour que chacun arrive directement sur cet écran, sans lien ni réglage :
Administration → **Télécharger l'appli préconfigurée (index.html)**, puis
remplacer le fichier `index.html` de ton site GitHub par celui-ci (l'adresse
du serveur et la clé publique y sont intégrées ; la clé publique n'est pas
secrète). Sinon, chacun passe par ton lien d'invitation.

## Mise en place (une seule fois, par vous, ~10 minutes)

Les données sont hébergées chez **Supabase**, gratuit à cette échelle.

### 1. Créer le projet
1. Aller sur https://supabase.com → **Start your project** → créer un compte.
2. **New project** : un nom (ex. `economat`), un mot de passe de base de
   données (à garder, il ne sert pas dans l'appli), région **Europe (Paris ou
   Francfort)** → **Create new project**. Attendre 1 à 2 minutes.

### 2. Installer la base
1. Menu de gauche → **SQL Editor** → **New query**.
2. Ouvrir le fichier **`supabase-setup.sql`** (fourni avec l'appli), tout
   copier, coller → **Run**. Le message « Success » doit apparaître.

### 3. Simplifier la connexion
**Authentication** → **Sign In / Providers** → **Email** : décocher
**Confirm email** → **Save**.
*(Sinon chaque personne doit cliquer un lien reçu par email avant sa première
connexion, et Supabase limite le nombre d'emails envoyés par heure.)*

### 3 bis. Adresse de l'appli (liens reçus par email)
**Authentication** → **URL Configuration** :
- **Site URL** : l'adresse de ton site, par ex. `https://ton-nom.github.io/economat/`
- **Redirect URLs** → **Add URL** : la même adresse → **Save**.

Ainsi, le lien « Mot de passe oublié » (et les confirmations d'email) ouvre
directement l'appli sur l'écran « Choisis un nouveau mot de passe », au lieu
d'une page d'erreur (`localhost:3000`).

### 4. Relever l'adresse et la clé
**Project Settings** → **API Keys** (ou le bouton **Connect** en haut) :
- l'**adresse du projet** : `https://xxxxxxxx.supabase.co`
- la **clé publique** : *Publishable key* (`sb_publishable_…`) ou, sur les
  anciens projets, la clé *anon* (`eyJ…`).

⚠️ Ne jamais utiliser la clé **secret** / *service_role* dans l'appli.

### 5. Se connecter dans l'appli
Faites d'abord une sauvegarde (Réglages → Enregistrer une sauvegarde), par
précaution. Puis **Réglages → Espace en ligne → Configurer le serveur** →
coller l'adresse et la clé → **Enregistrer** → **Créer mon compte**.
Votre espace en ligne étant vide, les données de l'appareil y sont envoyées.

## Se déconnecter
Bouton de sortie à côté de ton nom, en bas du menu de gauche ; ou Réglages →
Espace en ligne → Mon compte → **Se déconnecter**. Tes données sont rangées :
la personne suivante sur l'appareil ne les voit pas.

## Mot de passe oublié
Sur l'écran de connexion : entre ton email puis **Mot de passe oublié ?**. Le
lien reçu ouvre l'appli pour choisir un nouveau mot de passe (voir l'étape
3 bis de la mise en place). Un lien ne sert qu'une fois et expire au bout
d'une heure.

## Mon compte (nom, email, mot de passe)

Réglages → Espace en ligne → **Mon compte** : chacun peut modifier son nom
(il se met à jour sur ses recettes déjà partagées), son email et son mot de
passe. Le mot de passe actuel est demandé pour changer l'email ou le mot de
passe. Si le serveur est réglé pour confirmer les changements d'adresse
(réglage par défaut de Supabase), un email est envoyé : il faut cliquer sur
son lien ; jusque-là on se connecte avec l'ancienne adresse.

## Administration

Le **premier compte créé** sur le serveur est administrateur (sur un serveur
déjà en place : le plus ancien compte). Il a une page **Administration** (menu
de gauche, ou Réglages → Espace en ligne → Ouvrir l'administration) :

- **Inscriptions** : « Valider chaque nouveau compte » (activé par défaut).
  Un compte créé sans le lien de l'administrateur reste **en attente** : il
  utilise l'appli sur son appareil, mais n'a accès ni à l'espace en ligne ni
  aux partages tant qu'il n'est pas validé. Les comptes créés avec **le lien
  d'invitation de l'administrateur** (valable 30 jours) sont validés d'office.
  « Annuler les anciens liens » rend les liens déjà envoyés inutilisables.
- **À valider** : Valider ou Refuser chaque inscription.
- **Comptes**, **Comptes supprimés** et **Partages** sont des sections
  **repliables** (fermées par défaut : un clic sur le titre les ouvre, le
  nombre reste visible). Une recherche les ouvre toute seule.
  - Comptes : Bloquer / Débloquer (le compte garde ses données mais n'a plus
    accès à rien), Nommer admin, Supprimer (son espace en ligne est effacé et
    ses partages retirés ; ce qui est sur ses appareils n'est pas touché).
  - Comptes supprimés : **Rétablir** remet le compte en service. La personne se
    reconnecte avec son ancien email et son ancien mot de passe ; ses
    recettes, son catalogue et ses bons reviennent depuis ses appareils, et ses
    recettes partagées sont de nouveau partagées.
  - Partages : retirer n'importe quelle recette ou tout un dossier partagé.
    L'auteur est prévenu ; sa recette reste dans son espace.

Mise à jour d'un serveur existant : relancer `supabase-setup.sql` en entier
dans le SQL Editor (rien n'est effacé).

## Inviter quelqu'un
Réglages → Espace en ligne → **Envoyer le lien** (SMS, WhatsApp, mail…). La
personne ouvre le lien (sur le site de l'appli), crée son compte, et a son
propre espace avec ses propres données. Le lien contient seulement l'adresse
du serveur : il ne donne accès à aucune donnée.

## Nouvel appareil
Ouvrir l'appli → Réglages → Espace en ligne → « J'ai reçu une invitation »
(coller le lien) → **Se connecter**. Si l'appareil contient déjà des données,
l'appli propose :
- **Charger mon espace en ligne** : l'appareil prend vos données en ligne
  (une copie de sécurité de l'appareil est gardée dans Réglages → Copies
  automatiques) ;
- **Tout fusionner** : garde les deux.

## Bon à savoir
- **Même recette modifiée sur deux appareils** : c'est la dernière enregistrée
  qui est gardée.
- **Grosse suppression d'un coup** (par exemple la restauration d'une vieille
  sauvegarde en « Tout remplacer ») : l'appli demande confirmation avant de
  l'appliquer à votre espace en ligne.
- **Projet gratuit en pause** : Supabase met en pause un projet gratuit sans
  activité pendant 7 jours. L'appli affiche alors « Pas de connexion au
  serveur ». Se connecter sur supabase.com → ouvrir le projet → **Resume
  project** : rien n'est perdu.
- **Plusieurs comptes sur le même appareil** : à la déconnexion, tes
  recettes, ton catalogue et tes bons sont mis de côté et l'appli se vide.
  La personne qui se connecte ensuite ne voit que son propre espace. Tu
  retrouves le tien en te reconnectant (les modifications pas encore envoyées
  partent à ce moment-là). Si l'appareil contient des recettes liées à aucun
  compte, l'appli demande à la connexion : « Sont-elles à toi ? ».

## Dépannage

| Message | Solution |
|---|---|
| Serveur injoignable | Vérifier l'adresse (`https://….supabase.co`) et la connexion |
| Clé du serveur incorrecte | Recopier la clé *Publishable* (ou *anon*) |
| Email ou mot de passe incorrect | « Mot de passe oublié ? » envoie un email de réinitialisation |
| Confirme ton adresse… | L'étape 3 n'est pas faite : cliquer le lien reçu par mail, ou décocher *Confirm email* |
| Document trop gros | 15 Mo maximum par fichier |
