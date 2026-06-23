# Nettsnekkeren — landingpage

En scroll-drevet, partikkel-basert landingsside for **Nettsnekkeren** (WebGL / Three.js).

## Opplevelsen
Et fullskjerm partikkel-skydekke (Three.js) som morpher gjennom figurer mens du scroller:

**sfære → torus → galakse → ∞ (uendelighet) → ormehull → cosmic web**

- **Hero**: kule med hvite satellitter (med haler) i bane
- **Pekeren** omformer figuren og stjernene (skjerm-rom repel)
- **Vårt team**: uendelighetssymbol
- **Visjon**: du dras gjennom et ormehull som springer ut i en stor cosmic web (klynger + filamenter)
- Lenis smooth scroll + GSAP reveals

## Sider
- `index.html` — hovedsiden (partikkel-opplevelsen)
- `nettsider.html` — tjenesteside for nettsider, med portefølje (kunder + konsept)
- `kommer-snart.html` — generisk «kommer snart» for øvrige tjenester

## Kjøring
Åpne `index.html` i nettleser (Three.js, Lenis og GSAP lastes fra CDN — krever nett).

## Struktur
```
index.html, nettsider.html, kommer-snart.html
css/style.css
js/particles.js   # WebGL partikkel-motor
js/main.js        # forside: scroll, meny, reveals
js/page.js        # underside-interaksjon
assets/portfolio/ # porteføljebilder
```
