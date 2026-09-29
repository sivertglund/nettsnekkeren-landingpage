# Nettsnekkeren — nettsnekkeren.no

Statisk side uten byggesteg. Himmelen, landskapet og stjernestøvet er tegnet med Canvas 2D i `js/dots.js`, uten avhengigheter. Fontene (Oswald, Archivo, Martian Mono) ligger selv i `fonts/`.

## Opplevelsen
Hele forsiden er én oppstigning, og alt scroller fritt:
1. **Bakken:** morgenhimmel, fjell, skog og en halvbygd hytte. «LØFT MERKEVAREN DIN» i Oswald.
2. **Over skyene:** de fire nettsidene vi har laget, i et rutenett. Midt på skjermen smuldrer de opp i stjernestøv én etter én, og Google-anmeldelsene scroller opp der nettsidene var.
3. **Verdensrommet:** støvet samles til en jordklode med kontinenter, KI-agenter i bane og datapakker inn mot Norge (Agentklar). Kloden står fast på skjermen (desktop) og dreier over i en 3D-rakett (fornøydgaranti).
4. **Rask, synlig og lett å oppdatere:** raketten løses sakte opp og strømmer ut i en stor spiralgalakse i bakgrunnen.
5. **Gratis utkast:** «FÅ ET GRATIS UTKAST.» samles av stjernestøv, med stor e-postadresse, telefon og SMS.

## Prikkmotoren (js/dots.js)
- Hver `<section data-bg="sky|high|blue|night">` er en scene. Himmelens farger glir over hele skjermen mellom dem. `data-landscape` på første seksjon gir landskapet.
- Figuren hentes fra `[data-dots]` i seksjonen. Typer: `text` (`data-text`, `data-text-small`, `data-accent`, `data-align="center"`), `editor`, `search`, `network`, `agents` (kloden med KI-agenter), `earth` (kloden med byer), `globe`, `rocket`, `galaxy` (bakgrunn).
- `data-showcase` gir nettsidene som smuldrer opp i stjernestøv (`[data-site]`).
- `data-fixed` får figuren til å stå fast på skjermen mens teksten scroller (desktop; galaksen også på mobil). `data-hold="late"` lar raketten stå til teksten er på linje med den.
- Figurene holder formen mens seksjonen er på skjermen. Mellom seksjonene glir partiklene rolig over i neste form, og 3D-figurene dreier én runde samtidig. Fremdriften glattes i tid, så overgangene spilles jevnt av uansett scrollfart.
- Musehjulet gir myk scrolling på desktop (`js/site.js`). På mobil og med redusert bevegelse er scrollingen vanlig.

## Sider
- `index.html` — forsiden
- `nettsider.html` — tjenestesiden: én scene per tjeneste, prosess, prosjekter, spørsmål, kontakt

## Filer
```
css/style.css     # alt av stil, med @font-face for de selvhostede fontene
js/dots.js        # himmel, landskap og stjernestøv
js/site.js        # myk scrolling, meny, inntoning, ingresser som lyser opp ord for ord
assets/portfolio/ # skjermbilder av nettsidene (WebP til forsiden, JPG til tjenestesiden)
fonts/            # Oswald, Archivo og Martian Mono (woff2)
llms.txt, robots.txt, sitemap.xml
```

Skript og stilark lenkes med et versjonsnummer (`?v=20`). Øk det når de endres, så besøkende får den nye versjonen.

## Kjøre lokalt
`python3 -m http.server 8765` og åpne http://127.0.0.1:8765

## Gå tilbake til den forrige siden
Siden før denne omleggingen er tagget `original-side` i Git. I Vercel kan du også velge en tidligere publisering og trykke «Instant Rollback».
