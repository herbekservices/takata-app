// scripts/generate-guide.js — Génère le guide d'utilisation TAKATA (DOCX)
// Usage : node scripts/generate-guide.js
const path = require('path');
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, TableLayoutType
} = require('docx');

const GREEN = '16A34A';
const GREEN_DARK = '15803D';
const GREEN_LIGHT = 'DCFCE7';
const TEXT = '111827';
const MUTED = '6B7280';

const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 }, children: [new TextRun({ text: t, color: GREEN_DARK, bold: true, size: 30 })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: t, color: GREEN, bold: true, size: 24 })] });
const p = (t, opts = {}) => new Paragraph({ spacing: { after: 120, line: 312 }, children: [new TextRun({ text: t, size: 22, color: TEXT, ...opts })] });
const bullets = (items) => items.map((t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80, line: 300 }, children: [new TextRun({ text: t, size: 22, color: TEXT })] }));

const cell = (text, opts = {}) => new TableCell({
  width: { size: opts.w || 25, type: WidthType.PERCENTAGE },
  shading: opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade } : undefined,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  children: [new Paragraph({ spacing: { after: 0, line: 280 }, children: [new TextRun({ text, size: 20, bold: !!opts.bold, color: opts.color || TEXT })] })]
});

const table = (headers, rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  layout: TableLayoutType.FIXED,
  rows: [
    new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, { bold: true, shade: GREEN_LIGHT, w: i === 0 ? 30 : 70 })) }),
    ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, { w: i === 0 ? 30 : 70 })) }))
  ],
});

const doc = new Document({
  styles: { default: { document: { run: { font: 'Calibri', size: 22, color: TEXT } } } },
  sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
    children: [
      // Couverture
      new Paragraph({ spacing: { before: 1200, after: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: '⚡ TAKATA', bold: true, size: 64, color: GREEN })] }),
      new Paragraph({ spacing: { after: 60 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Guide d’utilisation — Application agent de terrain', size: 30, color: TEXT })] }),
      new Paragraph({ spacing: { after: 60 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Version 1.0 — PWA installable (Android / iPhone)', size: 22, color: MUTED })] }),
      new Paragraph({ spacing: { after: 300 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Thème vert TAKATA · #16A34A', size: 20, color: GREEN_DARK })] }),

      h1('1. Démarrer l’application'),
      p('Le serveur se lance avec `npm start` après l’installation des dépendances (`npm install`) et l’initialisation des données (`npm run seed`). L’application est alors disponible à l’adresse http://localhost:3000 (ou le port choisi).'),
      p('Sur téléphone, l’application s’installe comme une PWA : menu du navigateur puis « Ajouter à l’écran d’accueil » (Android/Chrome) ou bouton Partager puis « Sur l’écran d’accueil » (iPhone/Safari). Une connexion HTTPS est nécessaire pour l’installation sur un téléphone (pas pour localhost).'),

      h1('2. Comptes de test'),
      table(['Rôle', 'Identifiant / Mot de passe'], [
        ['Administrateur', 'admin / admin123'],
        ['Agent 1 (Lubumbashi)', 'agent1 / agent123'],
        ['Agent 2 (Kinshasa)', 'agent2 / agent123'],
        ['Agent 3 (Kolwezi)', 'agent3 / agent123'],
      ]),

      h1('3. Espace agent'),
      h2('3.1 Connexion et tableau de bord'),
      p('Saisissez votre identifiant et votre mot de passe. Le tableau de bord affiche vos indicateurs : nombre de clients, prospects, installations, encaissés du mois, échéances en retard ou à venir sous 7 jours, stock faible et commissions à venir. Les « Derniers paiements » et le « Stock faible » sont consultables directement sur la page d’accueil.'),
      h2('3.2 Clients et prospects'),
      p('Ouvrez l’onglet Clients pour consulter, rechercher (nom, téléphone, village) et ajouter des clients. Le bouton « + » ouvre le formulaire de création. Le détail d’un client présente ses installations, son échéancier et son historique de paiements. Les prospects disposent d’un pipeline (nouveau, contacté, converti, perdu) ; le bouton « Convertir en client » transforme un prospect en client en conservant ses informations.'),
      h2('3.3 Installations'),
      p('Depuis « Installations » puis « + », choisissez le client (ID ou nom), le produit et le numéro de série. L’enregistrement décrémente automatiquement le stock et, pour un produit en paiement échelonné (PAYG), génère l’échéancier complet. Une commission est calculée automatiquement selon le taux du produit.'),
      h2('3.4 Paiements et relances'),
      p('Le bouton « + » de la page Paiements permet d’encaisser (espèces, mobile money, banque, carte). Vous pouvez rattacher le paiement à une échéance précise. La page Échéances liste les échéances en attente, en retard et payées ; le bouton « Relancer » crée une notification de rappel pour le client concerné.'),
      h2('3.5 Commissions, stock, profil'),
      p('L’onglet Commissions récapitule vos commissions en attente et payées. Le stock affiche les quantités par produit avec alerte quand le niveau est bas. Dans Profil, vous pouvez changer votre mot de passe, visualiser les opérations en attente de synchronisation et déclencher une synchronisation manuelle.'),
      h2('3.6 Mode hors-ligne'),
      p('Sans réseau, les créations et enregistrements sont mis en file d’attente sur l’appareil. À la reconnexion, la synchronisation est automatique : chaque opération porte un identifiant unique, le serveur applique chaque opération une seule fois et les données sont ensuite visibles par tous les utilisateurs autorisés.'),

      h1('4. Espace administrateur'),
      h2('4.1 Gestion des agents'),
      p('Onglet Admin → Agents : créez des agents (nom complet, identifiant, mot de passe, téléphone, région), réinitialisez un mot de passe, activez ou désactivez un compte. Un agent désactivé ne peut plus se connecter.'),
      h2('4.2 Produits et stocks'),
      p('Onglet Admin → Produits : gérez le catalogue (prix, coût, taux de commission, paiement échelonné PAYG avec nombre d’échéances). Onglet Admin → Stock : enregistrez les entrées, sorties et retours, consultez l’état des stocks par dépôt/agent et l’historique des mouvements.'),
      h2('4.3 Commissions et rapports'),
      p('Onglet Admin → Commissions : marquez les commissions comme payées. Onglet Admin → Rapports : synthèse des encaissements (total, par méthode, par agent) et exports CSV (clients, prospects, installations, paiements, échéances, agents, commissions) ouvrables dans Excel.'),
      h2('4.4 Notifications'),
      p('La cloche en haut à droite affiche le nombre de notifications non lues (bienvenue, échéances, relances, alertes stock). La page Notifications permet de tout marquer comme lu.'),

      h1('5. Sécurité et bonnes pratiques'),
      ...bullets([
        'Changez immédiatement le mot de passe par défaut (Profil).',
        'Les mots de passe sont hachés (scrypt) ; ils ne sont jamais stockés en clair.',
        'L’administrateur peut désactiver un compte ou réinitialiser un mot de passe à tout moment.',
        'Effectuez une sauvegarde régulière de la base (fichier data/takata.db, mode WAL).',
        'Un agent n’accède qu’à ses propres données ; l’administrateur voit tout.',
      ]),

      h1('6. Dépannage'),
      table(['Problème', 'Solution'], [
        ['Port 3000 déjà occupé', 'Lancer avec un autre port : $env:PORT="8080"; npm start (PowerShell)'],
        ['Pas d’accès au serveur', 'Vérifier que le terminal affiche « TAKATA démarré » et que http://localhost:<port> répond'],
        ['Mot de passe oublié', 'L’administrateur peut le réinitialiser (Admin → Agents → Réinit. mot de passe)'],
        ['Installation PWA impossible', 'HTTPS requis hors localhost — déployer derrière un certificat SSL et réessayer'],
        ['Données hors-ligne non synchronisées', 'Se reconnecter puis Profil → « Synchroniser maintenant »'],
      ]),
    ],
  }],
});

const OUT = path.join(__dirname, '..', 'out', 'GUIDE_UTILISATION_TAKATA.docx');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('DOCX généré :', OUT, buf.length, 'octets');
}).catch((e) => { console.error(e); process.exit(1); });