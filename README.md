# UrenLog (e.baillien)

Urenregistratie voor iPhone (SwiftUI + SwiftData, iOS 17+), met iCloud-sync en export naar Excel en PDF.

## Functies
- **Klok**: in- en uitklokken, of **uren manueel invoeren** (datum, beginuur, einduur). Je laatst ingevoerde uren worden onthouden. Per registratie vul je de **werfnaam** en het **werfnummer** in (typen of **scannen met de camera**; de werfnaam is gewone tekst per registratie, er wordt geen lijst van werven bijgehouden),
  en kies je het **uitgevoerde werk** (Allerlei, Zagen, Afplakken, CNC, Monteren), zet je **privéwerk** aan of uit, en vul je eventueel een notitie in.
- **Uren**: lijst per maand met maandtotaal, datums als cijfers (03-10-2026). Toevoegen, bewerken, verwijderen. Filters altijd zichtbaar bovenaan: alles, per week of per maand (met pijltjes naar vorige/volgende), zoeken op werfnaam of werfnummer, werk of privé, uitgevoerd werk, met het totaal van wat getoond wordt.
- **Rapport**: kies **Werk** of **Privé** (privéwerk komt nooit op het gewone rapport; het privérapport heet WEEKRAPPORT/MAANDRAPPORT - PRIVÉ), periode kiezen, filteren op werfnummer en werfnaam, totalen per uitgevoerd werk en per werfnummer.
  Export naar **Excel (.xlsx)** en **PDF** in de layout van het papieren **Weekrapport - Atelier**: één tabblad
  (Excel) of pagina (PDF) per week, werven in de volgorde van de week, uren per dag met de code van het werk.
- **Back-up**: in Instellingen een back-upbestand (.json) met alle uren, je naam, de keuzelijst Uitgevoerde werken en de instellingen (herinnering, standaarduren) **delen** (WhatsApp, mail, …) of **opslaan op het toestel**,
  en later terugzetten (samenvoegen of alles vervangen). Met de **wekelijkse herinnering** krijg je op een gekozen
  dag en uur een melding; tik erop om meteen te delen of op te slaan.
- Uren worden **exact in minuten** geteld, zonder afronding, en in Excel en PDF getoond als uren:minuten (9:45).

## Op je iPhone zetten
1. Open `UrenLog.xcodeproj` in Xcode.
2. Target **UrenLog** > **Signing & Capabilities** > kies je Apple-account bij *Team*.
3. Sluit je iPhone aan, kies hem bovenin als bestemming en druk op ▶︎.

Scannen werkt alleen op een echte iPhone (XS/XR of nieuwer), niet in de simulator.

### iCloud
iCloud-sync (CloudKit) vereist een **betaald Apple Developer-account** (€ 99/jaar).
Met een gratis account verwijder je onder *Signing & Capabilities* **iCloud** en **Push Notifications**;
de app bewaart de uren dan alleen op het toestel.
