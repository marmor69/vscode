# Plan: Simple Workspace auf Smartphones

Stand: 14. Oktober 2026. **Entwurf, keine Implementierung.** Die genannten Einstellungen,
Dateien und Verhaltensweisen sind Vorschläge, soweit nicht ausdrücklich als Bestand bezeichnet.

## Empfehlung und Architekturentscheidung

Die bestehende Web-Workbench bekommt innerhalb der vereinfachten Ansicht ein adaptives
Ein-Screen-Layout. Dateien, Dokument und Assistent teilen sich denselben Inhaltsbereich;
eine beschriftete Navigation schaltet zwischen ihnen um. Server, Dateisystem,
Extension Host und offizielle Agenten-Extensions bleiben die vorhandenen Komponenten.

Danach kann dieselbe Webanwendung optional als PWA installierbar werden. Eine PWA ist
eine zusätzliche Start- und Darstellungsform, keine Alternative zu responsivem Layout.
Ein separater mobiler Fork oder eine native App ist für dieses Ziel vorerst nicht sinnvoll.

| Ansatz | Nutzen | Aufwand und Updatefolgen | Entscheidung |
| --- | --- | --- | --- |
| Nur CSS-Media-Queries | Abstände, Schrift, Touch-Flächen anpassen | Reicht für das imperative Workbench-Grid, Fokus und Webview-Lebenszyklen nicht aus | Teil der Lösung |
| Mobile Layout-Contribution im bestehenden Fork | Bestehende Editoren, Dateien und Extensions weiterverwenden | Begrenzte Integrationsstellen; Layout-Adapter braucht Regressionstests | Empfohlener Kern |
| PWA derselben Anwendung | Homescreen, eigenes Fenster, weniger Browser-Chrome | Zusätzliche Prüfung von Anmeldung, Updates und Browser-Lebenszyklus | Nach funktionierender mobiler Ansicht |
| Native Hülle um die Website | App-Store-Verteilung, eventuell Geräteintegration | Dieselben Layoutprobleme plus WebView-/Anmeldeprobleme und Release-Pflege | Nur bei späterem konkretem Bedarf |
| Eigener mobiler Client | Maximale Kontrolle über jede Oberfläche | VS-Code-Extensions laufen darin nicht automatisch; eigene Agenten-, Editor- und Dateiintegration nötig | Aktuell nicht empfohlen |

Der Agent läuft weiterhin im Linux-Container auf dem VPS. Weder PWA noch Smartphone
brauchen eine lokale Node.js-/Terminal-Umgebung. Eine separate Docker-Architektur ist
für die mobile Oberfläche nicht erforderlich.

## Nutzererlebnis

Ziel: ruhig, fokussiert und nachvollziehbar. Ein sichtbarer Arbeitsbereich, klare
Navigation und keine automatisch aufspringenden anderen Screens.

```text
┌──────────────────────────────┐
│ Projektname       Hilfe  ⋯   │
├──────────────────────────────┤
│                              │
│ Dateien ODER Dokument        │
│ ODER ausgewählter Assistent  │
│                              │
├──────────────────────────────┤
│ Dateien  Dokument  Assistent │
└──────────────────────────────┘
```

- Die drei Ziele sind immer beschriftet; Icons ergänzen den Text. „Assistent“ zeigt
  zusätzlich den gewählten Anbieter, etwa Codex. Ein Screenwechsel erzeugt keine neue Sitzung.
- Beim ersten Öffnen startet die App bei Dateien. Anschließend wird der letzte Screen
  dieses Geräts/Arbeitsbereichs wiederhergestellt; ein direkter Dateilink öffnet das Dokument.
- Eine bewusst angetippte Datei öffnet den Dokument-Screen. Hintergrundereignisse des
  Agenten wechseln den Screen nicht. Ein Hinweis kann neue Ergebnisse signalisieren,
  soweit die Extension dafür öffentliche Ereignisse anbietet.
- Der gewählte Arbeitsordner ist sichtbar. Ordnerwechsel und Agentenkontext sind
  getrennte Aktionen: Das bloße Antippen eines Ordners setzt nicht den Agentenkontext neu.
  „In diesem Ordner arbeiten“ soll den tatsächlichen Workspace wechseln; dabei gelten
  die vorhandenen Speicher-, Vertrauens- und Sitzungsdialoge.
- Auf Smartphones ersetzt die Navigation die senkrechte Activity Bar. Unter „Mehr“
  bleiben Suche, Änderungen/Quellcodeverwaltung, Erweiterungen, Einstellungen und
  Ansichten installierter Extensions erreichbar. Auf großen Bildschirmen bleibt die
  bisherige Activity Bar erhalten. Run and Debug bleibt im einfachen Modus verborgen;
  Copilot-Chat bleibt eine ausdrückliche Assistentenwahl.
- Wechsel zur Standardoberfläche und zurück bleibt unter „Mehr“ erreichbar. Die
  vollständige Standardoberfläche ist ein Ausweg für Spezialfunktionen, erhält aber
  durch dieses Vorhaben nicht automatisch ein vollständiges mobiles Redesign.

### Dateien

Große antippbare Zeilen, eigener Pfeil zum Aufklappen, klare Aktion zum Öffnen.
Datei/Ordner erstellen, umbenennen, verschieben, löschen, hochladen und herunterladen
müssen ohne Rechtsklick, Hover oder Drag-and-drop möglich sein. Ein sichtbares
Aktionsmenü ersetzt diese Voraussetzungen. Vorhandene Bestätigungen bleiben wirksam.
Lange Namen umbrechen oder zugänglich vollständig anzeigen; den aktuellen Pfad als
kompakte, aufklappbare Navigation zeigen. Serverdateien und lokale Handy-Dateien
beim Upload/Download verständlich unterscheiden.

### Dokument

Ein aktives Dokument füllt den Screen. Weitere geöffnete Dokumente über eine Liste
statt einer langen Tab-Leiste auswählen. Ungespeicherte Änderungen sichtbar anzeigen;
vorhandene Speichereinstellungen nicht stillschweigend ändern. Gut erreichbare Aktionen
für Speichern, Rückgängig und Wiederholen; Textumbruch für normale Texte/Markdown.

Für Markdown gibt es „Bearbeiten / Vorschau“ innerhalb des Dokument-Screens.
Die Vorschau bleibt live, wenn sichtbar; auf dem Smartphone nicht nebeneinander.
Die bestehende Aktion nutzt derzeit `markdown.showPreviewToSide` und braucht deshalb
später eine mobile Alternative. Bereits vorhandene Editorgruppen dürfen beim Wechsel
nicht geschlossen oder destruktiv zusammengeführt werden. Gruppenzustand und Vorschau
sollen beim Rückwechsel auf Desktop wiederherstellbar sein.

Monaco zunächst behalten, aber Texteingabe auf realen Geräten früh prüfen:
Textauswahl, Zwischenablage, Umlaute, IME, Autokorrektur, Diktat, Cursorbewegung und
Undo. Falls die Grundbedienung scheitert, eine gesonderte Entscheidung über einen
mobilen Texteditor treffen; dieser wäre mehr als eine reine Layoutänderung.
Office- und andere Custom Editors gesondert prüfen; keine universelle mobile
Kompatibilität versprechen.

### Assistent

Die ausgewählte offizielle Codex-/Claude-Webview erhält die gesamte verfügbare Breite.
Eingabe, Senden/Stoppen, Modellwahl, Anmeldung und Rückfragen zur Freigabe müssen
mit Touch bedienbar sein. Eine laufende Aufgabe darf durch Screenwechsel nicht
absichtlich beendet werden. Unabgeschickte Eingaben und Scrollposition sollen erhalten
bleiben; ob die jeweilige Extension dies beim Verbergen ihrer Webview unterstützt,
ist ein früher Prüfschritt, keine garantierte Eigenschaft.

Die Workbench kann fremde Webviews nicht zuverlässig per äußerem CSS umgestalten.
Keine DOM-Injektionen oder Patches in heruntergeladenen Extension-Bundles planen.
Fehler zunächst mit einem bildschirmfüllenden Container und öffentlichen VS-Code-APIs
lösen; verbleibende Einschränkungen je Extension dokumentieren und upstream melden.
Ein eigenes Chat-Frontend wäre ein separates Projekt mit anderer Integrationsarchitektur.

### Touch, Tastatur und übergreifende Oberflächen

- Touch-Ziele als Zielwert mindestens 44–48 CSS-Pixel, ausreichende Abstände;
  Tastatur- und Screenreader-Bedienung weiterhin ermöglichen.
- Tooltips bleiben für Mausnutzer. Auf Smartphones ergänzen sichtbare Beschriftungen,
  kurze Hilfetexte und ein antippbarer Hilfe-Button die Erklärungen.
- Quick Pick, Befehlsauswahl, Suche, Einstellungen, Erweiterungsdetails, Kontextmenüs,
  Datei-/Ordnerdialoge, Workspace Trust, Fehler und Bestätigungen in die Bestandsaufnahme
  aufnehmen. Menüs als passende Sheet-/Vollbilddarstellung prüfen; Dialoge müssen
  scrollbar sein und ihre Bestätigungsbuttons behalten.
- Smartphone-Tastatur darf Eingabe, Cursor, Senden und Freigaben nicht verdecken.
  VisualViewport, dynamische Viewport-Höhe und Safe Areas berücksichtigen. Die
  Navigation darf bei offener Tastatur kompakter werden, muss aber erreichbar bleiben.
- Kein automatisches Fokussieren des Editors beim Start oder Screenwechsel, das ohne
  Schreibabsicht die Tastatur öffnet. Verborgene Inhalte nicht per Tab/Screenreader
  erreichbar lassen; Fokus beim expliziten Wechsel sinnvoll wiederherstellen.
- Browser-Zoom und Vergrößerung nicht sperren. VoiceOver/TalkBack, hohe Kontraste,
  große Schrift, externe Tastatur und reduzierte Bewegung berücksichtigen.
- Keine globalen Wischgesten als Voraussetzung: Sie kollidieren mit Textauswahl,
  horizontalem Scrollen und Browser-Zurück. System-Zurück und das Schließen von
  Dialogen gemeinsam testen; zunächst keine künstlichen History-Einträge je Tab.

## Technischer Befund im aktuellen Repository

Die folgenden Quellen wurden gelesen; mobile Laufzeittests wurden für diesen Plan
nicht durchgeführt.

| Bestand | Bedeutung für den Plan |
| --- | --- |
| `src/vs/workbench/contrib/simpleUI/browser/simpleUI.contribution.ts` | Vorhandene Contribution, Umschaltung, Assistentenwahl und Layout-Snapshot; mobile Steuerung hier anbinden, nicht eine zweite unabhängige Automatik darüberlegen |
| `src/vs/workbench/contrib/simpleUI/common/simpleUI.ts` | Temporäre Konfiguration mit Wiederherstellung als vorhandenes Muster |
| `src/vs/workbench/services/layout/browser/layoutService.ts` | `setPartHidden`, Layout-Ereignisse und `setAuxiliaryBarMaximized` als mögliche Integrationspunkte |
| `src/vs/workbench/browser/layout.ts` | `setEditorHidden` blendet das untere Panel ein, wenn Editor und Panel verborgen wären und die Auxiliary Bar nicht maximiert ist; deshalb ist ein reiner Datei-Screen nicht durch beliebige Hide-Aufrufe garantiert |
| `src/vs/sessions/browser/parts/mobile/` | Upstream-Vorbilder für mobile Parts, Sheets und VisualViewport |
| `src/vs/sessions/contrib/layout/browser/mobileSessionLayoutController.md` | Separates Sessions-Layout unterdrückt die Auxiliary Bar auf Phones; kein fertiger Ersatz für unsere drei Screens mit Extension-Chat |
| `.github/copilot-instructions.md` | Schichtengrenze: Sessions darf Workbench importieren, Workbench darf Sessions nicht importieren |

Die vorhandenen mobilen Sessions-Bausteine sind somit Referenzmaterial. Gemeinsam
nutzbare Helfer müssten gegebenenfalls sauber in eine tiefere gemeinsame Schicht
extrahiert werden. Das vollständige Sessions-Workbench als neue Basis zu übernehmen
würde die gewünschte geringe Abweichung vom bisherigen Fork voraussichtlich vergrößern.

## Vorgeschlagene Umsetzung und Updategrenzen

1. **Eine kleine mobile Contribution und ein Layout-Adapter.** Vorgeschlagene neue
   Dateien unter `contrib/simpleUI/browser/mobile/`: Controller, Navigation, Styles
   und ein Adapter für die vorhandenen Layout-/View-/Editor-Services. Die konkrete
   Dateiaufteilung erst nach dem Machbarkeitsnachweis festlegen.
2. **Expliziter Zustand.** Zum Beispiel Layoutmodus, aktiver Screen, aktive Datei und
   ausgewählter Assistent; Screenwechsel über eine gemeinsame Steuerung serialisieren.
   Bestehendes `openAgent()` darf beim Start nicht die mobile Screenwahl übersteuern.
3. **Automatische Erkennung mit Ausweg.** Vorschlag `workbench.simpleUI.mobileLayout`:
   `auto | on | off`, nur wirksam bei eingeschaltetem Simple UI. `auto` nach verfügbarer
   Breite, nicht User-Agent; Startwert für Erprobung unter 768 CSS-Pixel. Tabletgrößen
   zunächst konservativ testen, Drei-Spalten erst bei ausreichend Platz. Smartphone-
   Querformat soll bei wenig Höhe weiter einen Screen zeigen. Hysterese verhindert
   Flattern an Grenzwerten; die Bildschirmtastatur allein darf keinen Moduswechsel auslösen.
4. **Zwei getrennte Wiederherstellungsebenen.** Bestehender Standard→Simple-Snapshot
   bleibt erhalten; Simple-Desktop→Mobile bekommt eigenen Zustand. Layoutpräferenzen
   gerätelokal halten und nicht versehentlich zwischen Handy und Desktop synchronisieren.
   Sichtbarkeit, Fokus, Breiten, Containerpositionen und Editorgruppen berücksichtigen;
   keine fremden privaten Storage-Schlüssel verändern. Reload, Rotation und mehrere
   Browserfenster dürfen den ursprünglichen Desktopzustand nicht überschreiben.
5. **Layout-Services zuerst.** Für Chat die vorhandene Maximierung untersuchen.
   Für Dateien die Grid-Invariante gezielt prüfen. Falls nötig, einen schmalen,
   expliziten Layout-Hook für Simple-UI-Ein-Screen-Modus ergänzen; keine verstreuten
   Sonderfälle und kein reines `display:none`, das Grid und Fokus widersprüchlich lässt.
   Dauerhaftes Umhängen von Extension-Webviews/DOM vermeiden.
6. **CSS klar begrenzen.** Styles unter einer eigenen mobilen Root-Klasse, bestehende
   Theme-Tokens und lokalisierbare Labels verwenden. Änderungen am allgemeinen Grid,
   Monaco oder Standardmodus auf nachgewiesene Lücken beschränken.
7. **Core-Eingriffe dokumentieren.** Jeden notwendigen Hook mit Zweck, Upstream-Datei
   und Regressionstest erfassen. Nach Upstream-Merges zuerst diese kleine Liste
   prüfen. Auf `main` zu arbeiten verhindert Upstream-Merges nicht; entscheidend sind
   kleine, thematisch getrennte Commits und möglichst wenige Änderungen an Core-Dateien.

## Arbeitspakete und Entscheidungstore

| Phase | Ergebnis | Abschlusskriterium |
| --- | --- | --- |
| 0 – Bestandsaufnahme | Mobile Ansichten, vorhandene APIs und offene Probleme erfassen; Desktopzustand als Referenz sichern | Prüfliste für alle eigenen Oberflächen und separat für Extension-Webviews |
| 1 – Machbarkeitsnachweis | Wegwerf-Prototyp für drei echte Vollbild-Screens, Monaco-Eingabe, Codex/Claude und Tastatur | Kein unerwünschtes unteres Panel; kein Verlust ungespeicherter Texte/Chatentwürfe; brauchbare Eingabe auf iOS und Android |
| 2 – Layout und Navigation | Controller, Umschalter, responsive Umschaltung, Fokus und Wiederherstellung | Wiederholte Rotation, Reload und Wechsel zur Standardansicht ohne Layout-/Datenverlust |
| 3 – Dateien und Dokumente | Touch-Dateiaktionen, Dokumentauswahl, Markdown-Umschaltung | Nutzer kann einen ICM-Ordner öffnen, Text erstellen, speichern, Vorschau ansehen und Datei wiederfinden |
| 4 – Agenten und restliche UI | Assistentenwahl, Freigaben, Suche, Einstellungen, Extensions, Dialoge | Kernworkflow vollständig ohne Maus, Hover oder Hardware-Tastatur möglich |
| 5 – Stabilität und Zugänglichkeit | Geräteprüfung, Reconnect, Regressionen, Performance | Akzeptanzmatrix erfüllt; bekannte Extension-Grenzen ausdrücklich dokumentiert |
| 6 – Optionale PWA | Manifest/Icons/Startpfad und installierter Betrieb, vorhandene Assets vorher inventarisieren | Homescreen-Start, Cloudflare-Anmeldung, Agentenanmeldung und Update funktionieren auf Zielgeräten |

Nach Phase 1 entscheiden: Reichen vorhandene APIs plus ein kleiner Core-Hook? Falls
Datei-Vollbild, Texteingabe oder offizielle Agenten-Webviews grundlegende Umbauten
verlangen, Aufwand und Produktziel neu bewerten, bevor die ganze UI angepasst wird.
Keine belastbare Gesamtdauer vor diesem Prüfschritt; die größten Unbekannten sind
mobile Texteingabe und die unabhängigen Extension-Oberflächen.

## PWA, Anmeldung und Verbindungsunterbrechungen

PWA zunächst als online benötigte Anwendung planen. Dateien, Terminal und Agenten
bleiben serverseitig; Installation erzeugt keinen Offline-Agenten und keine garantierte
Offline-Bearbeitung. Vorhandene Webview-Service-Worker von einem möglichen App-Service-
Worker unterscheiden. Keinen pauschalen Cache für authentifizierte HTML-Antworten,
Dateien oder Agentendaten einführen. Updates dürfen keine ungespeicherten Texte
verwerfen und keine inkompatiblen Client-/Serverstände dauerhaft cachen.

Cloudflare-Access-Anmeldung, abgelaufene Sitzung und Agentenanmeldung im externen
Browser sowie im installierten Modus testen. Für Codex bleibt Device Code der
vorhandene Remote-Weg; eine PWA macht einen localhost-Callback nicht erreichbar.
Claude-Anmeldung gesondert testen. Der Wechsel zur Anmeldeseite und zurück muss
denselben Arbeitsbereich wiederfinden.

Mobile Browser können Tabs im Hintergrund anhalten oder verwerfen. Agentenprozesse
laufen serverseitig nur so lange weiter, wie Extension und Sitzung dies unterstützen.
Reconnect, Serverneustart, Netzwechsel und gesperrten Bildschirm explizit testen.
Unabgeschickte Eingaben und ungespeicherte Texte beim Prozessverlust sind ein eigener
Persistenzprüfpunkt. UI muss Offline-/Reconnect-Zustand zeigen; keine garantierte
Hintergrundverbindung oder Push-Benachrichtigungen in der ersten Version versprechen.

## Validierung und Abnahme

Automatisiert: Controller-Zustandswechsel und Wiederherstellung gezielt testen;
Browser-Smokes für Navigation, Dateiöffnung, Markdown, Dialoge und unveränderten
Desktopmodus. Agentenchecks gegen den echten Docker-Server: Die reine Browser-Demo
hat keinen passenden Remote Extension Host und belegt diese Kompatibilität nicht.

Manuell: Safari auf echtem iPhone, Chrome auf echtem Android, jeweils Browser und
später PWA. Playwright-WebKit und Geräteemulation ergänzen, ersetzen aber keine reale
Bildschirmtastatur oder OS-Anmeldung. Breiten 320, 360, 390, 430, 768, 1024 und 1440
CSS-Pixel, Hoch-/Querformat, große Schrift, Zoom, VoiceOver/TalkBack prüfen.

Abnahme des ersten mobilen Stands:

- Auf schmalem Screen ist genau ein Hauptbereich sichtbar, ohne horizontales Scrollen
  der gesamten Oberfläche; breite Dokumentinhalte dürfen gezielt intern scrollen.
- Dateien → Dokument → Assistent → Dokument erhält Text, Auswahl und soweit unterstützt
  Chatentwurf/Scrollposition. Kein Neustart des Agenten durch die Navigation.
- Neuer ICM-Ordner, Markdown-Datei und Vorschau sind vollständig per Touch bedienbar;
  tatsächlicher Workspace und Kontextwahl bleiben verständlich.
- Codex und Claude lassen sich anmelden, bedienen und zu einem realen Dateiauftrag
  einsetzen; Freigaben und Abbruch sind auch mit geöffneter Tastatur erreichbar.
- Verbindungsabbruch und Wiederanmeldung erzeugen keinen stillen Datenverlust.
- Standardansicht, Desktoplayout und bestehende Einstellungen bleiben nach mehreren
  Wechseln und Reloads korrekt; Debug/Copilot-Sichtbarkeit folgt weiterhin der Auswahl.
- Nicht mobile Extensions bleiben erreichbar; bekannte Einschränkungen werden
  benannt, statt allgemeine Kompatibilität zu behaupten.

## Vorgeschlagene Produktentscheidungen

Ohne weitere Vorgaben mit drei Hauptzielen „Dateien / Dokument / Assistent“, einem
„Mehr“-Menü, automatischer Erkennung und manuellem Override beginnen. Tablet-Split-
Layouts, optionale Wischgesten, PWA-Installation und native Gerätefunktionen folgen
nach dem stabilen Smartphone-Kern. Dieser Plan setzt noch keine dieser Entscheidungen
im Produkt um.
