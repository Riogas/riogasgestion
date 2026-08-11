# Reporte de matching nomenclator <-> OSM
Corrida: 2026-08-11 13:39 | 83s

- Calles del nomenclator: 13144 (2676960 usos de clientes)
- Con match: 10708 (81.5%)
- Usos de clientes cubiertos: 2517008 (94.0%)
- Top-1000 por clientes con match: 976 (97.6%)

| estado | metodo | calles | clientes |
|---|---|---|---|
| AUTO_CONFIRMADO | EXACTO | 6661 | 2097503 |
| AUTO_CONFIRMADO | FUZZY | 282 | 73635 |
| A_REVISAR | EXACTO | 2326 | 125104 |
| A_REVISAR | FUZZY | 1292 | 193522 |
| A_REVISAR | GEOMETRICO | 147 | 27244 |

## Descartes

- no_es_calle: 77
- sin_depto_osm: 0
- sin_match: 2359

## Ejemplos A_REVISAR con muchos clientes

  CALID 27 "CAMINO A LA TABLADA" (755 cli) -> "Camino Macadanizado a la Tablada" [subconjunto 75 vs "Camino Macadanizado a la Tablada"]
  CALID 50 "COSTANERA MARIA ABELLA DE RAMIREZ" (257 cli) -> "Rambla Costanera María Abella de Ramírez" [fuzzy 90 vs "Rambla Costanera María Abella de Ramírez"]
  CALID 61 "ABREVADERO --ABAYUBA--" (268 cli) -> "Abrevadero" [subconjunto 71 vs "Abrevadero" (homónimos equivalentes)]
  CALID 64 "ABREVADERO --PASO DE LA ARENA--" (159 cli) -> "Abrevadero" [solo geometria: 83% de 69 clientes sobre "Abrevadero"]
  CALID 99 "HORACIO ACOSTA Y LARA" (971 cli) -> "Arquitecto Horacio Acosta y Lara" [subconjunto 79 vs "Arquitecto Horacio Acosta y Lara"]
  CALID 140 "AGRACIADA (EL DORADO-LAS PIEDRAS)" (255 cli) -> "Agraciada" [nombre exacto]
  CALID 161 "ENRIQUE AGUIAR" (561 cli) -> "Enrique S. Aguiar" [fuzzy 93 vs "Enrique S. Aguiar"]
  CALID 166 "GENERAL AGUILAR" (982 cli) -> "General Fausto Aguilar" [fuzzy 81 vs "General Fausto Aguilar"]
  CALID 167 "DOCTOR JOSE ANTONIO DE AGUIRRE Y LECUBE" (341 cli) -> "Doctor José de Aguirre y Lecube" [fuzzy 89 vs "Doctor José de Aguirre y Lecube"]
  CALID 170 "DOCTOR MARTIN AGUIRRE" (157 cli) -> "Martín Aguirre" [fuzzy 80 vs "Martín Aguirre"]
  CALID 181 "AIZPURUA" (790 cli) -> "Benito Aispurúa" [solo geometria: 80% de 150 clientes sobre "Benito Aispurúa"]
  CALID 206 "ALARCON" (796 cli) -> "Albardón" [fuzzy 80 vs "Albardón"]
  CALID 217 "JUAN BAUTISTA ALBERDI" (452 cli) -> "Avenida Doctor Juan Bautista Alberdi" [subconjunto 74 vs "Avenida Doctor Juan Bautista Alberdi"]
  CALID 249 "ALICANTE" (904 cli) -> "Alicante" [nombre exacto (homónimos equivalentes)]
  CALID 293 "ALVAREZ BENGOCHEA" (438 cli) -> "Felipe Álvarez Bengochea" [fuzzy 83 vs "Felipe Álvarez Bengochea"]
