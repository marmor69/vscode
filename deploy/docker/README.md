# Im Browser mit Dateien, Terminal und Codex arbeiten

Dieser Weg baut den vollständigen **Code – OSS Web-Server** aus diesem Fork. Die
Extensions und Agenten laufen im Linux-Container; der Browser zeigt die Oberfläche.
Dateien werden im Arbeitsvolume gespeichert. Dies ist ein anderer Betriebsweg als
der JavaScript-Web-Teststarter, dessen Beispieldateien nur im Speicher bearbeitet werden.

## Dokploy einrichten

1. Erstelle in Dokploy einen **Compose-Service mit Git-Quelle**.
2. Repository: `https://github.com/marmor69/vscode.git`, Branch: `main`.
3. Compose-Pfad: `compose.yml`, Build-Kontext: die Repository-Wurzel.
4. Trage unter **Environment** folgende Werte ein:

   ```dotenv
   ICM_CONNECTION_TOKEN=HIER_EINEN_EIGENEN_LANGEN_TOKEN_EINTRAGEN
   ICM_INSTALL_CODEX=true
   ICM_PUBLIC_PORT=443
   ```

   Der Token muss mindestens 32 Zeichen aus Buchstaben, Ziffern, `_` oder `-` haben.
   Einen passenden zufälligen Token kannst du auf deinem Rechner mit
   `openssl rand -hex 32` erzeugen. Verwende einen eigenen Token pro Installation.

   **Hinter Cloudflare Access ohne zusätzlichen Token:** Setze stattdessen
   `ICM_AUTH_MODE=proxy`. `ICM_CONNECTION_TOKEN` kann dann entfallen; öffne die
   normale HTTPS-Adresse ohne `?tkn=…`. Cloudflare Access muss die gesamte Domain
   einschließlich WebSockets schützen, und der Container darf nicht direkt öffentlich
   erreichbar sein. Der Server prüft in diesem Modus selbst keine Anmeldung.
   Mit `ICM_AUTH_MODE=token` (Standard) ist der Token weiterhin erforderlich.

   `ICM_PUBLIC_PORT` ist der öffentliche Browser-Port, bei HTTPS normalerweise `443`.
   Das Compose setzt diesen Wert bereits standardmäßig. Er überschreibt den vom Proxy
   gemeldeten Port; der Container hört weiterhin intern auf HTTP-Port `8080`.
   Dies ist insbesondere hinter Cloudflare Access oder einem Tunnel mit HTTP-Verbindung
   zu Traefik wichtig: Ein intern weitergereichter Port `80` darf nicht als öffentlicher
   WebSocket-Port verwendet werden. Bei einem anderen öffentlichen HTTPS-Port passe
   den Wert entsprechend an.

5. Lege eine HTTPS-Domain an, die auf den Service **icm-web**, Container-Port
   **8080** zeigt. Verwende eine eigene Subdomain am Pfad `/`, beispielsweise
   `https://icm.example.org`. Dokploy/Traefik muss WebSockets weiterleiten.
6. Deploye den Service. Der erste Build kompiliert den Server und seine Extensions
   und dauert erheblich länger als ein Container-Neustart.
7. Öffne im Token-Modus beim ersten Zugriff:

   ```text
   https://icm.example.org/?tkn=DEIN_TOKEN
   ```

   Der Server setzt ein Zugangscookie und entfernt den Token aus der Browser-URL.
   Die bloße URL ohne gültigen Zugang liefert zunächst `Forbidden`; das ist beabsichtigt.
   Nach einem Tokenwechsel musst du dich mit dem neuen Link erneut anmelden.

Das Compose nutzt das vorhandene externe Netzwerk `dokploy-network`. Es veröffentlicht
keinen Port direkt auf dem VPS. Zugang zu Domain und Shell gilt für den gesamten
Container; verwende für unabhängige Nutzer getrennte Deployments mit eigenen Volumes
und Tokens.

Das Compose verwendet das mitgelieferte [seccomp-Profil](../../docs/docker/seccomp.json).
Es erweitert Dockers Standardfilter um die Namespace- und Mount-Aufrufe für Codex'
Linux-Sandbox. Der Container läuft weiterhin ohne Root-Rechte, ohne zusätzliche
Capabilities und mit `no-new-privileges`; die übrigen Filterregeln bleiben erhalten.
Das Profil basiert auf
[moby/profiles, Stand 4b8214f](https://github.com/moby/profiles/blob/4b8214fc4971e06172938a1f1554ccff6647ee80/seccomp/default.json)
unter der mitgelieferten [Apache-2.0-Lizenz](../../docs/docker/LICENSE.seccomp).

Für den Source-Build empfehlen wir mindestens **8 GB freien RAM und 20 GB freien
Platz**, bei kleinen VPS den Image-Build auf einem größeren Rechner. Der laufende
Server braucht deutlich weniger Ressourcen. Der Docker-Build unterstützt Linux
`amd64` und `arm64`; verwende möglichst die native Architektur deines Build-Rechners.

## Daten bleiben bei Neustart und Redeploy erhalten

| Volume | Container-Pfad | Inhalt |
| --- | --- | --- |
| `icm-workspaces` | `/workspaces` | Arbeitsordner, Kontext, Workflows und Ergebnisse |
| `icm-home` | `/home/node` | Server-Einstellungen, installierte Extensions, Agentenanmeldung und CLI-Konfiguration |

Ansicht und lokale Browser-Einstellungen speichert die Web-Oberfläche zusätzlich
in den Daten des jeweiligen Browsers. Verwende dieselbe Domain; ein anderer Browser
oder gelöschte Website-Daten können diese Einstellungen zurücksetzen.

Der Container läuft als Nutzer `node` mit UID/GID 1000. Die Named Volumes bekommen
beim ersten Start die passenden Rechte. Bei eigenen Bind-Mounts muss der Host-Ordner
für UID 1000 schreibbar sein.

Dokploy-Neustarts und normale Redeploys behalten diese Volumes. Sichere beide Volumes
vor Änderungen am Deployment. **Volumes löschen**, `docker compose down --volumes`
oder ein Deployment unter einem neuen Compose-Projektnamen können die bisherigen
Daten entfernen bzw. andere Volumes verwenden.

Die VS-Code-Dateiverwaltung und der Agent sehen dieselben Dateien unter `/workspaces`.
Beim ersten Start wird
[`RinDig/Interpretable-Context-Methodology`](https://github.com/RinDig/Interpretable-Context-Methodology)
als **`/workspaces/Beispiel-Projekt`** geklont. Das ist eine Vorlage zum Ausprobieren;
lege für eigene Arbeit einen eigenen Ordner an. Über **Open Folder** kannst du das
Beispiel-Projekt gezielt öffnen und dadurch den Kontext des Agenten darauf begrenzen.
Prüfe die Vorlage, bevor du ihr Workspace-Vertrauen erteilst.

Ein vorhandenes `Beispiel-Projekt` wird weder überschrieben noch automatisch aktualisiert.
Mit `ICM_INIT_EXAMPLE=false` lässt sich der Download abschalten. Bei einem Netzwerkfehler
startet die App trotzdem; der nächste Start versucht den Download erneut. Die Vorlage
wird auch bei bestehenden Installationen ergänzt, sofern der Zielordner fehlt.

Die kleinere mitgelieferte Vorlage bleibt zusätzlich unter
`/opt/simple-workspace/examples/icm-starter` verfügbar.

## Codex-Modelle und Updates

Die Modellauswahl stammt aus der offiziellen Codex-Extension und ihrem Agentenprozess;
der Fork schränkt sie nicht ein. Verfügbare Modelle hängen von Konto, Tarif,
Workspace-Freigaben und Client-Version ab. Aktuelle Informationen stehen in der
[OpenAI-Modellübersicht](https://developers.openai.com/codex/models/).

Ein Redeploy aktualisiert bereits installierte Extensions nicht automatisch.
Prüfe unter **Extensions → Codex** die Version und suche über **Check for Extension
Updates** nach Updates. Unser Katalog ist Open VSX; dessen verfügbare Versionen können
vom Microsoft Marketplace abweichen. Alternativ kannst du eine offizielle, passende
VSIX-Datei über **Install Extension File…** installieren. Nach dem Update lade die
App mit **Developer: Reload Window** neu. Bleibt ein Modell unsichtbar, prüfe, ob Codex
mit dem erwarteten ChatGPT-Konto oder einem API-Key angemeldet ist; die Freigaben
können sich unterscheiden. Eine separate globale CLI-Installation aktualisiert
nicht den mit der Extension gebündelten Agenten.

## Office-Dateien

Die Extension `cweijan.vscode-office` wird standardmäßig automatisch installiert,
auch beim nächsten Start bestehender Installationen. `ICM_INSTALL_OFFICE=false`
schaltet die automatische Installation ab. Bereits installierte Extensions bleiben erhalten.
`vscode-office.enableTelemetry` ist in der Web-App standardmäßig `false`; neue
Serverprofile erhalten diese Einstellung zusätzlich in ihren Settings. Bestehende
Settings-Dateien werden erhalten; explizite Nutzer- oder Workspace-Einstellungen
können den Standard überschreiben.

## Codex und weitere Agenten

Mit `ICM_INSTALL_CODEX=true` installiert der erste Start die Extension
`openai.chatgpt` aus Open VSX, sofern sie noch fehlt. Die Anmeldung erfolgt anschließend
rechts in der Extension. Ein Installationsfehler verhindert den Serverstart nicht;
du kannst die Extension dann über **Extensions** oder aus einer offiziellen `.vsix`
installieren. Automatische Installation lässt sich mit `ICM_INSTALL_CODEX=false`
ausschalten. Bereits installierte Extensions bleiben erhalten.

Code–OSS enthält Microsofts proprietären Extension-Signaturprüfer nicht. Deshalb
setzt der erste Start in neuen Serverprofilen `extensions.verifySignature=false`;
Downloads erfolgen weiterhin über HTTPS mit Zertifikatsprüfung. Bestehende
Einstellungsdateien werden nicht überschrieben. Falls dort die Signaturprüfung
aktiviert ist, können Open-VSX-Installationen mit `Signature verification was not
executed` scheitern. Die CLI liest `server/data/User/settings.json`, der laufende
Server `server/data/Machine/settings.json` unter `/home/node/.local/share/simple-workspace`.

Codex bringt seinen Agentenprozess mit; für die GUI ist keine zusätzliche globale
Codex-CLI notwendig. Kontovoraussetzungen und Anmeldung werden von der Extension
verwaltet. Der Server aktiviert die von der offiziellen Codex-Extension benötigten
experimentellen VS-Code-APIs gezielt für `openai.chatgpt`. Die Anmeldung muss auf
der tatsächlichen Dokploy-Domain geprüft werden. Das Docker-Image enthält keine
Anmeldedaten oder API-Schlüssel.

Falls **Restricted Mode** angezeigt wird, öffne **Manage** und vertraue deinem
eigenen Arbeitsordner über **Trust**, damit Codex aktiviert werden kann. Die
Arbeitsordner-Vertrauensprüfung bleibt eingeschaltet.

Weitere Extensions lassen sich im Open-VSX-Katalog installieren. Falls du zusätzlich
eine CLI verwenden möchtest, öffne ein Terminal über **F1 → Terminal: Create New
Terminal** oder die Dokploy-Container-Shell. Node.js, npm, Bash, Git, curl, SSH-Client,
ripgrep und bubblewrap für die Linux-Sandbox sind vorhanden. Beispielsweise:

```sh
npm install -g @openai/codex
codex --version
```

Auf einem VPS verwende **Use device code** in der Codex-Anmeldeansicht:

1. Brich eine bereits gestartete normale Browser-Anmeldung ab und öffne Codex erneut.
2. Wähle **Use device code** (je nach Version unter **More options**).
3. Öffne den angezeigten Link im Browser und bestätige den angezeigten Einmalcode.
4. Kehre zur App zurück; Codex übernimmt die Anmeldung ohne localhost-Rückleitung.

OpenAI dokumentiert diesen Weg für
[entfernte Server](https://developers.openai.com/codex/auth/#login-on-headless-devices).
Device-Code-Anmeldung muss gegebenenfalls zuerst in den ChatGPT-Sicherheitseinstellungen
bzw. vom Workspace-Administrator aktiviert werden.

Die normale Browser-Anmeldung nutzt eine von OpenAI registrierte Loopback-Rückleitung
(z. B. `http://localhost:1455/auth/callback`). Die offizielle Extension bietet keine
Einstellung für eine eigene öffentliche Redirect-URL. Eine Proxy-URL als Env-Variable
ändert diese OAuth-Rückleitung nicht. `ICM_PUBLIC_PORT` betrifft die Workbench-Verbindung,
`ICM_AUTH_MODE=proxy` die vorgeschaltete Anmeldung an der App; beide sind unabhängig
von der Codex-Kontoanmeldung. Veröffentliche den kurzlebigen OAuth-Callback-Server
nicht als zusätzlichen Dokploy-Port.

Falls du eine separat installierte CLI nutzt, kannst du alternativ im Container
`codex login --device-auth` aufrufen. CLI und Extension verwenden das persistente
Nutzerverzeichnis. Die Kontoanmeldung muss auf deiner Installation geprüft werden.

Globale npm-Installationen des Nutzers landen in `/home/node/.local` und bleiben im
Profilvolume erhalten. Claude Code kann über den vom Hersteller dokumentierten
Linux-Installationsweg und seine offizielle Extension ergänzt werden. Die vereinfachte
Oberfläche richtet zunächst Codex im rechten Panel ein.

## Lokal mit Docker testen

Der gleiche Dockerfile funktioniert auch ohne Dokploy:

```sh
git clone --depth 1 https://github.com/marmor69/vscode.git simple-workspace
cd simple-workspace
docker build -t simple-workspace .
```

Setze `ICM_CONNECTION_TOKEN` auf einen eigenen zufälligen Token, beispielsweise mit
`export ICM_CONNECTION_TOKEN="$(openssl rand -hex 32)"`, und starte:

```sh
docker run --name icm-web --init --restart unless-stopped \
  --security-opt no-new-privileges --cap-drop ALL \
  --security-opt seccomp=./docs/docker/seccomp.json \
  -p 127.0.0.1:8080:8080 \
  --env ICM_CONNECTION_TOKEN --env ICM_INSTALL_CODEX=true \
  --volume icm-workspaces:/workspaces \
  --volume icm-home:/home/node \
  simple-workspace
```

Öffne `http://localhost:8080/?tkn=DEIN_TOKEN`. HTTPS ist für eine entfernte Domain
und für Browserfunktionen wie Webviews erforderlich; localhost ist für den lokalen
Test ausgenommen. Der Container wird gesund, wenn `/version` antwortet.

## Updates und Fehlerdiagnose

Für Updates deploye einen neuen Stand von `main`. Der Server wird **beim Image-Build**
kompiliert; beim Start gibt es keine erneute npm-Installation des Projekts. Einstellungen,
Dokumente und installierte Extensions kommen aus den bestehenden Volumes.

Bei einer nachträglich gesetzten Einstellung `workbench.simpleUI.enabled=false`
bleibt die normale Ansicht erhalten. Aktiviere **Simple Workspace** im Zahnradmenü,
um wieder zur einfachen Ansicht zu wechseln.

- **Forbidden:** Rufe die URL einmal mit `?tkn=...` auf; prüfe den gesetzten Token.
- **Dauerhaftes Laden / reconnect:** Prüfe Domain, Port 8080 und die WebSocket-Weiterleitung.
- **WebSocket-Code 1006:** Der Code bedeutet einen Verbindungsabbruch, nicht dessen
  Ursache. Schließe alte Tabs und lade nach einem Redeploy mit `Strg+Umschalt+R` neu.
  Prüfe in den Browser-Entwicklerwerkzeugen unter **Network → WS** die tatsächlich
  verwendete URL und den HTTP-Status: Bei einer HTTPS-Domain muss die Verbindung
  `wss://` mit der öffentlichen Domain und ihrem öffentlichen Port verwenden.
  `101` bedeutet, dass der Proxy das Upgrade angenommen hat; `404` weist auf Routing,
  `502` auf den Backend-Zugang und `401/403` auf Zugangsschutz hin. Ohne HTTP-Antwort
  kommen beispielsweise TLS-, Port- oder Browser-Verbindungsfehler infrage.
  Servermeldungen `version mismatch` und `auth mismatch` unterscheiden einen alten
  Browser-Stand von einem ungültigen Zugang. Entferne Zugangstoken aus Logs und URLs,
  bevor du diese zur Fehlerdiagnose weitergibst.
- **WebSocket-Code 1015 / `SSL_ERROR_RX_RECORD_TOO_LONG`:** Prüfe die WebSocket-URL.
  `wss://...:80` versucht TLS auf einem HTTP-Port. Setze für den normalen HTTPS-Zugang
  `ICM_PUBLIC_PORT=443` und deploye den aktuellen Stand mit neuem Image-Build. Erwartet
  wird `wss://DEINE-DOMAIN/` bzw. Port `443`. Die interne Verbindung zwischen Proxy
  und Container bleibt HTTP auf Port `8080`; Cloudflare Access bleibt vorgeschaltet.
- **`File not found: .../extensions/.../dist/browser/...`:** Dieser Fehler wurde im
  Docker-Build durch die zusätzliche Kompilierung der Browser-Extensions behoben.
  Deploye einen aktuellen Stand und baue das Image neu; ein Container-Neustart allein
  ersetzt die Dateien des Images nicht.
- **Nicht schreibbare Dateien:** Prüfe die Rechte des Volumes bzw. Bind-Mounts für UID 1000.
- **Build abgebrochen:** Prüfe den ersten Fehler im Build-Log und freien RAM/Platz.
- **Codex-Anmeldung:** Verwende die Anmeldung innerhalb der Extension. Eine Rückleitung
  auf `localhost` bezeichnet bei einem entfernten Server möglicherweise den Container;
  prüfe den von OpenAI für Remote-Nutzung angebotenen Anmeldeweg.
- **Codex-Sandbox / `No permissions to create a new namespace`:** Prüfe, dass das
  mitgelieferte seccomp-Profil verwendet wird. Auch der VPS-Kernel muss unprivilegierte
  User-Namespaces erlauben; auf manchen Ubuntu-Hosts braucht bubblewrap ein passendes
  AppArmor-Profil. OpenAI beschreibt die
  [Linux-Voraussetzungen](https://developers.openai.com/codex/concepts/sandboxing#prerequisites).
  Ein Docker-Image kann diese Host-Einstellungen nicht selbst ändern.
- **`renderer_ready_timeout` / leere Codex-Ansicht:** Ein alter CDN-Stand der
  VS-Code-Webview konnte den vom Fork erwarteten Handshake nicht liefern. Die
  Produktkonfiguration verwendet jetzt den passenden, fest gepinnten Stand
  `e9eaf94e8bb01badde47d2518e16d3e1cdab1dd9`. Baue das Image neu und lade die Seite
  mit **Strg+Umschalt+R** neu. Die Browser-Netzwerkanalyse sollte Webview-Dateien
  unter `https://<kennung>.vscode-cdn.net/insider/e9eaf94…/` laden.
  Bei weiteren Problemen prüfe **Ansicht → Ausgabe → Codex**, **Log (Remote Extension
  Host)** und die Browser-Konsole der App. `Initialize received` bestätigt den Start
  des Agentenprozesses, aber noch nicht den Start der Webview. Eine `401` beim Laden
  des Featured-Plugin-Katalogs vor der Anmeldung ist ein separates Problem.
- **Leere Codex-Ansicht / Service-Worker-Fehler:** Verwende HTTPS und einen Browser,
  dessen Einstellungen Service Workers und die Webview-Ressourcen erlauben.

Der bisherige Compose mit `@vscode/test-web`, CommonJS-Umschreibung und Koa-Protokoll-Patch
wird durch diesen Serverbetrieb ersetzt. Diese Patches werden hier nicht benötigt.

Für Builds in einer Umgebung mit einem eigenen HTTPS-Proxy kann dessen CA als optionales
BuildKit-Secret `proxy_ca` übergeben werden. Das Zertifikat wird nur während des Builds
verwendet und nicht in das fertige Image kopiert.

## Umfang der Prüfung

Auf Linux `amd64` wurden Docker-Build, Compose-Start, Zugangstoken, Cookie-Anmeldung,
Reverse-Proxy-Domain, native Terminalprozesse, persistente Dateien und die automatische
Codex-Installation geprüft. Der mitgelieferte Codex-Prozess konnte innerhalb seiner
Linux-Sandbox Dateien im Arbeitsordner lesen und schreiben. Im Browser wurden die
vereinfachte Oberfläche, die Activity Bar, Codex im rechten Panel und das Speichern
einer Markdown-Datei auf dem Server geprüft. Dokumente, Server-Einstellungen und
installierte Extensions blieben nach einem Neustart erhalten.
Zusätzlich wurden alle 20 ausgelieferten Browser-Extension-Einstiegspunkte über HTTP
mit Status `200` geprüft, ebenso die lokale Workbench-WebSocket-Verbindung und das
Speichern einer Datei über diese Verbindung.
Für den Betrieb hinter mehreren Proxies wurde zusätzlich eine HTTPS-Terminierung
mit intern weitergereichtem Port `80` nachgebildet: Die Workbench verwendete den
konfigurierten öffentlichen Port, und der WSS-Verbindungsaufbau gelang mit aktiver
Zertifikatsprüfung.

Nach Aktualisierung der Webview-CDN-Version wurde die Codex-Anmeldeoberfläche in
Chromium erfolgreich geladen („Sign in with ChatGPT“, „Use API Key“, „Use device code“).
Dafür wurden im vorhandenen Testimage der Startskript und die eingebettete
Produktkonfiguration aktualisiert; ein erneuter vollständiger Quellcode-Build wurde
für diese Konfigurationsänderung nicht durchgeführt. Ebenfalls geprüft: Zugriff im
Proxy-Modus ohne Token, Token-Modus mit `403` ohne Anmeldung und erfolgreichem
Cookie-Login, Ablehnung ungültiger Auth-Modi sowie Download und Erhalt des Beispiel-Projekts.
Kontoanmeldung und eine KI-Aufgabe auf einer echten Dokploy-HTTPS-Domain sowie
`arm64` sind noch nicht verifiziert.
