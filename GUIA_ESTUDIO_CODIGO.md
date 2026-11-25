# 💻 GUÍA DE ESTUDIO DEL CÓDIGO — SAKILA NoSQL EN MONGODB
**Taller de Base de Datos (BDY1103) · Sección 006D · Grupo 07**  
**Docente:** Igor Andrés Venegas Morales  
**Archivo Oficial:** `006D-SAKILA-EP3-G07-SCRIPT.txt`  
*Esta guía explica cada consulta en lenguaje simple, con su número de línea exacto y las preguntas que Igor puede hacerles.*

---

## 📌 PARTE 1: CÓDIGO DE MAXI DINAMARCA (Diapos 1 a 4)

### 🔹 1. La consulta SQL de Oracle vs. MongoDB
* **En el script:** Línea 155 (`db.film.findOne`)
* **Código en Oracle (Lo que mostraste en Diapo 2):**
```sql
SELECT f.title, c.name AS categoria, a.first_name || ' ' || a.last_name AS actor, l.name AS idioma
FROM film f
JOIN film_category fc ON f.film_id = fc.film_id
JOIN category c       ON fc.category_id = c.category_id
JOIN film_actor fa    ON f.film_id = fa.film_id
JOIN actor a          ON fa.actor_id = a.actor_id
JOIN language l       ON f.language_id = l.language_id
WHERE f.film_id = 307;
```
* **Código en MongoDB (Línea 155):**
```javascript
db.film.findOne(
  { filmId: 307 },
  { _id: 0, filmId: 1, title: 1, category: 1, actors: 1, language: 1 }
);
```
* **¿Qué hace en cristiano?:** En Oracle tuvimos que unir 6 tablas con 5 JOINs para ver una sola película. En MongoDB hacemos un `findOne` y el documento nos devuelve la película lista con su categoría y sus actores adentro en un solo bloque.
* **Pregunta de Igor:** *«Maxi, ¿por qué MongoDB no necesita JOIN aquí?»*  
  👉 **Tu respuesta:** *«Porque en el modelo relacional una película estaba desarmada en 6 tablas por normalización; en MongoDB está embebida y autocontenida en un solo documento.»*

---

### 🔹 2. La estructura del nuevo documento (Inception Chronicles)
* **En el script:** Línea 230 (`db.film.insertOne`)
* **Código:**
```javascript
db.film.insertOne({
  filmId: 1001,
  title: "INCEPTION CHRONICLES",
  rentalRate: 4.99,
  category: { categoryId: 14, name: "Sci-Fi" },
  actors: [
    { actorId: 201, firstName: "LEONARDO", lastName: "DICAPRIO" },
    { actorId: 202, firstName: "MARION", lastName: "COTILLARD" }
  ],
  language: { languageId: 1, name: "English" }
});
```
* **¿Qué hace en cristiano?:** Guarda una película completa con su categoría como objeto y sus actores como un arreglo de objetos, todo en un solo `insertOne`.
* **Pregunta de Igor:** *«¿Por qué dejaron location separada y no la metieron en customer?»*  
  👉 **Tu respuesta:** *«Porque las direcciones no son solo de clientes. Las 2 tiendas y los 2 empleados también usan direcciones. Dejarlas en su propia colección location evita repetir la misma calle y ciudad en varias partes.»*

---

## 📌 PARTE 2: CÓDIGO DE PATRICIO MUÑOZ (Diapos 5 a 7)

### 🔹 3. Limpieza de estructuras (Eliminar tablas puente)
* **En el script:** Línea 145 y Línea 168
* **Código 1: Categoría con `$arrayElemAt` (Línea 145):**
```javascript
db.film.updateMany(
  { filmCategories: { $exists: true, $ne: [] } },
  [
    { $set: { category: { $arrayElemAt: ["$filmCategories", 0] } } },
    { $unset: "filmCategories" }
  ]
);
```
* **¿Qué hace en cristiano?:** La categoría venía metida adentro de un arreglo innecesario `filmCategories: [{ categoryId: 14, name: 'Sci-Fi' }]`. Con `$arrayElemAt` sacamos el primer elemento y lo dejamos como un objeto directo `category: { ... }`, y con `$unset` borramos el campo viejo.
* **Código 2: Actores con `$map` (Línea 168):**
```javascript
db.film.updateMany(
  { filmActors: { $exists: true } },
  [
    {
      $set: {
        actors: {
          $map: {
            input: "$filmActors",
            as: "fa",
            in: { actorId: "$$fa.actorId", firstName: "$$fa.firstName", lastName: "$$fa.lastName" }
          }
        }
      }
    },
    { $unset: "filmActors" }
  ]
);
```
* **¿Qué hace en cristiano?:** Limpia el arreglo viejo de actores y lo transforma en un arreglo limpio de objetos `{ actorId, firstName, lastName }`.
* **Pregunta de Igor:** *«Patricio, ¿por qué hicieron esto si ya tenían los datos?»*  
  👉 **Tu respuesta:** *«Porque al migrar de SQL a Mongo quedaron estructuras intermedias de las tablas puente. Con $arrayElemAt y $map dejamos el esquema nativo e idiomático de MongoDB.»*

---

### 🔹 4. Búsqueda con notación de punto (Penelope Guiness)
* **En el script:** Línea 340
* **Código:**
```javascript
db.film.find(
  { "actors.firstName": "PENELOPE" },
  { _id: 0, filmId: 1, title: 1, "actors.firstName": 1, "actors.lastName": 1 }
);
```
* **¿Qué hace en cristiano?:** Busca en todas las películas aquellas donde adentro del arreglo `actors` exista un actor con `firstName: 'PENELOPE'`.
* **Pregunta de Igor:** *«¿Cómo hace Mongo para buscar adentro de una lista sin JOIN?»*  
  👉 **Tu respuesta:** *«Usa la notación de punto `'actors.firstName'`. Como el arreglo está adentro del documento, Mongo inspecciona los elementos internos directamente.»*

---

### 🔹 5. Modificación posicional con `arrayFilters` (Registrar devolución)
* **En el script:** Línea 462
* **Código:**
```javascript
db.customer.updateOne(
  { customerId: 347, "rentals.rentalId": 16051 },
  { $set: { "rentals.$[elem].returnDate": new Date() } },
  { arrayFilters: [{ "elem.rentalId": 16051 }] }
);
```
* **¿Qué hace en cristiano?:** El cliente 347 tiene decenas de arriendos. Queremos marcar como devuelto únicamente el arriendo con ID 16051. Con `arrayFilters` le decimos a Mongo: *"entra al cliente y cámbiale la fecha solo al arriendo que cumpla `elem.rentalId: 16051`, dejando intactos los otros 30 arriendos"*.
* **Pregunta de Igor:** *«¿Por qué no hicieron un update común y corriente?»*  
  👉 **Tu respuesta:** *«Porque en un arreglo con múltiples arriendos, un update normal sin filtro de posición no sabe a cuál elemento apuntar. Con arrayFilters modificamos con precisión quirúrgica ese único arriendo.»*

---

### 🔹 6. Eliminación de elemento con `$pull`
* **En el script:** Línea 500
* **Código:**
```javascript
db.customer.updateOne(
  { customerId: 347 },
  { $pull: { rentals: { rentalId: 16050 } } }
);
```
* **¿Qué hace en cristiano?:** Remueve el arriendo 16050 del arreglo `rentals` de ese cliente.
* **Pregunta de Igor:** *«¿Por qué usaron `$pull` y no `deleteOne`?»*  
  👉 **Tu respuesta:** *«Porque `deleteOne` borraría a todo el cliente con toda su cuenta. Con `$pull` solo sacamos ese arriendo cancelado de su lista, manteniendo al cliente vivo.»*

---

## 📌 PARTE 3: CÓDIGO DE MATÍAS CARRASCO (Diapos 8 a 10)

### 🔹 7. Pipeline de Agregación: Top 5 Clientes (Reporte Comercial)
* **En el script:** Línea 360
* **Código:**
```javascript
db.customer.aggregate([
  { $unwind: "$rentals" },
  { $match: { "rentals.payments": { $exists: true, $ne: [] } } },
  { $unwind: "$rentals.payments" },
  {
    $group: {
      _id: "$customerId",
      nombre: { $first: "$firstName" },
      apellido: { $first: "$lastName" },
      totalPagado: { $sum: "$rentals.payments.amount" },
      totalTransacciones: { $sum: 1 }
    }
  },
  { $project: { _id: 1, cliente: { $concat: ["$nombre", " ", "$apellido"] }, totalPagado: { $round: ["$totalPagado", 2] } } },
  { $sort: { totalPagado: -1 } },
  { $limit: 5 }
]);
```
* **¿Qué hace paso a paso en cristiano?:**
  1. `$unwind: '$rentals'`: Desdobla la lista de arriendos (si un cliente tiene 30 arriendos, genera 30 filas temporales).
  2. `$match`: Filtra solo los arriendos que tienen pagos.
  3. `$group`: Agrupa por cliente y suma los montos con `$sum`.
  4. `$sort`: Ordena de mayor a menor (`-1`).
  5. `$limit 5`: Deja a los 5 primeros (1° Karl Seal con $221.55, 2° Eleanor Hunt con $216.54).
* **Pregunta de Igor:** *«¿Para qué sirve el `$unwind`?»*  
  👉 **Tu respuesta:** *«Para desarmar el arreglo. Como los arriendos y pagos están adentro de una lista, $unwind los convierte en registros individuales para poder sumarlos con $group.»*

---

### 🔹 8. Auditoría de Direcciones (La Tarea de Clase / LEFT JOIN)
* **En el script:** Línea 37
* **Código:**
```javascript
db.location.aggregate([
  {
    $lookup: {
      from: "customer",
      localField: "addressId",
      foreignField: "addressId",
      as: "clientesAsociados"
    }
  },
  { $match: { clientesAsociados: { $size: 0 } } },
  { $project: { _id: 0, addressId: 1, address: 1, city: "$city.city", country: "$country.country" } }
]);
```
* **¿Qué hace en cristiano?:** Hace el equivalente a un `LEFT JOIN` entre `location` y `customer`. Con `$lookup` busca qué clientes tienen esa dirección. Si el arreglo resultante está vacío (`$size: 0`), significa que ningún cliente usa esa dirección.
* **El resultado exacto:** Encontró **solo 4 direcciones**:
  - Address ID 1: 47 MySakila Drive (Tienda 1)
  - Address ID 2: 28 MySQL Boulevard (Tienda 2)
  - Address ID 3: 23 Workhaven Lane (Empleado Mike Hillyer)
  - Address ID 4: 1411 Lillydale Drive (Empleado Jon Stephens)
* **Pregunta de Igor:** *«¿Por qué no borraron esas 4 direcciones si ningún cliente las usa?»*  
  👉 **Tu respuesta:** *«Porque pertenecen a las tiendas y a los empleados del negocio. El resultado demuestra que la base de datos no tiene direcciones huérfanas ni basura; todas tienen un uso justificado en el negocio.»*

---

### 🔹 9. Índices Estratégicos y Límite de 16 MB
* **En el script:** Línea 545
* **Código:**
```javascript
// 1. Índice compuesto multikey (Actor + Categoría)
db.film.createIndex({ "actors.actorId": 1, "category.categoryId": 1 });

// 2. Índice de texto completo (Búsqueda en título y descripción)
db.film.createIndex({ title: "text", description: "text" });
```
* **¿Qué hace en cristiano?:**
  1. El multikey index acelera búsquedas cuando el usuario filtra por actor y categoría al mismo tiempo en el catálogo.
  2. El text index permite buscar palabras clave en el título y la sinopsis de la película.
* **La prueba del límite de 16 MB (Datos reales calculados):**
  - Cliente con más arriendos en Sakila: **Eleanor Hunt (46 arriendos)**.
  - Peso del documento de Eleanor: **19.58 KB**.
  - Límite de MongoDB: **16.000 KB (16 MB)**.
  - Porcentaje ocupado: **0.12%**. Caben más de 30.000 arriendos antes de llegar al límite.
* **Pregunta de Igor:** *«¿Qué pasa si un cliente tiene 10.000 arriendos?»*  
  👉 **Tu respuesta:** *«En Sakila el promedio es de 27 arriendos por cliente y el máximo es 46. Con 19 KB está lejísimos de los 16 MB. Si en el futuro a nivel hipotético superara ese volumen, se implementa el Bucket Pattern para archivar arriendos antiguos en otra colección.»*
