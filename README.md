# Simple Workspace · Dateien, Texte und Codex

Ein experimenteller Fork von **Code – OSS** für Menschen ohne Programmierhintergrund:
Dateien links, das Dokument in der Mitte und die offizielle Codex-Extension rechts.
Ziel ist eine ruhige Arbeitsumgebung für wiederverwendbare Abläufe mit überschaubarem
Kontext in Ordnern und Markdown-Dateien.

![Simple Workspace mit Dateibaum, Markdown-Text und Codex-Einstieg](docs/simple-workspace/preview.png)

## Was dieser erste Stand kann

- Umschalten zwischen vollständiger Oberfläche und **Simple Workspace**.
- Dateiverwaltung mit gut sichtbaren Aktionen und erklärenden Tooltips.
- Texte und Markdown direkt bearbeiten; Live Preview und visuellen Markdown-Editor aufrufen.
- Im einfachen Modus: keine Aktivitätsleiste, Statusleiste, Minimap, Zeilennummern oder
  automatische Code-Vorschläge. Das untere Panel wird geschlossen; Outline und Timeline werden ausgeblendet.
- Eine installierte offizielle Codex-Extension (`openai.chatgpt`) in das rechte Panel verschieben.
  Ohne Extension erscheint eine Einführung mit Installation aus einer VSIX-Datei.
- Beim Ausschalten die vorherige Anordnung wiederherstellen. Persönliche Editor-Einstellungen
  werden dabei nicht überschrieben.

Entwicklungsfunktionen bleiben technisch vorhanden und über Befehle erreichbar.
Die erste Version ist ein Oberflächenprototyp; es gibt noch keinen fertigen Installer.

## Am einfachsten testen: im Browser

Voraussetzungen: Git, **Node.js 24** (mindestens die Version in `.nvmrc`), npm,
ein aktueller Chrome/Chromium oder Edge und einige GB freier Speicher.

```sh
git clone --depth 1 --branch codex/simple-icm-workspace https://github.com/marmor69/vscode.git simple-workspace
cd simple-workspace
node scripts/simple-workspace.ts --setup
node scripts/simple-workspace.ts --web
```

1. Öffne **http://localhost:8080**.
2. Drücke **F1**, suche **Toggle Simple Workspace** und bestätige mit Enter.
3. Öffne `START.md` links. Der mitgelieferte Beispielordner erklärt einen kleinen Workflow.
4. Bearbeite einen Text; öffne **More Actions → Live Preview** für die Markdown-Vorschau.
5. **Standard Interface** stellt die volle Oberfläche wieder her.

Das Setup installiert festgeschriebene JavaScript-Abhängigkeiten und baut die Web-Oberfläche
samt den für diese Demo benötigten Erweiterungen. Es installiert weder Electron noch native Module.
Es kann beim ersten Mal mehrere Minuten dauern. Nach reinen Änderungen an der Oberfläche reicht
`npm run build-fast -- --client-only`, danach die Browserseite neu laden.

**Die Browser-Demo dient zum Oberflächentest.** Der eingehängte Beispielordner wird im Speicher
bearbeitet; Änderungen werden nicht in die lokalen Beispieldateien zurückgeschrieben und können
beim Neuladen verloren gehen. Die Desktop-Codex-Extension läuft nicht in dieser reinen Web-Demo.
Für echte Arbeit und dauerhaft gespeicherte Dateien verwende den Desktop-Build.

## Desktop mit Codex testen

Verwende einen eigenen Checkout für den Desktop und folge zunächst den
[plattformabhängigen Build-Voraussetzungen von VS Code](https://github.com/microsoft/vscode/wiki/How-to-Contribute#prerequisites).
Dazu gehören je nach System native Build-Werkzeuge und Bibliotheken.

```sh
npm ci
npm run compile
./scripts/code.sh --user-data-dir .build/simple-workspace-user --extensions-dir .build/simple-workspace-extensions
```

Unter Windows lautet der letzte Aufruf `scripts\code.bat` mit denselben Argumenten.
Der erste Start lädt zusätzlich Electron und eingebaute Erweiterungen.
Verwende für diesen Weg **nicht** die Installation mit `--ignore-scripts` aus dem Web-Setup.

1. Aktiviere **Toggle Simple Workspace** über F1 oder setze
   **Workbench › Simple UI: Enabled** in den Einstellungen.
2. Besorge die offizielle Codex-VSIX über einen vom Herausgeber unterstützten Installationsweg;
   siehe [Codex IDE-Dokumentation](https://developers.openai.com/codex/ide/).
3. Wähle rechts **Install Extension File…**, installiere die Datei und lade bei Bedarf das Fenster neu.
4. **Open Codex → Codex** öffnet die installierte Extension rechts. Melde dich dort an.
5. Kopiere `examples/icm-starter` in deinen eigenen Arbeitsordner, öffne ihn über **Open Folder**
   und folge `START.md`.

Code – OSS hat hier keine konfigurierte Extension-Galerie. Die offizielle Extension wird weder
mitgeliefert noch durch einen eigenen Agenten ersetzt. Installation, Anmeldung und tatsächliche
Codex-Ausführung im Desktop-Fork müssen noch auf den Zielsystemen überprüft werden.
Die Extension bestimmt ihre eigenen Berechtigungen, Anmeldung und Kontovoraussetzungen.

## Beschriftungen anpassen

Die neue Oberfläche verwendet zentral verwaltete, lokalisierbare Texte.
Eigene Beschriftungen können jederzeit in den Benutzereinstellungen (`settings.json`) geändert werden:

```json
{
  "workbench.simpleUI.enabled": true,
  "workbench.simpleUI.agent": "openai.chatgpt",
  "workbench.simpleUI.labels": {
    "files": "Meine Dateien",
    "assistant": "Mein Assistent",
    "newDocument": "Neuer Text",
    "openFolder": "Ordner öffnen",
    "more": "Weitere Aktionen",
    "preview": "Live-Vorschau",
    "chooseAgent": "Codex öffnen",
    "installExtension": "Extension-Datei installieren…",
    "standardUI": "Vollständige Oberfläche"
  }
}
```

Die vollständigen Schlüssel und Tooltips stehen in
[`simpleUILabels.ts`](src/vs/workbench/contrib/simpleUI/browser/simpleUILabels.ts).
Diese Anpassung betrifft die neuen Bedienelemente; Texte innerhalb von Codex oder anderen
Extensions werden von deren Herausgebern verwaltet. Neue Texte sind zunächst auf Englisch;
die obigen Überschreibungen ermöglichen bereits eigene deutsche Bezeichnungen.

## ICM und Architektur

Der [Beispielordner](examples/icm-starter/START.md) trennt Auftrag/Kontext, Workflow und Ergebnis.
Das ist zunächst eine praktische Vorlage nach der Projektbeschreibung. Der genaue Abgleich mit dem
[bereitgestellten ICM-Guide](https://gist.github.com/LvlyBot/91c386584c99e4f3c300013d5cebaf78)
steht noch aus, weil der Zugriff in der Cloud-Umgebung blockiert war.
Die Ordnerstruktur ist eine Arbeitskonvention, keine technische Einschränkung des Agentenkontexts.

Die Änderungen liegen überwiegend in einer eigenen
[Workbench-Contribution](src/vs/workbench/contrib/simpleUI/README.md).
Dazu kommen ein Import, ein kleiner Explorer-Titel-Hook und die Registrierung für Übersetzungen.
Editor, Dateiverwaltung, Markdown-Erweiterung und Extension-Host bleiben Upstream-Komponenten.
Das hält den Fork klein und erleichtert die Übernahme neuer Upstream-Stände.

## Geprüfter Stand

- Browser-Setup vollständig ausgeführt; Client-Build, TypeScript-Prüfung und gezieltes ESLint bestanden.
- Vier Regressionstests zur Wiederherstellung der Einstellungen bestanden.
- Dateibaum, Markdown-Textansicht, Neuladen im einfachen Modus und Rückkehr zur vollständigen Oberfläche im Chromium-Browser geprüft.
- Tooltips, neue Markdown-Dokumente und Texteingabe geprüft; beim Moduswechsel bleibt der Text erhalten.
- Die Markdown-Vorschau wird geöffnet, ihr Inhalt konnte in der Cloud nicht geprüft werden:
  Der dortige Browser verweigert die Service-Worker-Registrierung der eingebauten Webview.
  Vorschau und visuellen Editor deshalb zusätzlich in einem lokalen Browser bzw. Desktop-Build prüfen.
- Offizielle Codex-Anmeldung und Agentenausführung im Desktop-Fork noch nicht getestet.

## Herkunft und Lizenz

Dies ist ein unabhängiger experimenteller Fork von
[Microsofts Code – OSS](https://github.com/microsoft/vscode), keine offizielle VS-Code- oder OpenAI-Distribution.
Der Quellcode steht unter der [MIT-Lizenz](LICENSE.txt); bestehende Copyright- und
[Drittanbieterhinweise](ThirdPartyNotices.txt) bleiben erhalten.
Die [Upstream-Dokumentation](https://github.com/microsoft/vscode/blob/main/README.md)
beschreibt das ursprüngliche Projekt.
