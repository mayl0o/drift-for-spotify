# Drift for Spotify

**An endless personal wave that learns from you and almost never repeats a song.**
A [Spicetify](https://spicetify.app) extension. Press one button — Drift keeps playing music you like and music you'll like, forever.

![Drift for Spotify](preview.png)

[English](#english) · [Русский](#русский)

---

## English

Spotify's autoplay kept looping the same ~50 songs for me, so I built the thing I actually wanted: one button and an endless wave that pays attention to what I like.

### What it does
- **One button, endless music.** A wave icon appears next to Shuffle. Click it — the queue never runs out.
- **Learns as you listen.** Likes pull the wave toward a sound; skips push it away. Fresh likes count more than old ones.
- **Almost no repeats.** The same song won't come back for a long time, and the same artist doesn't show up every few tracks.
- **Three characters:** *Favorites* (what you already love), *Discover* (new artists close to your taste), *Popular*.
- **Skips AI-generated tracks** — there are a lot of them on streaming services now.
- **Doesn't fight Spotify.** Drift adds one track at a time to the regular queue — Back, Like and your own "Add to queue" all work as usual.

### Install
1. Install [Spicetify](https://spicetify.app/docs/advanced-usage/installation) (Spotify from spotify.com, not the Microsoft Store).
2. Download Drift straight into the Extensions folder.
   Windows, in PowerShell:
   ```
   mkdir -Force "$env:APPDATA\spicetify\Extensions" | Out-Null; iwr https://raw.githubusercontent.com/mayl0o/drift-for-spotify/main/drift.js -OutFile "$env:APPDATA\spicetify\Extensions\drift.js"
   ```
   macOS / Linux, in Terminal:
   ```
   mkdir -p ~/.config/spicetify/Extensions && curl -fsSL https://raw.githubusercontent.com/mayl0o/drift-for-spotify/main/drift.js -o ~/.config/spicetify/Extensions/drift.js
   ```
   Or download [`drift.js`](drift.js) yourself and put it into `%appdata%\spicetify\Extensions` (Windows) or `~/.config/spicetify/Extensions` (macOS / Linux).
3. Run:
   ```
   spicetify config extensions drift.js
   spicetify apply
   ```
4. A wave icon appears next to the Shuffle button — click it.

**Update:** run the command from step 2 again, then `spicetify apply`. Drift tells you when a new version is out.
Spotify updated and Drift disappeared? Run `spicetify backup apply`.

### Want a bit more?
Some evenings you want a sad wave, some mornings — something to wake up to. That's what **Drift Pro** is for: a wave for a mood, an activity (working, workout, falling asleep), a language or any genre you type in, a wave built from any artist or playlist, saved waves you can start in one click, instant reaction to likes and a monthly recap of your listening.

It's 7 days free in [@Spotify_drift_bot](https://t.me/Spotify_drift_bot?start=trial), then a small subscription on [Boosty](https://boosty.to/meenbeens) — which is also what keeps Drift alive and getting better. The free version stays free, with no time limit.

Just want to say thanks? [☕ Support the author](https://boosty.to/meenbeens)

### Privacy
Free Drift has no server and no account. Besides Spotify itself it only downloads two public files from GitHub: a list of AI-generated artists to skip ([soul-over-ai](https://github.com/xoundbyte/soul-over-ai)) and, once a day, this repository's `manifest.json` to see if there's a new version. Nothing about you is sent.
Everything it learns (likes, skips, history) stays in your Spotify on your computer.
The code is readable — open [`drift.js`](drift.js) and see how the wave works. You can read and install it freely; please don't redistribute modified copies ([LICENSE](LICENSE)).

### Help
Something wrong or have an idea — write to [@Spotify_drift_bot](https://t.me/Spotify_drift_bot) or open an issue.
Step-by-step guide with screenshots: [Telegraph](https://telegra.ph/How-to-install-Drift-for-Spotify-11-02) · [Terms and Privacy](https://telegra.ph/Drift-for-Spotify--Terms-and-Privacy-11-02)

---

## Русский

Автоплей Spotify крутил одни и те же ~50 песен, поэтому я сделал то, чего мне не хватало: одна кнопка — и бесконечная волна, которая обращает внимание на то, что мне нравится.

### Что это
- **Одна кнопка — бесконечная музыка.** Рядом с «Перемешать» появляется значок волны. Нажми — и очередь не кончается.
- **Учится, пока слушаешь.** Лайк тянет волну к такому звучанию, скип — уводит. Свежие лайки весят больше старых.
- **Почти без повторов.** Песня долго не вернётся, а один артист не мелькает каждые несколько треков.
- **Три характера:** *Любимое* (то, что ты уже любишь), *Незнакомое* (новые артисты рядом с твоим вкусом), *Популярное*.
- **Пропускает музыку, сгенерированную нейросетями** — её в стримингах сейчас очень много.
- **Не ломает Spotify.** Drift ставит в обычную очередь по одному треку — «Назад», лайки и твоё «Добавить в очередь» работают как обычно.

### Установка
1. Поставь [Spicetify](https://spicetify.app/docs/advanced-usage/installation) (Spotify — с spotify.com, не из Microsoft Store).
2. Скачай Drift сразу в папку расширений.
   Windows, в PowerShell:
   ```
   mkdir -Force "$env:APPDATA\spicetify\Extensions" | Out-Null; iwr https://raw.githubusercontent.com/mayl0o/drift-for-spotify/main/drift.js -OutFile "$env:APPDATA\spicetify\Extensions\drift.js"
   ```
   macOS / Linux, в Терминале:
   ```
   mkdir -p ~/.config/spicetify/Extensions && curl -fsSL https://raw.githubusercontent.com/mayl0o/drift-for-spotify/main/drift.js -o ~/.config/spicetify/Extensions/drift.js
   ```
   Или скачай [`drift.js`](drift.js) сам и положи в `%appdata%\spicetify\Extensions` (Windows) или `~/.config/spicetify/Extensions` (macOS / Linux).
3. Выполни:
   ```
   spicetify config extensions drift.js
   spicetify apply
   ```
4. Рядом с кнопкой «Перемешать» появится значок волны — нажми его.

**Обновление:** снова выполни команду из шага 2, потом `spicetify apply`. О новой версии Drift скажет сам.
Spotify обновился и Drift пропал — выполни `spicetify backup apply`.

### Хочется чуть большего?
Вечером хочется грустную волну, утром — что-то, под что проснуться. Для этого есть **Drift Pro**: волна под настроение, занятие (работа, тренировка, засыпаю), язык или любой жанр, который впишешь сам, волна по любому артисту или плейлисту, сохранённые волны в один клик, мгновенная реакция на лайк и итог месяца — что ты слушал и что открыл.

7 дней бесплатно в [@Spotify_drift_bot](https://t.me/Spotify_drift_bot?start=trial), дальше — небольшая подписка на [Boosty](https://boosty.to/meenbeens). На неё же Drift и живёт и развивается. Бесплатная версия остаётся бесплатной и без ограничений по сроку.

Просто хочешь сказать спасибо? [☕ Поддержать автора](https://boosty.to/meenbeens)

### Приватность
У бесплатного Drift нет сервера и аккаунта. Кроме самого Spotify он скачивает только два открытых файла с GitHub: список ИИ-артистов, которых волна пропускает ([soul-over-ai](https://github.com/xoundbyte/soul-over-ai)), и раз в сутки `manifest.json` этого репозитория — проверить новую версию. О тебе ничего не отправляется.
Всё, что он узнаёт (лайки, скипы, история), остаётся в твоём Spotify на твоём компьютере.
Код открыт для чтения — загляни в [`drift.js`](drift.js) и посмотри, как устроена волна. Читать и ставить можно свободно; распространять изменённые копии — нет ([LICENSE](LICENSE)).

### Помощь
Что-то не так или есть идея — пиши в [@Spotify_drift_bot](https://t.me/Spotify_drift_bot) или открой issue.
Инструкция со скриншотами: [Telegraph](https://telegra.ph/Kak-ustanovit-Drift-for-Spotify-11-02) · [Условия и конфиденциальность](https://telegra.ph/Drift-for-Spotify--usloviya-i-konfidencialnost-11-02)

---
Spotify is a trademark of Spotify AB. Drift is not affiliated with Spotify. © 2026 bayok — see [LICENSE](LICENSE).
