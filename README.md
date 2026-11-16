# GYM RAT

Dwie aplikacje na telefon (PWA) dla trenera i klientów. Teksty są po polsku. Obie korzystają z jednej bazy: plan, który trener wpisze, od razu jest u klienta, a odhaczenie ćwiczenia (zielony X i przekreślenie) jest wspólne.

| Aplikacja | Kto | Adres |
| --- | --- | --- |
| **GYM RAT SPLINTER** | trener | `/trener` |
| **GYM RAT** | klient | `/c/<token>` z maila |

To jeden projekt Next.js i jeden deploy. Osobne manifesty PWA dają dwie ikony na ekranie telefonu.

## Szybki start lokalnie (bez kont)

Potrzebny jest Node.js 20+.

```bash
npm install
npm run dev
```

Otwórz [http://localhost:3000/trener](http://localhost:3000/trener).

Zaloguj się jednym z adresów:

- `tomaszstefaniszyn9@gmail.com`
- `czulosc.joga@gmail.com`

Hasła nie ma. Serwer sprawdza adres na allowliście i zapisuje sesję w ciasteczku. Inny adres dostaje komunikat „Ten adres nie ma dostępu do panelu trenera.”

Baza lokalna to wbudowany Postgres (PGlite) w katalogu `data/pglite`. Nic nie trzeba stawiać. Katalog `data/` nie trafia do gita.

### Zaproszenie bez konta pocztowego

Zostaw puste `GMAIL_USER`, `GMAIL_APP_PASSWORD` i `RESEND_API_KEY`. Po wysłaniu zaproszenia:

- w oknie „WYŚLIJ ZAPROSZENIE” pojawia się link (można go skopiować),
- ta sama treść wpada do logu serwera, z prefiksem `[gym-rat]`.

Treść maila jest dokładnie taka:

> Cześć, zapraszam Cię do Twojego panelu treningowego w aplikacji Gym Rat. Kliknij w poniższy link, aby otworzyć swój plan treningowy

i pod spodem link `https://…/c/<token>`.

### Dane z makiety

```bash
npm run db:seed
```

Wstawia Alinę, Pawła, Marię, Krzyśka i Zuzię oraz treningi jak na makiecie. **Kasuje wszystkich klientów w tej bazie.** Na bazie innej niż lokalna skrypt odmawia pracy, dopóki nie ustawisz `ALLOW_SEED=1`. Zatrzymaj `npm run dev` na czas seeda — plik PGlite może być otwarty tylko przez jeden proces. Link Krzyśka wypisze się w konsoli i w `data/demo-links.json`.

Sprawdzenie API (serwer musi już działać):

```bash
npm run e2e
```

## Jak z tego korzystać

**Trener**

1. Wejście mailem z allowlisty.
2. Lista klientów. `+` otwiera „WYŚLIJ ZAPROSZENIE:” (imię i e-mail).
3. Szare kółko przy kliencie otwiera galerię telefonu (`input` z `accept="image/*"`) i zapisuje zdjęcie.
4. Pod imieniem widać treningi i datę dodania, np. `Trening A - 30.10.2025`.
5. Wejście w kafelek: „Klient od &lt;data&gt;”, „Dodaj trening +”, pigułki treningów.
6. Trening to tabela BLOK, ĆWICZENIE, SERIE, REPS, O. Nagłówki są stałe. „Dodaj ćwiczenie +” dokłada wiersz. Pozostałe komórki edytuje się dotknięciem, zapis jest automatyczny. Kolumna O to kwadrat: dotknięcie stawia zielony X i przekreśla wiersz, kolejne dotknięcie cofa. Wiersz w edycji ma „×”, na dole jest „Usuń trening”.

**Klient**

1. Otwiera link z maila. Token jest długi i nie do zgadnięcia.
2. Telefon zapamiętuje klienta (ciasteczko na rok oraz `localStorage`), więc ikona PWA otwiera ten sam plan.
3. Ekran główny: logo i „GYM RAT”, pigułki treningów dodanych przez trenera.
4. Tabela jest tylko do odczytu, poza kolumną O — klient odhacza tak samo jak trener. Stan jest jeden, w bazie.

Gdy klient wejdzie na `/panel` bez linku, zobaczy prośbę o otwarcie maila. Jeśli telefon już pamięta token, `/panel` przenosi do planu.

## Konta, sekrety i deploy

Do działania u ludzi potrzebne są Supabase, Vercel i konto Gmail. Lokalnie żadne nie jest wymagane.

| Usługa | Po co | Sekret |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Postgres (dane i, jeśli nie używasz Storage, także zdjęcia) | `DATABASE_URL` |
| [Supabase Storage](https://supabase.com/docs/guides/storage) | opcjonalnie pliki zdjęć | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` |
| Gmail (zalecane) | maile z zaproszeniem, bez własnej domeny | `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
| [Resend](https://resend.com) | maile, gdy masz zweryfikowaną domenę | `RESEND_API_KEY`, `EMAIL_FROM` |
| [Vercel](https://vercel.com) | hosting | zmienne poniżej |

Wygeneruj sekret sesji:

```bash
openssl rand -base64 32
```

### Zmienne środowiskowe

Wszystkie są w `.env.example`. Na Vercelu wpisz je w Settings → Environment Variables. Lokalnie skopiuj do `.env.local` tylko te, których chcesz użyć.

| Zmienna | Wymagana na produkcji | Znaczenie |
| --- | --- | --- |
| `DATABASE_URL` | tak | Connection string Postgresa. Puste lokalnie = PGlite. |
| `SESSION_SECRET` | tak, min. 16 znaków | Podpis ciasteczka trenera. Bez tego produkcja nie wstanie. |
| `APP_URL` | zalecana | Adres publiczny bez końcowego slasha, np. `https://gym-rat.vercel.app`. Linki w mailach. Gdy puste, używany jest host żądania. |
| `TRAINER_EMAILS` | nie | Allowlista, po przecinku. Puste = dwa adresy z makiety. |
| `GMAIL_USER` | zalecane do maili | Adres Gmail, z którego wychodzą zaproszenia. Nadawca: „Gym Rat”. |
| `GMAIL_APP_PASSWORD` | razem z `GMAIL_USER` | Hasło aplikacji Google (nie hasło do konta). |
| `RESEND_API_KEY` | nie, gdy jest Gmail | Zapasowy dostawca. Używany tylko, gdy brak `GMAIL_*`. |
| `EMAIL_FROM` | gdy jest klucz Resend | Nadawca Resend, np. `Gym Rat <zaproszenia@twojadomena.pl>`. |
| `SUPABASE_URL` | nie | Adres projektu, gdy zdjęcia mają iść do Storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | nie | Klucz `service_role` (sekret, tylko serwer). |
| `SUPABASE_BUCKET` | nie | Nazwa bucketu. Domyślnie `avatars`. |

### 1. Supabase (baza)

1. Załóż projekt. Region `eu-central-1` (Frankfurt) jest blisko Polski.
2. Project Settings → Database → Connection string.
3. Wybierz **Session pooler** (port **5432** na hoście `pooler.supabase.com`), nie transaction pooler (port 6543).
4. Dopisz `?sslmode=require`, jeśli go nie ma.
5. Wklej ten URI jako `DATABASE_URL`.

Tabele (`clients`, `workouts`, `exercises`) tworzą się same przy pierwszym wejściu (`CREATE TABLE IF NOT EXISTS`). Można je też założyć wcześniej z komputera:

```bash
DATABASE_URL="postgresql://..." npm run db:migrate
```

Zdjęcia klientów domyślnie lądują w kolumnie w tej samej bazie (wystarczy sam Postgres). Osobny bucket jest opcjonalny.

### 2. Supabase Storage (opcjonalnie)

1. Storage → New bucket → nazwa `avatars`, **prywatny** (bez publicznego odczytu).
2. Project Settings → API: skopiuj Project URL (`SUPABASE_URL`) i klucz `service_role` (`SUPABASE_SERVICE_ROLE_KEY`).
3. Aplikacja wgrywa i odczytuje pliki tym kluczem po stronie serwera. Nie ustawiaj go jako `NEXT_PUBLIC_`.

Gdy upload do Storage się nie uda, trener zobaczy błąd i zdjęcie nie zniknie z poprzedniej wersji.

### 3. Gmail (zalecane — bez własnej domeny)

Zaproszenia wychodzą ze zwykłego konta Gmail przez SMTP (`smtp.gmail.com`, port 465). W skrzynce klienta nadawca nazywa się **Gym Rat**, a adres to `GMAIL_USER`. Własna domena nie jest potrzebna.

1. Włącz weryfikację dwuetapową: [myaccount.google.com/signinoptions/two-step-verification](https://myaccount.google.com/signinoptions/two-step-verification). Bez niej Google nie pokaże haseł aplikacji.
2. Otwórz [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Utwórz hasło aplikacji (nazwa np. „Gym Rat”). Google pokaże 16 znaków, często ze spacjami.
4. Ustaw:
   - `GMAIL_USER` — pełny adres, np. `tomaszstefaniszyn9@gmail.com`
   - `GMAIL_APP_PASSWORD` — te 16 znaków (spacje można zostawić)

Hasło do logowania na Gmaila tu nie działa. Konto firmowe Google Workspace może mieć hasła aplikacji wyłączone przez administratora — wtedy trzeba je włączyć w konsoli Workspace albo użyć Resend.

Zwykłe konto Gmail wysyła przez SMTP do około **500 wiadomości na dobę**. Dla zaproszeń klientów to duży zapas, ale to nie jest poczta masowa: przy nagłym ruchu Google może wysyłkę czasowo zatrzymać.

Gdy ustawione są i Gmail, i Resend, idzie Gmail.

### 4. Resend (opcjonalnie, gdy masz domenę)

1. Załóż konto i weź API key → `RESEND_API_KEY`.
2. Dodaj i zweryfikuj własną domenę (DNS: SPF i DKIM, Resend pokazuje rekordy).
3. `EMAIL_FROM` ustaw na adres z tej domeny, np. `Gym Rat <zaproszenia@twojadomena.pl>`.

Bez zweryfikowanej domeny Resend pozwala wysyłać tylko z `onboarding@resend.dev` i **tylko na adres właściciela konta Resend**. Dlatego przy braku domeny zostaw Resend puste i użyj Gmaila.

Logika wysyłki jest w `src/lib/email.ts`. Zdanie zaproszenia jest w `src/lib/invite.ts`.

### 5. Vercel

1. Wypchnij repozytorium na GitHuba.
2. [vercel.com/new](https://vercel.com/new) → Import. Framework: Next.js. Build: `npm run build`. Node 20+.
3. Wpisz zmienne z tabeli (przynajmniej `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, a do maili `GMAIL_USER` i `GMAIL_APP_PASSWORD`). Wysyłka działa na Node.js (nie na Edge).
4. Deploy.
5. `APP_URL` ustaw na dokładny adres produkcji (np. `https://twoj-projekt.vercel.app`) i zrób redeploy, jeśli dopisałeś go po pierwszym buildzie.
6. Wejdź na `https://twoj-adres/trener` i zaloguj się mailem z allowlisty.

Vercel daje HTTPS, którego PWA wymaga poza localhostem.

### Instalacja na telefonie

**Trener (GYM RAT SPLINTER)**

- iPhone: Safari → `https://twoj-adres/trener` → Udostępnij → Do ekranu początkowego.
- Android: Chrome → menu → Zainstaluj aplikację / Dodaj do ekranu głównego.

**Klient (GYM RAT)**

- Otwiera link z maila w Safari albo Chrome.
- Dopiero z otwartego planu dodaje stronę do ekranu. Manifest ustawia `start_url` na jego `/c/<token>`, więc ikona wraca do tego planu.
- Na iPhonie dodawaj stronę będąc na linku z tokenem (Safari zapisuje bieżący adres). Na Androidzie Chrome bierze `start_url` z manifestu.

Dwa manifesty (`/manifest-trener.webmanifest` i `/api/manifest-klient`) mają inne `id` i nazwy, więc na jednym telefonie mogą leżeć obie ikony.

## Logowanie trenera

Jest celowo bez hasła: allowlista e-maili i ciasteczko sesji podpisane `SESSION_SECRET` (180 dni). Sprawdzenie jest w `requestTrainerLogin` w `src/lib/auth.ts`. Funkcja jest rozdzielona tak, żeby później wstawić kod z maila bez ruszania sesji:

1. `requestTrainerLogin` — dziś sprawdza allowlistę i od razu otwiera sesję.
2. Miejsce na `issueLoginCode` — kod jednorazowy mailem.
3. Miejsce na `verifyLoginCode` — sesja dopiero po kodzie.

Allowlista: `TRAINER_EMAILS=a@b.pl,c@d.pl`. Usunięcie adresu ze zmiennej unieważnia jego stare ciasteczko.

## Logo

Źródło to `public/logo.svg` (czarne kółko, biały szczur). Podmień ten plik i przebuduj ikony PWA:

```bash
npm run icons
```

Powstaną `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` i `apple-touch-icon.png`.

## Przydatne komendy

| Komenda | Co robi |
| --- | --- |
| `npm run dev` | serwer deweloperski |
| `npm run build` / `npm start` | build produkcyjny |
| `npm run db:migrate` | zakłada tabele |
| `npm run db:seed` | dane z makiety (kasuje klientów) |
| `npm run e2e` | test API: logowanie, zaproszenie, wspólny checkbox, awatar |
| `npm run icons` | ikony z `public/logo.svg` |
| `npm run lint` | ESLint |

Opcjonalny Postgres w Dockerze zamiast PGlite: `docker compose up -d` i `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gymrat`.

## Gdy coś nie działa

- **„SESSION_SECRET jest wymagany”** — na produkcji ustaw sekret, minimum 16 znaków.
- **Błąd połączenia z bazą** — użyj session poolera (port 5432) i `sslmode=require`. Transaction pooler (6543) bywa kapryśny; aplikacja wyłącza prepared statements (`prepare: false`), ale session pooler jest pewniejszy.
- **Mail nie dochodzi** — przy Gmailu sprawdź weryfikację dwuetapową i hasło aplikacji, nie zwykłe hasło. Przy Resendzie sprawdź `EMAIL_FROM` i zweryfikowaną domenę. Bez `GMAIL_*` i bez `RESEND_API_KEY` link jest w logu procesu Node i w oknie zaproszenia, nie w skrzynce.
- **Klient nie widzi planu** — link musi być z właściwej domeny (`APP_URL`). Stary link działa, dopóki klient jest w bazie.
- **Pusta baza lokalna** — usuń `data/pglite` przy wyłączonym serwerze i uruchom aplikację albo `npm run db:seed` ponownie.
- **Dwa procesy i błąd PGlite** — nie odpalaj seeda równolegle z `npm run dev`.
