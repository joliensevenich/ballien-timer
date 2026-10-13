# e. baillien - Timer (webversie)

Dezelfde urenregistratie als de iPhone-app, maar als webapp. Je hebt geen Apple Developer-account en geen Xcode nodig.
Werkt op iPhone, Android en computer, ook offline.

- **Uren blijven op het toestel** van elke gebruiker, nooit op een server. Iedereen met de link heeft zijn eigen, aparte gegevens.
- **Back-ups** zijn uitwisselbaar met de iPhone-app: een back-up uit de iPhone-app kun je hier terugzetten en omgekeerd.
- Excel en PDF in de layout van het **Weekrapport - Atelier**, net als in de iPhone-app.

Verschillen met de iPhone-app:
- **Scannen**: de scanknop opent de camera met een richtkader; de tekst in het kader wordt live gelezen en met één tik overgenomen. Via *Foto* kan het ook met een foto (bij handschrift: in het tekstveld tikken en *Scan tekst* van de iPhone kiezen).
- **Wekelijkse herinnering**: een website kan geen melding plannen. De app vraagt om een back-up wanneer je hem opent nadat het gekozen moment voorbij is.

## Online zetten met GitHub Pages (gratis)

1. Maak een account op [github.com](https://github.com).
2. Klik rechtsboven op **+** › **New repository**. Geef een naam, bijvoorbeeld `timer`, kies **Public** en klik **Create repository**.
3. Klik op **uploading an existing file** en sleep **de inhoud van deze map `web`** in het venster: `index.html`, `manifest.webmanifest`, `sw.js`,
   `logo.png`, `logo_excel.png` en de mappen `icons`, `js` en `vendor`. Klik **Commit changes**.
4. Ga naar **Settings** › **Pages**. Kies bij *Branch* **main** en **/ (root)** en klik **Save**.
5. Na een minuutje staat de app op `https://<jouw-gebruikersnaam>.github.io/timer/`.

Alleen de lege app staat online; de uren van gebruikers komen daar nooit.

## Op de iPhone zetten

1. Open de link in **Safari**.
2. Tik op het deel-icoon en kies **Zet op beginscherm**.
3. Open de app voortaan via het icoon. Hij werkt dan ook zonder internet.

Zet de app echt op het beginscherm: in een gewoon Safari-tabblad mag iOS de gegevens wissen van een website die je 7 dagen
niet gebruikt. Een app op het beginscherm valt niet onder die regel. Op een iPhone toont de app in Safari daarom eerst hoe je hem
op het beginscherm zet. In *Instellingen › Opslag* zie je of de uren beschermd zijn tegen automatisch wissen.
De wekelijkse back-upherinnering staat standaard aan.

Overstappen van de iPhone-app: maak daar in Instellingen een back-up, en zet die in de webapp terug via *Instellingen › Back-up terugzetten*.

## Een nieuwe versie online zetten

1. Verhoog in `sw.js` het nummer in `const VERSION = 'timer-v4'` (bijvoorbeeld naar `timer-v5`).
2. Upload de gewijzigde bestanden opnieuw naar GitHub.
3. Gebruikers krijgen de nieuwe versie de tweede keer dat ze de app openen terwijl ze internet hebben.
