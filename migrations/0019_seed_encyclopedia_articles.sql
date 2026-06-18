INSERT OR IGNORE INTO encyclopedia_articles (
  id,
  title,
  summary,
  content,
  topic,
  related_producto_ids,
  image_key,
  image_keys,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  'seed-enciclopedia-worker-placement',
  'Colocación de trabajadores: elegir antes de que te bloqueen',
  'Una guía simple para entender por qué poner un meeple en el lugar correcto puede definir toda la partida.',
  'La colocación de trabajadores aparece en muchos juegos modernos porque convierte el turno en una decisión concreta: tomo este espacio ahora o corro el riesgo de que otra persona lo ocupe antes.

La idea base es sencilla. Cada jugador tiene una cantidad limitada de trabajadores, peones o marcadores. En tu turno elegís una acción disponible del tablero y dejás ahí uno de esos trabajadores. Esa acción puede darte recursos, cartas, puntos, nuevas opciones o alguna ventaja futura. Lo interesante es que esos espacios suelen ser compartidos. Si alguien tomó la acción que necesitabas, tenés que adaptar tu plan.

Por eso estos juegos enseñan a mirar la mesa completa. No alcanza con saber qué querés hacer; también conviene leer qué necesitan los demás. A veces el mejor movimiento no es el más rentable para vos, sino el que evita que otra persona complete una jugada enorme.

En mesa, esta mecánica funciona muy bien para grupos que disfrutan la planificación sin demasiado azar. También ayuda a explicar juegos más pesados: podés decir “cada turno elegís una acción con uno de tus trabajadores” y la estructura empieza a entenderse rápido.

Cómo reconocerla:

- Hay espacios de acción en el tablero.
- Tenés pocos trabajadores por ronda.
- Las acciones suelen bloquearse o encarecerse cuando alguien llega primero.
- La tensión viene de priorizar: no podés hacer todo.

Buen punto de entrada:

Buscá juegos donde las acciones estén bien señalizadas y los recursos sean pocos. Si hay demasiados tracks, cartas y excepciones, la colocación de trabajadores puede sentirse más complicada de lo que realmente es.

Fuentes consultadas: GamesRadar, “Types of board games: Worker placement”; Tabletop Bellhop, “The Giant List of Tabletop Game Mechanics and Terms”.',
  'mecanicas',
  '[]',
  NULL,
  '[]',
  'published',
  users.id,
  unixepoch(),
  unixepoch()
FROM users
WHERE users.role = 'admin'
ORDER BY users.created_at
LIMIT 1;

INSERT OR IGNORE INTO encyclopedia_articles (
  id,
  title,
  summary,
  content,
  topic,
  related_producto_ids,
  image_key,
  image_keys,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  'seed-enciclopedia-deck-building',
  'Deck-building: mejorar tu mazo mientras jugás',
  'Qué significa construir un mazo durante la partida y por qué no es lo mismo que armarlo antes de sentarse a jugar.',
  'En un deck-building, tu mazo inicial suele ser chico, repetitivo y bastante débil. La gracia está en que durante la partida comprás, ganás o incorporás cartas nuevas, y esas cartas cambian lo que podés hacer en los turnos siguientes.

La diferencia importante es esta: en deck-building el mazo se construye durante la partida. En deck construction, en cambio, venís con un mazo armado de antemano. Esa distinción evita muchas confusiones cuando alguien llega desde juegos coleccionables o de cartas competitivas.

Lo lindo de esta mecánica es que se siente como una historia de crecimiento. Al principio hacés acciones simples; después tu mazo empieza a combinar cartas, generar recursos, limpiar cartas flojas o disparar efectos en cadena. Cuando funciona bien, cada vuelta del mazo te muestra el resultado de tus decisiones anteriores.

También tiene un riesgo: si agregás cartas sin mirar el conjunto, el mazo se diluye. Comprar “la carta fuerte” no siempre es mejor que comprar la carta que tu plan necesita. Por eso muchos deck-builders premian la consistencia más que la acumulación.

Cómo reconocerla:

- Cada jugador tiene su propio mazo.
- Se compran o ganan cartas durante la partida.
- El descarte vuelve a mezclarse y reaparece más adelante.
- La sensación de progreso está en que tu mazo hace cada vez más cosas.

Consejo para empezar:

Si es tu primera partida, elegí una idea simple y repetila. Por ejemplo: comprar cartas que den dinero, cartas que den puntos o cartas que roben más cartas. Un plan claro suele rendir mejor que una colección de cartas lindas sin conexión.

Fuentes consultadas: Wikipedia, “Deck-building game”; Tabletop Bellhop, “Deck/Bag Building”.',
  'mecanicas',
  '[]',
  NULL,
  '[]',
  'published',
  users.id,
  unixepoch() + 1,
  unixepoch() + 1
FROM users
WHERE users.role = 'admin'
ORDER BY users.created_at
LIMIT 1;

INSERT OR IGNORE INTO encyclopedia_articles (
  id,
  title,
  summary,
  content,
  topic,
  related_producto_ids,
  image_key,
  image_keys,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  'seed-enciclopedia-engine-building',
  'Engine-building: cuando tu juego empieza a producir solo',
  'Una explicación amable de los motores: sistemas que arrancan chiquitos y se vuelven cada vez más potentes.',
  'Un motor no es una pieza del juego. Es el sistema que armás con cartas, recursos, acciones o mejoras para que cada turno sea más productivo que el anterior.

Al principio, un engine-builder suele sentirse humilde. Conseguís una carta, un recurso, una mejora pequeña. Pero esas partes empiezan a conectarse: una carta te da comida, la comida activa otra carta, esa carta te permite bajar una tercera. De pronto no estás haciendo acciones sueltas; estás administrando una máquina.

La clave está en distinguir producción de puntos. Hay juegos donde conviene invertir temprano en producir mejor, aunque eso no puntúe de inmediato. Más adelante, ese motor puede convertir recursos en puntos con mucha eficiencia. Si esperás demasiado, quizás el motor llega tarde. Si invertís de más, quizás producís mucho pero no cerrás la partida.

Cómo reconocerlo:

- Tus decisiones tempranas mejoran turnos futuros.
- Hay combos o beneficios acumulativos.
- La producción escala con el tiempo.
- El final de partida suele exigir convertir ese crecimiento en puntos.

Qué mirar en una partida:

Preguntate qué parte de tu sistema está trabada. ¿Te faltan recursos? ¿Cartas? ¿Acciones? ¿Una forma de puntuar? Mejorar el cuello de botella suele valer más que sumar otra pieza vistosa.

Fuentes consultadas: GamesRadar, “Types of board game: Engine-building”; Tabletop Bellhop, “Engine Building”.',
  'mecanicas',
  '[]',
  NULL,
  '[]',
  'published',
  users.id,
  unixepoch() + 2,
  unixepoch() + 2
FROM users
WHERE users.role = 'admin'
ORDER BY users.created_at
LIMIT 1;

INSERT OR IGNORE INTO encyclopedia_articles (
  id,
  title,
  summary,
  content,
  topic,
  related_producto_ids,
  image_key,
  image_keys,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  'seed-enciclopedia-area-control',
  'Control de áreas: la mesa como territorio',
  'Cómo leer los juegos donde importa ocupar, disputar o dominar zonas del tablero.',
  'En los juegos de control de áreas, el tablero no es solo un lugar donde pasan cosas: es el premio. Cada región puede dar puntos, recursos, presencia o ventajas. La pregunta central es quién manda en cada zona y cuánto cuesta sostener esa presencia.

Hay varias formas de resolver ese dominio. A veces alcanza con tener mayoría de piezas. Otras veces importa estar primero, rodear una zona, resistir ataques o elegir bien cuándo abandonar un lugar. Lo importante es que la posición relativa entre jugadores pesa mucho.

Esta mecánica genera conversación sin necesidad de negociar formalmente. Si entrás a una zona, estás diciendo algo. Si te retirás, también. Muchas partidas se deciden por timing: poner fuerza demasiado temprano invita a que todos te ataquen; llegar demasiado tarde puede dejarte afuera del reparto.

Cómo reconocerla:

- El tablero está dividido en zonas relevantes.
- Las piezas de varios jugadores compiten por presencia.
- Las zonas entregan puntos, recursos o control.
- Importa tanto dónde estás como cuándo llegaste.

Consejo de mesa:

No pelees todas las zonas. Elegí tus batallas. En control de áreas, gastar tres turnos para ganar una región secundaria puede abrirle la puerta a otra persona para puntuar lo importante.

Fuentes consultadas: Tabletop Bellhop, “Area Control” y “Area Majority”; Wikipedia, “Board game” sección de construcción o control territorial.',
  'mecanicas',
  '[]',
  NULL,
  '[]',
  'published',
  users.id,
  unixepoch() + 3,
  unixepoch() + 3
FROM users
WHERE users.role = 'admin'
ORDER BY users.created_at
LIMIT 1;

INSERT OR IGNORE INTO encyclopedia_articles (
  id,
  title,
  summary,
  content,
  topic,
  related_producto_ids,
  image_key,
  image_keys,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  'seed-enciclopedia-cooperativos',
  'Juegos cooperativos: ganar contra el sistema',
  'Qué cambia cuando la mesa juega en equipo y el desafío principal lo propone el juego.',
  'En un juego cooperativo, la mesa no se divide en ganadores y perdedores individuales. El grupo comparte un objetivo y suele ganar o perder en conjunto. En vez de competir entre sí, las personas coordinan acciones para superar un sistema: una amenaza, un mazo de eventos, un reloj, una misión o un escenario.

Esto cambia el clima de la partida. La conversación se vuelve parte del juego: priorizar, repartir tareas, pedir ayuda, anticipar problemas. Cuando está bien diseñado, cada persona tiene algo valioso para decidir y el desafío no se resuelve con una sola voz mandando sobre todas las demás.

También hay variantes. Algunos cooperativos tienen información oculta, comunicación limitada, roles asimétricos o traidores. Esos detalles modifican mucho la experiencia. Un cooperativo familiar puede ser relajado y abierto; uno de crisis puede sentirse como apagar incendios todo el tiempo.

Cómo reconocerlos:

- El objetivo es compartido.
- El juego tiene una condición de derrota.
- La información y los recursos se coordinan entre jugadores.
- La tensión viene del sistema, no solo de otras personas.

Consejo para disfrutarlos:

Antes de empezar, acuerden el tono. Si alguien conoce mucho el juego, conviene que explique opciones sin dirigir cada turno. La gracia está en que la mesa piense junta, no en que una persona juegue por todos.

Fuentes consultadas: BoardGameGeek, “Cooperative Game”; Tabletop Gaming, “What is a Cooperative Board Game?”; Tabletop Bellhop, notas sobre juegos cooperativos.',
  'guias',
  '[]',
  NULL,
  '[]',
  'published',
  users.id,
  unixepoch() + 4,
  unixepoch() + 4
FROM users
WHERE users.role = 'admin'
ORDER BY users.created_at
LIMIT 1;

INSERT OR IGNORE INTO encyclopedia_articles (
  id,
  title,
  summary,
  content,
  topic,
  related_producto_ids,
  image_key,
  image_keys,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  'seed-enciclopedia-deduccion-social',
  'Deducción social: mentir, leer gestos y sostener una historia',
  'Una entrada para entender los juegos de roles ocultos, sospechas y conversaciones tensas.',
  'La deducción social pone el foco en las personas alrededor de la mesa. Las reglas importan, pero la partida vive en lo que se dice, lo que se oculta y lo que el grupo decide creer.

En muchos juegos de este tipo hay roles ocultos. Algunas personas comparten un objetivo común; otras trabajan en secreto para sabotearlo o sobrevivir sin ser descubiertas. La diversión aparece cuando la información incompleta obliga a argumentar: ¿por qué hiciste esa acción? ¿A quién protegés? ¿Por qué cambiaste tu voto?

No todos los juegos de deducción social son iguales. Algunos son livianos y de fiesta; otros son largos, con pistas, votaciones, equipos o poderes especiales. Lo importante es que la mesa acepte el contrato social: acusar dentro del juego no es atacar fuera del juego.

Cómo reconocerlos:

- Hay roles, lealtades o información oculta.
- La conversación es una herramienta central.
- Mentir, omitir o detectar contradicciones puede ser parte del juego.
- El grupo toma decisiones con evidencia incompleta.

Consejo para la primera partida:

Jugá con humor y cuidá el clima. Una buena acusación debería abrir juego, no cerrar la mesa. Si alguien se incomoda mintiendo, conviene empezar por títulos más livianos o por equipos donde la presión individual sea menor.

Fuentes consultadas: GamesRadar, “Types of board game: Social deduction/hidden role”; Tabletop Bellhop, “Social Deduction” y “Deduction”.',
  'mecanicas',
  '[]',
  NULL,
  '[]',
  'published',
  users.id,
  unixepoch() + 5,
  unixepoch() + 5
FROM users
WHERE users.role = 'admin'
ORDER BY users.created_at
LIMIT 1;

INSERT OR IGNORE INTO encyclopedia_articles (
  id,
  title,
  summary,
  content,
  topic,
  related_producto_ids,
  image_key,
  image_keys,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  'seed-enciclopedia-eurogames',
  'Eurogames: estrategia con menos conflicto directo',
  'Qué suele querer decir “euro” cuando alguien recomienda un juego moderno.',
  'Eurogame es una etiqueta amplia, pero útil. Suele describir juegos donde la estrategia pesa más que el azar, hay varias formas de sumar puntos y la interacción directa no necesariamente implica atacar o eliminar a otras personas.

En muchos eurogames competís por eficiencia. Elegís acciones, administrás recursos, optimizás tiempos y buscás puntuar mejor que el resto. La tensión existe, pero aparece más en espacios compartidos, mercados, mayorías, turnos o carreras por objetivos que en destruir el plan ajeno.

Eso los hace buenos para mesas que disfrutan pensar sin convertir la partida en pelea frontal. También suelen tener finales donde nadie queda eliminado: todas las personas juegan hasta el cierre y después se comparan resultados.

Cómo reconocerlos:

- Hay múltiples caminos para puntuar.
- El azar suele estar controlado o mitigado.
- La eliminación de jugadores es rara.
- La interacción puede ser indirecta: bloquear espacios, tomar cartas, competir por objetivos.

Advertencia útil:

“Euro” no significa fácil. Algunos son familiares y otros son muy exigentes. Si estás eligiendo uno para una mesa nueva, mirá duración, cantidad de iconos y cuánto tarda una primera explicación.

Fuentes consultadas: GamesRadar, “Types of board game: Eurogame/Euro-style”; Wikipedia, “Board game” y categorías de juegos modernos.',
  'general',
  '[]',
  NULL,
  '[]',
  'published',
  users.id,
  unixepoch() + 6,
  unixepoch() + 6
FROM users
WHERE users.role = 'admin'
ORDER BY users.created_at
LIMIT 1;

INSERT OR IGNORE INTO encyclopedia_articles (
  id,
  title,
  summary,
  content,
  topic,
  related_producto_ids,
  image_key,
  image_keys,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  'seed-enciclopedia-elegir-primer-juego',
  'Cómo elegir un juego para una mesa nueva',
  'Una guía práctica para recomendar sin abrumar: personas, tiempo, interacción y tolerancia al azar.',
  'Elegir un juego no empieza por “cuál es el mejor”. Empieza por la mesa. Un gran juego puede fallar si no coincide con las ganas, el tiempo o la experiencia del grupo.

Primero mirá la cantidad de personas. Hay juegos que brillan a dos y se vuelven lentos a cinco. Otros necesitan grupo grande para que la conversación aparezca. Después mirá la duración real, no solo la caja: una primera partida casi siempre tarda más.

También conviene preguntar por el tipo de interacción. Hay mesas que disfrutan bloquearse, negociar o acusarse. Otras prefieren construir en paralelo y comparar al final. Ninguna opción es mejor en abstracto; lo importante es no vender una noche tranquila y terminar con una guerra diplomática.

Otro filtro clave es el azar. Un poco de azar puede nivelar experiencias y generar momentos memorables. Mucho azar puede frustrar a quien quiere planificar. Poco azar puede intimidar a quien recién empieza, porque cada error pesa más.

Checklist rápido:

- ¿Cuántas personas juegan y cuánto tiempo tienen?
- ¿Quieren competir fuerte, cooperar o jugar liviano?
- ¿Prefieren reglas simples o profundidad estratégica?
- ¿Les divierte el azar o quieren control?
- ¿La explicación entra en diez minutos?

Una buena recomendación no muestra todo el hobby de golpe. Abre una puerta. Si la mesa termina con ganas de otra partida, elegiste bien.

Fuentes consultadas: GamesRadar, guía de tipos de juegos; Tabletop Bellhop, glosario de mecánicas y términos de mesa.',
  'guias',
  '[]',
  NULL,
  '[]',
  'published',
  users.id,
  unixepoch() + 7,
  unixepoch() + 7
FROM users
WHERE users.role = 'admin'
ORDER BY users.created_at
LIMIT 1;
