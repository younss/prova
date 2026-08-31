# SPEC — « Répétiteur de flux de valeur » (prototype de validation)

> **Type de document** : Spécification exécutable (Spec-Driven Development)
> **Destinataire** : LLM frontière chargé de générer le prototype en une session
> **Version** : 0.1 — prototype de test d'hypothèses, PAS un produit
> **Langue de l'interface** : Français

---

## 1. Intention (le POURQUOI, non négociable)

Construire un prototype démontrant qu'une organisation peut **répéter un processus métier futur avant de le construire**, comme un pilote répète un vol dans un simulateur.

Le prototype simule un flux de valeur de bout en bout — multi-rôles, avec délais, exceptions, règles de décision et piste d'audit — à partir d'une **définition déclarative du processus** (aucune donnée historique, aucun process mining). Il compresse le temps : un processus qui durerait 3 semaines en réalité se rejoue en ~20 minutes.

**Ce que ce prototype doit prouver (hypothèses testées en atelier avec de vrais gestionnaires) :**

- **H1 — Compréhension** : des participants non techniques comprennent en < 5 minutes qu'ils « jouent » un processus futur, chacun dans un rôle.
- **H2 — Valeur du chiffre** : voir les KPIs projetés du processus futur (temps de cycle, handoffs, retouches) AVANT tout développement déclenche une réaction du type « je veux ça pour mon vrai processus ».
- **H3 — Conformité jouable** : voir la piste d'audit et le principe des quatre yeux se construire en direct rassure les profils risque/conformité dès le stade concept.

Tout choix d'implémentation qui n'aide pas à tester H1–H3 est hors périmètre.

## 2. Anti-objectifs (le prototype NE fait PAS)

- Pas de backend, pas de base de données, pas d'authentification réelle : tout est en mémoire, dans le navigateur.
- Pas de génération IA en temps réel dans le prototype lui-même (les contenus « générés » sont pré-écrits dans la définition du scénario).
- Pas de multi-utilisateurs réseau : la démo tourne sur une seule machine, en atelier, projetée ou en fenêtres côte à côte.
- Pas de moteur BPMN standard, pas d'intégration à des systèmes réels.
- Pas de design system d'entreprise : sobre, lisible, crédible — c'est tout.

## 3. Scénario de démonstration embarqué

Un seul flux de valeur, pré-chargé : **« Réclamation d'assurance habitation — dégât d'eau »** (processus FUTUR redessiné, fictif).

**Étapes du flux (état cible simulé) :**

| # | Étape | Acteur | Durée simulée | Type |
|---|-------|--------|---------------|------|
| 1 | Déclaration du sinistre (formulaire + photos) | Client | 10 min | Humain |
| 2 | Tri automatique + score de complexité | Agent IA « Triage » | 30 s | Automatisé |
| 3 | Vérification de couverture (règles) | Moteur de règles | 5 s | Automatisé |
| 4 | Évaluation du dossier | Analyste sinistres | 4 h | Humain |
| 5 | Demande d'expertise externe (si score > seuil) | Expert externe | 3 jours | Tiers asynchrone |
| 6 | Proposition d'indemnisation | Analyste sinistres | 1 h | Humain |
| 7 | Approbation seconde signature (si montant > 10 000 $) | Superviseur | 2 h | Humain — quatre yeux |
| 8 | Notification et paiement | Système | 1 min | Automatisé |

**Règles de décision (table simple, visible dans l'interface) :**

- Couverture invalide → rejet motivé à l'étape 3, fin du flux.
- Score de complexité > 70 → passage obligatoire par l'étape 5 (expertise externe).
- Montant proposé > 10 000 $ → étape 7 obligatoire (séparation des tâches : le superviseur ne peut pas être l'analyste du dossier).

**Exceptions injectables (déclenchées par l'animateur, voir §5.4) :**

- E1 : l'expert externe ne répond pas (timeout 5 jours simulés) → escalade automatique.
- E2 : documents illisibles → boucle de retouche vers le client.
- E3 : pic de volume — 8 dossiers arrivent d'un coup dans la file de l'analyste.

## 4. Rôles et vues

L'application est une **app web monopage** avec un sélecteur de rôle permanent (onglets ou barre latérale). Chaque rôle voit une vue différente du MÊME état partagé :

1. **Client** — formulaire de déclaration simplifié (5 champs + upload factice), puis suivi de son dossier (statut, délais, demandes de compléments).
2. **Analyste sinistres** — file d'attente de dossiers, détail d'un dossier, actions (évaluer, demander expertise, proposer un montant, renvoyer au client).
3. **Superviseur** — file des approbations quatre-yeux, avec montant, motif, et boutons Approuver / Refuser avec commentaire obligatoire.
4. **Animateur (Game Master)** — panneau de contrôle : horloge, injection d'exceptions, génération de nouveaux dossiers synthétiques, reset du scénario.
5. **Tour de contrôle (vue projetée)** — la vue vedette de la démo : carte du flux en direct + KPIs + piste d'audit (voir §5.5).

Le changement de rôle est instantané (aucun login). L'état est unique et partagé entre toutes les vues.

## 5. Exigences fonctionnelles

### 5.1 Horloge simulée (cœur du concept)

- Une horloge globale affichée en permanence : date/heure simulées + facteur de compression (ex. « ×500 — 1 s réelle = ~8 min simulées »).
- Contrôles animateur : Pause / Lecture / Vitesse (×1, ×100, ×500, ×2000) / « Avancer jusqu'au prochain événement ».
- TOUTES les durées du §3 s'écoulent en temps simulé. Un dossier chez l'expert externe (3 jours) revient après le délai simulé correspondant.
- Chaque dossier affiche son « âge » en temps simulé (ex. « ouvert il y a 2 j 4 h »).

### 5.2 Dossiers synthétiques

- Au démarrage : 3 dossiers pré-remplis à des étapes différentes + possibilité pour l'animateur d'en générer de nouveaux (bouton « Nouveau dossier »).
- Données synthétiques réalistes pour le Québec : noms plausibles, adresses fictives (villes réelles), montants entre 800 $ et 45 000 $, descriptions de dégât d'eau variées. Un générateur pseudo-aléatoire embarqué suffit (listes de prénoms/noms/rues combinées).
- Aucun Lorem Ipsum. Aucune donnée réelle.

### 5.3 Moteur de flux

- Machine à états par dossier, suivant le §3. Les étapes automatisées s'exécutent seules quand l'horloge atteint leur échéance ; les étapes humaines attendent l'action du rôle concerné.
- Les règles de décision sont stockées comme **table de décision lisible** (structure de données déclarative, affichable dans l'interface via un panneau « Règles ») — pas codées en dur dans la logique des composants. Objectif : pouvoir dire en démo « les règles sont des données, pas du code ».

### 5.4 Injection d'exceptions

- Trois boutons dans le panneau animateur : E1, E2, E3 (§3), applicables à un dossier ciblé (E1, E2) ou globalement (E3).
- Chaque exception produit des effets visibles dans les vues concernées (alerte dans la file de l'analyste, notification côté client, événement dans la piste d'audit).

### 5.5 Tour de contrôle : KPIs et carte du flux

- **Carte du flux** : les 8 étapes en ligne, avec le nombre de dossiers présents à chaque étape (badge), animée quand un dossier avance.
- **KPIs en direct**, calculés sur les dossiers clôturés et en cours :
  - Temps de cycle moyen (simulé) de bout en bout
  - Nombre moyen de handoffs par dossier
  - Taux de retouche (dossiers ayant subi E2 ou un renvoi)
  - Charge par rôle (dossiers en attente par file)
  - % de dossiers passés par la double signature
- **Piste d'audit** : journal horodaté (temps simulé) de chaque transition : qui, quoi, quand, sur quel dossier, avec quelle justification. Filtrable par dossier. Exportable en JSON (bouton).

### 5.6 Séparation des tâches (quatre yeux)

- Si l'animateur tente de faire approuver un dossier > 10 000 $ par le même « utilisateur » que l'analyste ayant proposé le montant, le système REFUSE avec un message explicite citant la règle. (Le prototype simule l'identité par le rôle actif + un nom d'utilisateur fictif sélectionnable.)
- Ce refus est journalisé dans la piste d'audit comme « tentative bloquée ».

### 5.7 Retour visuel et crédibilité (précise §2 « sobre, lisible, crédible »)

> Ajouté après un premier retour d'atelier informel : l'implémentation initiale respectait la
> lettre de §5.1–§5.6 mais restait fonctionnellement une liste de texte brut, insuffisante pour
> H1/H2/H3. Cette section rend « sobre, lisible, crédible » testable, sans revenir sur l'anti-objectif
> de §2 (pas de design system d'entreprise, pas de bibliothèque de composants tierce).

- Chaque dossier affiche un badge de statut coloré correspondant à son étape courante — pas
  seulement le nom de l'étape en texte brut.
- Chaque dossier affiche son âge en temps simulé (§5.1) de façon visible partout où il apparaît
  (Client, Analyste, Superviseur, Tour de contrôle), pas seulement dans un seul écran.
- L'horloge simulée (§5.1) reste visible en permanence dans toutes les vues, pas seulement dans le
  panneau animateur.
- Chaque rôle (Client, Analyste, Superviseur, Animateur, Tour de contrôle) a une identité visuelle
  distincte (couleur d'accent cohérente) permettant de reconnaître immédiatement, sans lire de
  texte, quel rôle est actif.
- Une exception injectée (E1/E2/E3) ou une clôture de dossier produit un signal visuel dans la vue
  concernée — cohérent avec l'exigence déjà présente en §5.4 (« effets visibles »), qui restait
  jusqu'ici satisfaite seulement par la piste d'audit.
- Ce niveau de finition reste dans les limites de §2 : un jeu cohérent de couleurs/badges/espacements
  suffit, implémenté en CSS simple — pas de nouvelle dépendance, pas de charte graphique.

## 6. Exigences non fonctionnelles

- **Stack** : application web monopage, React ou HTML/JS vanilla, un seul fichier livrable si possible. Aucune dépendance serveur. État en mémoire uniquement (pas de localStorage requis).
- **Démarrage** : ouvrir le fichier / l'artefact → la démo est jouable immédiatement, scénario pré-chargé.
- **Performance** : fluide avec 30 dossiers simultanés et vitesse ×2000.
- **Lisibilité projecteur** : la Tour de contrôle doit rester lisible projetée dans une salle (tailles de police généreuses, contrastes forts).
- **Reset** : bouton unique remettant tout le scénario à l'état initial.

## 7. Définition déclarative du processus (préparer la suite)

Le scénario du §3 (étapes, durées, règles, exceptions) doit être défini dans **une structure de données unique et isolée** (objet JSON/JS en tête de fichier), séparée du moteur et des vues. Critère : changer une durée, un seuil ou ajouter une étape ne doit toucher que cette structure.

> Raison stratégique : la version produit générera cette structure par IA à partir d'une spec en langage naturel. Le prototype doit démontrer que le moteur est agnostique au scénario.

## 8. Critères d'acceptation (testables un par un)

1. Je peux, en tant que Client, déclarer un sinistre ; il apparaît dans la file de l'Analyste en < 2 s.
2. En vitesse ×500, un dossier envoyé en expertise externe revient automatiquement après ~3 jours simulés, sans action humaine.
3. Un dossier de 15 000 $ ne peut PAS être clôturé sans approbation d'un superviseur distinct de l'analyste ; la tentative contraire affiche un refus motivé et est journalisée.
4. L'injection de E3 fait apparaître 8 dossiers dans la file de l'analyste et la charge par rôle sur la Tour de contrôle reflète le pic immédiatement.
5. Après clôture d'au moins 3 dossiers, la Tour de contrôle affiche un temps de cycle moyen, un nombre de handoffs et un taux de retouche cohérents avec ce qui s'est joué.
6. La piste d'audit d'un dossier raconte son histoire complète, en temps simulé, et s'exporte en JSON.
7. Je peux modifier le seuil de 10 000 $ à 5 000 $ dans la structure déclarative (§7) sans toucher au moteur, et le comportement change.
8. Une personne qui n'a jamais vu l'outil comprend la Tour de contrôle sans explication de plus de 2 phrases.
9. Un dossier affiche visiblement son étape (badge coloré) et son âge simulé dans chaque vue où il apparaît ; changer de rôle change visiblement l'identité de couleur de l'interface (§5.7).

## 9. Livrable attendu du LLM

1. L'application complète, fonctionnelle, conforme aux §5–8.
2. Un encadré « Mode d'emploi atelier » intégré à l'interface (panneau repliable) : déroulé suggéré de 20 minutes pour animer une session avec 4 participants.
3. La liste explicite de tout écart par rapport à cette spec, avec justification.

---

*Fin de la spec. Toute ambiguïté doit être résolue en faveur des hypothèses H1–H3 : le prototype existe pour provoquer une réaction chez un gestionnaire de transformation, pas pour être architecturalement pur.*
