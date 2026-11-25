# 🎤 GUION PERFECTO — EVALUACIÓN PARCIAL 3
**Taller de Base de Datos (BDY1103) · Sección 006D · Grupo 07**  
**Docente:** Igor Andrés Venegas Morales  
**Objetivo:** Lenguaje ultra simple, fácil de aprender para los tres integrantes, con todas las trampas desactivadas en vivo.

---

## 📌 PARTE 1: MAXIMILIANO DINAMARCA (Diapositivas 1 a 4)
*Tu misión: Explicar el problema de fondo y el nuevo modelo. Fácil, claro y sin enredarte.*

---

### 🗣️ Diapositiva 1: Portada (15 segundos)
* **Lo que está en pantalla:** Portada con los datos del grupo y el docente.
* **Lo que dices tú:**
> «Buenos días profesor y compañeros. Nosotros somos el Grupo 7: Patricio Muñoz, Matías Carrasco y quien les habla, Maximiliano Dinamarca.  
> Hoy les presentaremos nuestro proyecto: el **Diseño e Implementación de un Modelo No Relacional en MongoDB** para el caso **Sakila**.  
> Les explicaremos por qué rediseñamos el modelo relacional a colecciones, cómo organizamos las 4 colecciones principales y demostraremos su funcionamiento con consultas reales ejecutadas en consola.»

---

### 🗣️ Diapositiva 2: El Diagnóstico en Oracle (45 segundos) — [TRAMPA DESACTIVADA]
* **Lo que está en pantalla:** A la izquierda 3 viñetas (cruces de tablas, concurrencia, esquemas rígidos). A la derecha la consulta con 5 JOINs.
* **Lo que dices tú:**
> «Para empezar, en esta lámina vemos el problema que teníamos en Oracle.  
> Miren la consulta a la derecha: para mostrar una sola película teníamos que cruzar **6 tablas distintas con 5 JOINs**.  
> 
> Y en pantalla vemos tres problemas claros:  
> 1. **Demasiados cruces de tablas:** desarmábamos una película en 6 pedazos para guardarla, y teníamos que volver a armarla cada vez que el sistema la pedía.  
> 2. **Respecto a la concurrencia que pusimos en la segunda viñeta:** sabemos perfectamente, profesor, que Sakila es un videoclub de 599 clientes y que un servidor actual no va a colapsar por velocidad. El problema de fondo es de diseño: obligar al motor relacional a recalcular 5 JOINs una y otra vez por cada usuario es ineficiente comparado con leer un documento directo.  
> 3. **Cambiar es difícil:** en SQL todas las filas son rígidas. Si el videoclub quería agregar formatos nuevos como 4K o streaming, teníamos que alterar tablas completas con `ALTER TABLE` o llenarnos de campos vacíos con `NULL`.  
> 
> Por eso decidimos cambiar a MongoDB: para que la película viva completa en un solo lugar.»

* **Si Igor te interrumpe y dice: "¿El problema que quieren resolver es de nuevo la velocidad?":**  
  👉 *«No, profesor, para nada. En la primera evaluación nos quedó claro lo que nos enseñó: un computador moderno no se ahoga por velocidad con 599 clientes. El problema es de orden: desarmar una película en 6 tablas para rearmarla con 5 JOINs, y la rigidez de esquemas que obliga a hacer ALTER TABLE para agregar datos nuevos.»*

---

### 🗣️ Diapositiva 3: Tablas vs. Documentos (35 segundos)
* **Lo que está en pantalla:** Comparativa conceptual y a la derecha el código `findOne({ filmId: 307 })`.
* **Lo que dices tú:**
> «En esta lámina comparamos cómo se organiza la información en ambos sistemas:  
> * **Cómo se guarda:** SQL separa los datos en tablas fijas. MongoDB guarda todo junto en un documento flexible, como una ficha completa.  
> * **Qué tan estricto es:** Oracle exige esquemas fijos con reglas estrictas. MongoDB es flexible y nos permite guardar listas adentro del mismo documento.  
> * **Cómo crece:** SQL escala de forma vertical, exigiendo servidores más caros; mientras que MongoDB escala de forma horizontal, repartiendo datos en varios equipos más pequeños.  
> 
> Miren el código a la derecha: con un solo `findOne`, traemos la película 307 completa en un solo bloque: su título (*Fellowship Autumn*), su tarifa, su categoría *Travel*, sus actores y su idioma, sin cruzar ninguna tabla intermedia.»

---

### 🗣️ Diapositiva 4: De 16 tablas a 4 colecciones (30 segundos)
* **Lo que está en pantalla:** Las 4 colecciones y el documento de *Inception Chronicles*.
* **Lo que dices tú:**
> «Con este enfoque simplificamos toda la base de datos: **pasamos de 16 tablas en Oracle a solo 4 colecciones en MongoDB**:  
> 1. **film:** las 1.000 películas del catálogo, con sus actores y categoría embebidos.  
> 2. **customer:** los 599 clientes, con sus arriendos y pagos incorporados.  
> 3. **location:** las 603 direcciones unificadas con ciudad y país. La dejamos como colección separada porque las direcciones las comparten los clientes, las tiendas y los empleados.  
> 4. **store:** las 2 tiendas físicas con su inventario de copias físicas.  
> 
> A la derecha ven cómo queda la película *Inception*: viene lista con todo su elenco para usarse directamente.  
> 
> Ahora los dejo con mi compañero Patricio Muñoz, quien les explicará cómo limpiamos las estructuras intermedias y las operaciones en consola.»

---

## 📌 PARTE 2: PATRICIO MUÑOZ (Diapositivas 5 a 7)
*Tu misión: Explicar cómo limpiaron las tablas que sobraban y las operaciones CRUD básicas. Fácil y al hueso.*

---

### 🗣️ Diapositiva 5: Refinamiento de Estructuras (Eliminación de Tablas Puente) (45 segundos)
* **Lo que está en pantalla:** Explicación de cómo se limpiaron las tablas intermedias y a la derecha los operadores `$arrayElemAt` y `$map`.
* **Lo que dice Patricio:**
> «Gracias, Maxi. Siguiendo las indicaciones del profesor en clases, limpiamos el modelo para que fuera código nativo de MongoDB:  
> En relacional existían tablas intermedias porque SQL no permite guardar listas adentro de una celda. Al migrar a Mongo, aplicamos tres mejoras:  
> 1. **Categoría directa:** En `film`, la categoría venía adentro de una lista innecesaria. Con el operador `$arrayElemAt` la dejamos como un objeto directo llamado `category` y borramos el campo viejo con `$unset`.  
> 2. **Lista limpia de actores:** Con el operador `$map` limpiamos los datos viejos para dejar un arreglo directo solo con los nombres e IDs de los actores.  
> 3. **Pagos en arriendos:** Y en los clientes, movimos cada pago para que quede adentro de su arriendo correspondiente en `rentals`, porque en la vida real un pago siempre le pertenece a un arriendo específico.»

* **Si Igor pregunta: "¿Por qué metieron el pago adentro del arriendo?":**  
  👉 *«Porque un pago no existe en el aire; siempre le pertenece a un arriendo puntual. Al guardarlo adentro, cuando consultamos el arriendo de un cliente ya sabemos de inmediato si fue pagado y por cuánto, sin hacer cruces.»*

---

### 🗣️ Diapositiva 6: Operaciones Básicas: Crear y Buscar (40 segundos)
* **Lo que está en pantalla:** Código `[C1]` con `insertOne` y código `[R2]` con búsqueda de *Penelope Guiness*.
* **Lo que dice Patricio:**
> «Para validar que el modelo funciona en la consola de MongoDB, implementamos las operaciones CRUD:  
> * Arriba en `[C1]`, usamos `insertOne` para registrar una película nueva: *Inception Chronicles*. Miren cómo en una sola instrucción guardamos su título, su categoría Sci-Fi y su lista de actores con Leonardo DiCaprio.  
> * Y abajo en `[R2]`, probamos la búsqueda adentro de arreglos usando la **notación de punto**: `'actors.firstName': 'PENELOPE'`. MongoDB busca directamente en la lista interna de actores y nos devuelve las películas de Penelope Guiness al instante, sin hacer ningún JOIN.»

* **Si Igor pregunta: "¿Cómo funciona esa búsqueda de Penelope?":**  
  👉 *«Con la notación de punto, profesor: `'actors.firstName'`. Como el documento ya tiene la lista de actores adentro, Mongo entra al arreglo y busca la coincidencia directamente.»*

---

### 🗣️ Diapositiva 7: Operaciones de Actualización y Borrado (45 segundos)
* **Lo que está en pantalla:** Operadores `$set`, `$push`, `arrayFilters`, `$pull` e `$inc`.
* **Lo que dice Patricio:**
> «En modificaciones y borrados usamos operadores avanzados para hacer cambios puntuales:  
> * En `[U3]`: Para registrar la devolución de una película usamos **`arrayFilters`**. Esto es clave porque un cliente puede tener 30 arriendos; con `arrayFilters` modificamos únicamente la fecha de devolución del arriendo puntual que el cliente vino a devolver, sin tocar el resto de su historial.  
> * En `[D2]`: Para anular un arriendo erróneo usamos **`$pull`**. Este operador elimina solo ese elemento de la lista sin borrar la ficha del cliente.  
> * Y en `[U4]`: Demostramos cambios numéricos masivos con **`$inc`**, subiendo en 50 centavos el costo de reemplazo a todas las películas infantiles de clasificación G.  
> 
> Ahora los dejo con Matías Carrasco, quien les presentará los reportes y la auditoría de direcciones que pidió el profesor.»

* **Si Igor pregunta: "¿Por qué usaron `$pull` en vez de `deleteOne`?":**  
  👉 *«Porque `deleteOne` borraría a todo el cliente de la base de datos. Con `$pull` solo sacamos el arriendo anulado de su arreglo, manteniendo la cuenta del cliente intacta.»*

---

## 📌 PARTE 3: MATÍAS CARRASCO (Diapositivas 8 a 10)
*Tu misión: Mostrar los números de plata, la tarea de las direcciones y cerrar con los datos reales. La parte más contundente.*

---

### 🗣️ Diapositiva 8: Reportería de Negocio: Top Clientes (45 segundos)
* **Lo que está en pantalla:** Pipeline de agregación y tabla con Karl Seal ($221.55) y Eleanor Hunt ($216.54).
* **Lo que dice Matías:**
> «Gracias, Patricio. Para obtener reportes del negocio construimos un Pipeline de Agregación:  
> Como ven en la consulta a la derecha, procesamos los datos en pasos:  
> 1. Primero desarmamos los arriendos con `$unwind`.  
> 2. Filtramos los que tienen pago con `$match`.  
> 3. Agrupamos por cliente sumando los montos con `$group`.  
> 4. Redondeamos el total con `$project`, ordenamos de mayor a menor con `$sort` y dejamos los 5 primeros con `$limit`.  
> 
> El resultado muestra a nuestros clientes más valiosos: en primer lugar **Karl Seal con $221 dólares**, y en segundo lugar **Eleanor Hunt con $216**. Esto le permite a la administración crear promociones comerciales de fidelización.»

* **Si Igor pregunta: "¿Qué hace `$unwind`?":**  
  👉 *«Desdobla el arreglo de arriendos. Si un cliente tiene 30 arriendos, genera 30 documentos temporales para que podamos sumar los pagos uno por uno en la siguiente etapa.»*

---

### 🗣️ Diapositiva 9: Auditoría de Direcciones (La Tarea de Clase) (50 segundos) — [LA CARTA DE TRIUNFO]
* **Lo que está en pantalla:** La consulta con `$lookup` y el resultado de las 4 direcciones (IDs 1, 2, 3 y 4).
* **Lo que dice Matías:**
> «Esta diapositiva responde directamente al ejercicio que nos pidió el profesor Igor en clases: **encontrar qué direcciones registradas no pertenecen a ningún cliente**, que en SQL se resolvía con un `LEFT JOIN` y `HAVING count = 0`.  
> 
> En MongoDB lo resolvimos con el pipeline que ven a la derecha:  
> 1. Cruzamos las colecciones `location` y `customer` usando **`$lookup`**.  
> 2. Filtramos los arreglos vacíos con `$match` buscando donde no existen clientes.  
> 
> **El resultado fue exacto: encontramos únicamente 4 direcciones sin clientes**, que son los IDs 1, 2, 3 y 4.  
> 
> Y la justificación del negocio es perfecta:  
> * Las direcciones 1 y 2 pertenecen a las **Tiendas 1 y 2**.  
> * Las direcciones 3 y 4 pertenecen a los **empleados** Mike Hillyer y Jon Stephens.  
> Con esto demostramos matemáticamente que en la base de datos no hay ninguna dirección huérfana ni basura.»

* **Si Igor pregunta: "¿Y por qué no borraron esas 4 direcciones si no tienen clientes?":**  
  👉 *«Porque son las direcciones físicas de las tiendas y de los empleados. La base de datos está perfectamente consistente; ninguna dirección sobra.»*

---

### 🗣️ Diapositiva 10: Conclusiones y Métricas Reales (45 segundos) — [SEGUNDA TRAMPA DESACTIVADA]
* **Lo que está en pantalla:** Conclusiones, límite de 16 MB y los índices de texto y compuestos.
* **Lo que dice Matías:**
> «Para cerrar, como balance técnico destacamos tres conclusiones:  
> 
> 1. **Diseño más simple:** Pasamos de 16 tablas acopladas a solo 4 colecciones independientes, eliminando la necesidad de cruzar 6 tablas para mostrar una ficha.  
> 2. **Límite de 16 MB y tamaño real verificado:** En la lámina se menciona la mitigación teórica para clientes con miles de arriendos. Al respecto, auditamos la base de datos real de Sakila y descubrimos que **el cliente récord de toda la historia es Eleanor Hunt con 46 arriendos, y su documento completo pesa apenas 19 KB**. Esto representa menos del 0.2% del límite de 16 MB de MongoDB. Por lo tanto, en Sakila la incrustación es 100% segura y no existe riesgo de desborde. Y si a futuro una empresa gigante superara ese volumen, se usaría el patrón Bucket Pattern para archivar históricos.  
> 3. **Índices estratégicos:** Creamos dos índices: uno compuesto por actor y categoría para navegar rápido por el catálogo, y otro de texto completo para buscar películas por palabras clave en su sinopsis.  
> 
> Muchas gracias por su atención y quedamos atentos a sus preguntas.»

* **Si Igor pregunta: "¿Y cuántos arriendos cabrían antes de llegar a los 16 MB?":**  
  👉 *«Si 46 arriendos pesan 19 KB, cabrían más de 30.000 arriendos en un solo cliente antes de acercarse al límite de 16 megabytes. En un videoclub es prácticamente imposible que se desborde.»*

---

## 🛡️ RESUMEN DE RESPUESTAS RÁPIDAS (TORPEDO PARA MAXI)
Si tus amigos se quedan mudos, tú entras diciendo: *«Profesor, si me permite complementar lo que dice mi compañero...»* y dices esto:

1. **¿Por qué arrayFilters?** -> *«Para modificar únicamente la fecha de devolución del arriendo 16051 sin tocar los otros 30 arriendos del cliente.»* (Línea 462 del script).
2. **¿Por qué $pull?** -> *«Para eliminar un arriendo o pago anulado sin borrar la ficha del cliente.»* (Línea 500 del script).
3. **¿Cómo sumaron la plata en el reporte?** -> *«Con $unwind desdoblamos los arriendos y con $group sumamos los montos de pago por cliente.»* (Línea 360 del script).
4. **¿Por qué quedaron 4 direcciones sin cliente?** -> *«Porque son las direcciones de las dos tiendas (IDs 1 y 2) y de los dos empleados Mike y Jon (IDs 3 y 4).»* (Línea 37 del script).
5. **¿Por qué no metieron la dirección en el cliente?** -> *«Porque las direcciones también las usan las tiendas y los empleados; dejarlas en location evita duplicar la misma calle muchas veces.»*
