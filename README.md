# Zespół: Wiktor Miśkowiec, Miłosz Ziemba

# Wtyczka 

Dokumentacja projektu wtyczki managera haseł do przeglądarki Firefox - silnik gecko.

## Struktura

```text
/
├── manifest.json
├── backend/
│   ├── background.js
│   └── crypto_utils.js
└── frontend/
    ├── popup.html
    ├── popup.css
    └── popup.js
```

## Konfiguracja - manifest.json

Na poziomie głównym plik manifest.json pełni rolę jedynego punktu wejścia oraz planu konfiguracyjnego dla silnika MV3 w Mozilla Firefox.
* Uprawnienia (Permissions): Określają wymagane zakresy dostępu, jawnie ograniczając rozszerzenie wyłącznie do możliwości storage (browser.storage.local).
* Powiązanie tła (Background Binding): Nakazuje przeglądarce automatyczne załadowanie komponentów backendu (backend/crypto_utils.js oraz backend/background.js).
* Powiązanie akcji (Action Binding): Łączy akcję przeglądarki z wyświetleniem widoku frontend/popup.html w izolowanym, tymczasowym kontekście interfejsu użytkownika.

## Ekrany

Przewidywane są 4 ekrany:

Ekran rejestracji użytkownika

![alt text](media/image1.png)

- dostępny jednokrotnie tuż po dodaniu wtyczki
- zastępiany przez Ekran logowania - locked out

![alt text](media/image.png)

- umożliwia dostęp do zapisanych danych logowania

Ekran wyszukiwana odblokowywany przez powyższe

![alt text](media/image2.png)

- możliwość dodawania/usuwania danych logowania
- wyszukiwanie danych przez regex
- kopiowanie danych logowania
- opcja zablokowania - powrót do ekranu logowania
Przewidywany czwarty ekran dotyczy 2FA przez pendrive.

## Funkcjonalność

Master password przy rejestracji wymaga spełnienia
- dłuższe niż 8 znaków
- przynajmniej jedna mała litera
- przynajmniej jedna duża litera
- przynajmniej jedna cyfra
- przynajkniej jeden znak specjalny

Hasło przy rejestracji rozszerzane przez losową salt - Uint8[16].

?-Salt dla jednego użytkownika w celu ochrony przed atakami słownikowymi i tęczowymi tablicami.

Weryfikacja użytkownika jest
- dokonywana przez SHA-256 tworzonego dla (password+salt)
- ważna przez 15 minut
- możliwość wczesnego zakończenia sesji
- na czas trwania przechowuję klucz sesji

Klucz sesji jest
- tworzony po weryfikacji użytkownika
- używany do enkrypcji i dekrypcji haseł
- 256-bit klucz AES-GCM
- tworzony z password + salt
- tworzony przy użyciu PBKDF2
- przechodzi 100 000 iteracji
- wykorzystuje hash SHA-256
- używany do szyfrowania i odszyfrowania

Szyfrowanie/odszyfrowanie danych opiera się na
- kluczu sesji
- losowej wartości iv

?-iv nietajna lecz stosowana dla eliminacji wzorców między hashami

## Endpointy

Funkcjonalność analogiczna do powyższego opisu

* register
* login
* logout
* delete_entry
* add_entry
* search_entries


## Technologie

* ManifestV3
* API przeglądarki: browser.storage.local, browser.action
* html
* css
* js
* Web Crypto API
* PBKDF2
* AES-GCM (256-bit)
* Losowy IV
* Salt
* SHA-256
* JSON
* Base64 encoding

## Testowanie

* Testy manualne - ograniczenie przez komunikację api przeglądarki
  
## TODO

* Autouzupełnianie haseł na stronie w procesie logowania
* 2FA
* automatyczny installator rozszerzenia

## Harmonogram

* 29 kwietnia - autouzupełnianie
* 15 maj - 2FA
* 30 maj - instalator
* 6 czerwca - testy i weryfikacja
