// =============================================================================
// SELECCIÓN DE BASE DE DATOS
// =============================================================================
// [QUÉ ES]: Selecciona la base de datos 'sakila'.
// [PARA QUÉ SIRVE]: Indica que todas las consultas de abajo se ejecutan sobre 'sakila'.
use('sakila');

// -----------------------------------------------------------------------------
// VERIFICACIÓN INICIAL DE ESTADO DE COLECCIONES
// -----------------------------------------------------------------------------
// [QUÉ ES]: Conteo inicial de registros en cada una de las 4 colecciones.
// [PARA QUÉ SIRVE]: Para confirmar que los datos se importaron bien antes de empezar a operar.
// [POR QUÉ ESTÁ AQUÍ]: Muestra en pantalla que tenemos: 599 clientes, 1.000 películas, 603 direcciones y 2 tiendas.
print("\n>>> Comprobación de estado inicial de colecciones...");
print("Documentos en 'customer': " + db.customer.countDocuments()); // Cuenta clientes (599)
print("Documentos en 'film':     " + db.film.countDocuments());     // Cuenta películas (1.000)
print("Documentos en 'location': " + db.location.countDocuments()); // Cuenta direcciones (603)
print("Documentos en 'store':    " + db.store.countDocuments());    // Cuenta tiendas (2)


// =============================================================================
// SECCIÓN ESPECIAL I: TAREA DE LOCATIONS (EQUIVALENTE A LEFT JOIN EN MONGODB)
// =============================================================================
// [OBJETIVO]: Encontrar qué direcciones están registradas pero NO son utilizadas por nadie.
// [EQUIVALENTE SQL]: SELECT a.* FROM address a LEFT JOIN customer c ON a.address_id = c.address_id WHERE c.customer_id IS NULL;
print("\n=====================================================================");
print("TAREA DE LOCATIONS: CHEQUEO DE DIRECCIONES NO USADAS (EQUIVALENTE SQL)");


// -----------------------------------------------------------------------------
// 1. DIRECCIONES NO USADAS POR CLIENTES
// -----------------------------------------------------------------------------
// [EN ESPAÑOL SIMPLE]: Revisa la lista de direcciones y pregunta:
// ¿Hay alguna dirección registrada donde NO viva ningún cliente?
// [RESPUESTA REAL]: Sí, solo 4 direcciones (las 2 tiendas y los 2 empleados).
print("\n[LOC-1] Direcciones NO usadas por Clientes (primeras 5):");
const locNoClientes = db.location.aggregate([
  {
    // $lookup: Va a la lista de clientes y busca quién vive en esta dirección.
    $lookup: {
      from: "customer",            // Mira en la colección de clientes
      localField: "addressId",     // El ID de la dirección actual
      foreignField: "addressId",   // El ID de dirección que tiene guardado el cliente
      as: "clientes"               // Guarda a los clientes que viven ahí dentro de una lista
    }
  },
  {
    // $match: Se queda únicamente con las direcciones donde la lista 'clientes' está vacía (nadie vive ahí).
    // "clientes.0": { $exists: false } significa: "la lista no tiene ni un primer cliente".
    $match: {
      "clientes.0": { $exists: false }
    }
  },
  {
    // $project: Selecciona qué columnas mostrar en la pantalla limpia.
    $project: {
      _id: 0,                                 // 0 = Oculta el ID interno de Mongo
      addressId: 1,                           // 1 = Muestra el ID de la dirección
      address: 1,                             // 1 = Muestra el texto de la calle
      cantidadClientes: { $size: "$clientes" } // $size = Muestra cuántos clientes hay (dará 0)
    }
  },
  { 
    // $sort: Ordena por addressId de menor a mayor (1 = ascendente).
    $sort: { addressId: 1 } 
  }
]).toArray(); // .toArray() convierte el cursor en una lista imprimible
printjson(locNoClientes); // Imprime el resultado en formato JSON legible


// -----------------------------------------------------------------------------
// 2. DIRECCIONES NO USADAS POR EMPLEADOS (STAFF)
// -----------------------------------------------------------------------------
// [QUÉ ES]: Cruza 'location' con 'store.staff' para ver qué direcciones no son de empleados.
// [NOTA TÉCNICA]: En Mongo, los empleados (staff) están embebidos dentro de cada tienda (store).
print("\n[LOC-2] Direcciones NO usadas por Empleados (staff) (primeras 5 de 601):");
const locNoStaff = db.location.aggregate([
  {
    // $lookup: Cruza 'location' con la colección 'store', buscando dentro del subdocumento 'staff'.
    $lookup: {
      from: "store",
      localField: "addressId",
      foreignField: "staff.addressId", // Apunta al addressId que tiene el empleado dentro de store
      as: "empleados"
    }
  },
  {
    // Filtra las direcciones donde el arreglo 'empleados' está vacío.
    $match: {
      "empleados.0": { $exists: false }
    }
  },
  {
    // Proyecta los campos útiles.
    $project: {
      _id: 0,
      addressId: 1,
      address: 1,
      cantidadStaff: { $size: "$empleados" }
    }
  },
  { $sort: { addressId: 1 } },
  { $limit: 5 } // Muestra solo las primeras 5 para no saturar la pantalla
]).toArray();
printjson(locNoStaff);


// -----------------------------------------------------------------------------
// 3. DIRECCIONES NO USADAS POR TIENDAS (STORE)
// -----------------------------------------------------------------------------
// [QUÉ ES]: Cruza 'location' con 'store' para ver qué direcciones no corresponden a tiendas físicas.
print("\n[LOC-3] Direcciones NO usadas por Tiendas (store) (primeras 5 de 601):");
const locNoStore = db.location.aggregate([
  {
    $lookup: {
      from: "store",
      localField: "addressId",
      foreignField: "addressId",
      as: "tiendas"
    }
  },
  {
    // Filtra las direcciones donde el arreglo 'tiendas' está vacío.
    $match: {
      "tiendas.0": { $exists: false }
    }
  },
  {
    $project: {
      _id: 0,
      addressId: 1,
      address: 1,
      cantidadTiendas: { $size: "$tiendas" }
    }
  },
  { $sort: { addressId: 1 } },
  { $limit: 5 }
]).toArray();
printjson(locNoStore);


// =============================================================================
// SECCIÓN ESPECIAL II: CORRECCIÓN Y REESTRUCTURACIÓN DEL MODELO DE DATOS
// =============================================================================
// [OBJETIVO]: Limpiar las estructuras intermedias que quedaron de la migración relacional
//             y dejar un modelo 100% nativo y limpio de MongoDB.
print("\n=====================================================================");
print("CORRECCIÓN DE MODELO: DESNORMALIZACIÓN DOCUMENTAL");


// -----------------------------------------------------------------------------
// T-1: En 'film', transformar 'filmCategories' (array) en objeto directo 'category'
// -----------------------------------------------------------------------------
// [PROBLEMA]: Al migrar de SQL, la categoría quedó como un arreglo innecesario: filmCategories: [{ categoryId: 14, name: 'Sci-Fi' }].
// [SOLUCIÓN]: En Mongo, una película pertenece a UNA categoría; debe ser un objeto directo: category: { categoryId: 14, name: 'Sci-Fi' }.
print("\n[T-1] Transformando 'filmCategories' en objeto 'category' en colección film...");
db.film.updateMany(
  { filmCategories: { $exists: true } }, // Aplica a todas las películas que tengan el campo viejo
  [
    {
      $set: {
        // $arrayElemAt: Extrae el elemento en la posición 0 del arreglo viejo
        category: { $arrayElemAt: ["$filmCategories.category", 0] }
      }
    },
    {
      // $unset: Elimina por completo el campo viejo 'filmCategories' para no duplicar datos
      $unset: "filmCategories"
    }
  ]
);
print("Ficha de película actualizada (muestra de categoría limpia):");
printjson(db.film.findOne({ filmId: 307 }, { _id: 0, filmId: 1, title: 1, category: 1 }));


// -----------------------------------------------------------------------------
// T-2: En 'film', transformar 'filmActors' en array directo y limpio 'actors'
// -----------------------------------------------------------------------------
// [PROBLEMA]: El arreglo 'filmActors' traía campos intermedios de la tabla puente SQL.
// [SOLUCIÓN]: Usar $map para dejar un arreglo limpio solo con los datos del actor: { actorId, firstName, lastName }.
print("\n[T-2] Transformando 'filmActors' en array directo de actores 'actors'...");
db.film.updateMany(
  { filmActors: { $exists: true } },
  [
    {
      $set: {
        actors: {
          // $map: Recorre cada elemento 'fa' del arreglo 'filmActors' y extrae solo su subdocumento 'actor'
          $map: {
            input: "$filmActors",
            as: "fa",
            in: "$$fa.actor"
          }
        }
      }
    },
    {
      // Borra el campo viejo con la estructura intermedia
      $unset: "filmActors"
    }
  ]
);
print("Ficha de película actualizada (muestra de primeros 2 actores):");
printjson(db.film.findOne({ filmId: 307 }, { _id: 0, filmId: 1, title: 1, actors: { $slice: 2 } }));


// -----------------------------------------------------------------------------
// T-3: En 'customer', anidar cada 'payment' adentro de su respectivo 'rental'
// -----------------------------------------------------------------------------
// [PROBLEMA]: En SQL, los pagos estaban en una tabla separada 'payment'.
// [SOLUCIÓN]: En la vida real, un pago siempre le pertenece a un arriendo específico. Lo guardamos dentro de 'rentals'.
print("\n[T-3] Anidando objeto 'payment' dentro de cada arriendo en 'rentals'...");
db.customer.find({ payments: { $exists: true } }).forEach(function(cust) {
  if (!cust.rentals) return;

  // 1. Crea un diccionario rápido de pagos indexado por 'rentalId'
  var paymentMap = {};
  if (cust.payments) {
    cust.payments.forEach(function(p) {
      if (p.rentalId) {
        paymentMap[p.rentalId] = {
          paymentId: p.paymentId,
          amount: p.amount,
          paymentDate: p.paymentDate,
          staffId: p.staffId,
          lastUpdate: p.lastUpdate
        };
      }
    });
  }

  // 2. Recorre cada arriendo del cliente y le inyecta su pago correspondiente
  var updatedRentals = cust.rentals.map(function(r) {
    var rObj = Object.assign({}, r);
    rObj.payment = paymentMap[r.rentalId] || null; // Si tiene pago lo guarda, si no deja null
    return rObj;
  });

  // 3. Actualiza el documento del cliente en MongoDB
  db.customer.updateOne(
    { _id: cust._id },
    {
      $set: { rentals: updatedRentals }, // Guarda la lista de arriendos con pagos adentro
      $unset: { payments: "" }           // Borra la lista vieja de pagos sueltos
    }
  );
});
print("Ficha de cliente actualizada (muestra de arriendo con pago anidado):");
printjson(db.customer.findOne({ customerId: 347 }, { _id: 0, customerId: 1, firstName: 1, "rentals": { $slice: 1 } }));


// =============================================================================
// 1. OPERACIONES CREATE (INSERCIONES)
// =============================================================================
print("\n=====================================================================");
print("1. OPERACIONES CREATE (INSERCIONES)");


// -----------------------------------------------------------------------------
// C1: Inserción individual (insertOne) de una película con elenco y categoría embebidos
// -----------------------------------------------------------------------------
// [QUÉ ES]: Da de alta una nueva película ('INCEPTION CHRONICLES') con ID 1001.
// [POR QUÉ ESTÁ AQUÍ]: Demuestra que en Mongo guardamos la película con sus actores y categoría de una sola vez.
print("\n[C1] Inserción de nueva película (filmId: 1001)...");
db.film.deleteOne({ filmId: 1001 }); // Borrado preventivo para permitir re-ejecutar el script sin error de duplicado

const resC1 = db.film.insertOne({
    filmId: 1001,
    title: "INCEPTION CHRONICLES",
    description: "Un thriller psicologico que explora el subconsciente mediante arquitectura de suenos compartidos.",
    releaseYear: "2026",
    languageId: 1,
    originalLanguageId: null,
    rentalDuration: 5,
    rentalRate: 4.99,
    length: 148,
    replacementCost: 24.99,
    rating: "PG-13",
    specialFeatures: "Trailers,Deleted Scenes,Behind the Scenes",
    lastUpdate: new Date(),
    // Arreglo de actores embebido directamente en la película
    actors: [
        { actorId: 201, firstName: "LEONARDO", lastName: "DICAPRIO", lastUpdate: new Date() },
        { actorId: 202, firstName: "MARION", lastName: "COTILLARD", lastUpdate: new Date() }
    ],
    // Categoría embebida como objeto directo
    category: { categoryId: 14, name: "Sci-Fi", lastUpdate: new Date() },
    // Idioma embebido como objeto directo
    language: { languageId: 1, name: "English", lastUpdate: new Date() }
});
printjson(resC1); // Imprime { acknowledged: true, insertedId: ... }


// -----------------------------------------------------------------------------
// C2: Inserción individual (insertOne) de un cliente con arriendo y pago integrado
// -----------------------------------------------------------------------------
// [QUÉ ES]: Da de alta un nuevo cliente ('CARLOS MENDOZA') con ID 600.
// [POR QUÉ ESTÁ AQUÍ]: Demuestra que el cliente se guarda junto a su historial de arriendo y comprobante de pago.
print("\n[C2] Inserción de nuevo cliente con arriendo y pago integrado (customerId: 600)...");
db.customer.deleteOne({ customerId: 600 }); // Borrado preventivo

const resC2 = db.customer.insertOne({
    customerId: 600,
    storeId: 1,
    firstName: "CARLOS",
    lastName: "MENDOZA",
    email: "CARLOS.MENDOZA@sakilacustomer.org",
    addressId: 10,
    active: "1",
    createDate: new Date(),
    lastUpdate: new Date(),
    // Arreglo de arriendos con el pago incrustado adentro
    rentals: [
        {
            rentalId: 16050,
            rentalDate: new Date(),
            inventoryId: 10,
            customerId: 600,
            returnDate: null, // null significa que la película aún no ha sido devuelta
            staffId: 1,
            lastUpdate: new Date(),
            // Pago anidado adentro del arriendo
            payment: {
                paymentId: 16050,
                amount: 4.99,
                paymentDate: new Date(),
                staffId: 1,
                lastUpdate: new Date()
            }
        }
    ]
});
printjson(resC2);


// -----------------------------------------------------------------------------
// C3: Inserción masiva (insertMany) en 'film'
// -----------------------------------------------------------------------------
// [QUÉ ES]: Inserta múltiples películas (IDs 1002 y 1003) en una sola operación de red.
// [POR QUÉ ESTÁ AQUÍ]: Demuestra la eficiencia de insertar lotes de datos en MongoDB.
print("\n[C3] Inserción masiva de dos películas (filmId: 1002, 1003)...");
db.film.deleteMany({ filmId: { $in: [1002, 1003] } }); // Borrado preventivo

const resC3 = db.film.insertMany([
    {
        filmId: 1002,
        title: "QUANTUM ODYSSEY",
        description: "Expedicion espacial a traves de una singularidad cuantico-temporal.",
        releaseYear: "2026",
        rentalDuration: 7,
        rentalRate: 3.99,
        length: 135,
        replacementCost: 19.99,
        rating: "PG",
        category: { categoryId: 14, name: "Sci-Fi" },
        language: { languageId: 1, name: "English" },
        actors: [],
        lastUpdate: new Date()
    },
    {
        filmId: 1003,
        title: "CYBERNETIC SHADOWS",
        description: "Intriga detectivesca en los suburbios tecnologicos de Neo-Tokio.",
        releaseYear: "2026",
        rentalDuration: 6,
        rentalRate: 4.99,
        length: 120,
        replacementCost: 22.99,
        rating: "R",
        category: { categoryId: 1, name: "Action" },
        language: { languageId: 1, name: "English" },
        actors: [],
        lastUpdate: new Date()
    }
]);
printjson(resC3);


// =============================================================================
// 2. OPERACIONES READ (CONSULTAS Y FILTROS)
// =============================================================================
print("\n=====================================================================");
print("2. OPERACIONES READ (CONSULTAS)");


// -----------------------------------------------------------------------------
// R1: Consulta compuesta con operadores comparativos ($gt), orden y proyección
// -----------------------------------------------------------------------------
// [QUÉ ES]: Busca películas PG-13, con tarifa 4.99 y duración > 120 minutos.
// [OPERADORES]: $gt = Greater Than (mayor a).
print("\n[R1] Películas PG-13 con duración > 120 min y tarifa 4.99 (Top 3 por duración):");
const resR1 = db.film.find(
    // 1. Filtros de búsqueda (WHERE)
    { rating: "PG-13", rentalRate: 4.99, length: { $gt: 120 } },
    // 2. Proyección de columnas (SELECT): 0 oculta, 1 muestra
    { _id: 0, filmId: 1, title: 1, rating: 1, rentalRate: 1, length: 1 }
).sort({ length: -1 }).limit(3).toArray(); // sort(-1) ordena de mayor a menor; limit(3) trae 3
printjson(resR1);


// -----------------------------------------------------------------------------
// R2: Búsqueda sobre el array 'actors' usando notación de punto
// -----------------------------------------------------------------------------
// [QUÉ ES]: Encuentra películas donde actúa PENELOPE GUINESS.
// [POR QUÉ ES CLAVE]: 'actors.firstName' busca directo dentro del arreglo interno sin hacer ningún JOIN.
print("\n[R2] Películas donde actúa PENELOPE GUINESS (primeras 3):");
const resR2 = db.film.find(
    { "actors.firstName": "PENELOPE", "actors.lastName": "GUINESS" },
    { _id: 0, filmId: 1, title: 1, releaseYear: 1, rating: 1, rentalRate: 1 }
).limit(3).toArray();
printjson(resR2);


// -----------------------------------------------------------------------------
// R3: Consulta anidada profunda en 'location' (city -> country)
// -----------------------------------------------------------------------------
// [QUÉ ES]: Busca direcciones ubicadas en 'United Kingdom'.
// [NOTACIÓN PUNTO]: 'city.country.country' accede al objeto país dentro del objeto ciudad.
print("\n[R3] Direcciones ubicadas en 'United Kingdom' (primeras 3):");
const resR3 = db.location.find(
    { "city.country.country": "United Kingdom" },
    { _id: 0, addressId: 1, address: 1, district: 1, "city.city": 1, "city.country.country": 1 }
).limit(3).toArray();
printjson(resR3);


// -----------------------------------------------------------------------------
// R4: Consulta sobre arriendos pendientes de devolución (returnDate: null)
// -----------------------------------------------------------------------------
// [QUÉ ES]: Encuentra clientes que tienen arriendos sin devolver.
print("\n[R4] Clientes con arriendos pendientes de retorno (primeros 2):");
const resR4 = db.customer.find(
    { "rentals.returnDate": null },
    { _id: 0, customerId: 1, firstName: 1, lastName: 1, email: 1 }
).limit(2).toArray();
printjson(resR4);


// -----------------------------------------------------------------------------
// R5: Pipeline de agregación: Facturación total por cliente (Top 5 clientes)
// -----------------------------------------------------------------------------
// [QUÉ ES]: Suma todo el dinero pagado por cada cliente a lo largo de su historial.
// [RESULTADO]: 1° Karl Seal ($221.55), 2° Eleanor Hunt ($216.54), 3° Clara Shaw ($195.58).
print("\n[R5] PIPELINE AGREGACIÓN: Top 5 clientes por monto total pagado:");
const resR5 = db.customer.aggregate([
    // Paso 1: $unwind abre la lista de arriendos en filas individuales
    { $unwind: "$rentals" },
    // Paso 2: $match descarta los arriendos que no tengan pago registrado
    { $match: { "rentals.payment": { $ne: null } } },
    // Paso 3: $group agrupa por customerId y suma los montos pagados
    {
        $group: {
            _id: {
                customerId: "$customerId",
                cliente: { $concat: ["$firstName", " ", "$lastName"] } // Concatena nombre y apellido
            },
            totalPagado: { $sum: "$rentals.payment.amount" },           // Suma montos de pago
            transacciones: { $sum: 1 }                                  // Cuenta cantidad de pagos
        }
    },
    // Paso 4: $project limpia la salida y redondea los decimales a 2 dígitos
    {
        $project: {
            _id: 0,
            customerId: "$_id.customerId",
            cliente: "$_id.cliente",
            totalPagado: { $round: ["$totalPagado", 2] },
            transacciones: 1
        }
    },
    // Paso 5: $sort ordena de mayor a menor según el dinero pagado
    { $sort: { totalPagado: -1 } },
    // Paso 6: $limit deja solo a los 5 primeros
    { $limit: 5 }
]).toArray();
printjson(resR5);


// -----------------------------------------------------------------------------
// R6: Pipeline de agregación: Total de películas y tarifa promedio por categoría
// -----------------------------------------------------------------------------
// [QUÉ ES]: Cuenta cuántas películas hay por género y saca la tarifa promedio de arriendo.
// [RESULTADO]: Sports lidera con 74 películas a $3.13 promedio.
print("\n[R6] PIPELINE AGREGACIÓN: Total películas y tarifa promedio por categoría (Top 5):");
const resR6 = db.film.aggregate([
    // Paso 1: Agrupa por el nombre de la categoría embebida ($category.name)
    {
        $group: {
            _id: "$category.name",
            totalPeliculas: { $sum: 1 },             // Cuenta 1 por cada película encontrada
            tarifaPromedio: { $avg: "$rentalRate" }   // $avg calcula el promedio de tarifa
        }
    },
    // Paso 2: Da formato limpio a la salida
    {
        $project: {
            _id: 0,
            categoria: "$_id",
            totalPeliculas: 1,
            tarifaPromedio: { $round: ["$tarifaPromedio", 2] } // Redondea a 2 decimales
        }
    },
    // Paso 3: Ordena por cantidad de títulos descendente
    { $sort: { totalPeliculas: -1 } },
    { $limit: 5 }
]).toArray();
printjson(resR6);


// =============================================================================
// 3. OPERACIONES UPDATE (ACTUALIZACIONES)
// =============================================================================
print("\n=====================================================================");
print("3. OPERACIONES UPDATE (ACTUALIZACIONES)");


// -----------------------------------------------------------------------------
// U1: Actualización de campos escalares con $set
// -----------------------------------------------------------------------------
// [QUÉ ES]: Cambia la tarifa de arriendo a 5.99 y la duración a 7 días en la película 1001.
// [OPERADOR]: $set solo modifica los campos indicados sin borrar el resto del documento.
print("\n[U1] Actualización escalar de tarifa y duración (filmId: 1001)...");
const resU1 = db.film.updateOne(
    { filmId: 1001 },
    { $set: { rentalRate: 5.99, rentalDuration: 7, lastUpdate: new Date() } }
);
printjson(resU1);


// -----------------------------------------------------------------------------
// U2: Inserción de un nuevo arriendo con $push dentro de la lista 'rentals'
// -----------------------------------------------------------------------------
// [QUÉ ES]: Agrega un arriendo nuevo al cliente 347 sin tocar los 30 arriendos que ya tenía.
// [OPERADOR]: $push añade un elemento al final de un arreglo.
print("\n[U2] Agregar nuevo arriendo con $push al cliente 347...");
const resU2 = db.customer.updateOne(
    { customerId: 347 },
    {
        $push: {
            rentals: {
                rentalId: 16051,
                rentalDate: new Date(),
                inventoryId: 4527,
                customerId: 347,
                returnDate: null,
                staffId: 2,
                lastUpdate: new Date(),
                payment: {
                    paymentId: 16051,
                    amount: 5.99,
                    paymentDate: new Date(),
                    staffId: 2,
                    lastUpdate: new Date()
                }
            }
        },
        $set: { lastUpdate: new Date() } // Actualiza la fecha de modificación del cliente
    }
);
printjson(resU2);


// -----------------------------------------------------------------------------
// U3: Modificación posicional precisa con arrayFilters (Registrar devolución)
// -----------------------------------------------------------------------------
// [QUÉ ES]: Marca como devuelto (asigna returnDate) ÚNICAMENTE al arriendo 16051.
// [POR QUÉ ES CLAVE]: arrayFilters permite modificar un elemento puntual adentro de una lista sin alterar los otros arriendos del cliente.
print("\n[U3] Registrar fecha de devolución en subdocumento mediante arrayFilters...");
const resU3 = db.customer.updateOne(
    { customerId: 347 },
    {
        $set: {
            // $[elem] apunta al elemento exacto que cumple la condición de arrayFilters abajo
            "rentals.$[elem].returnDate": new Date(),
            "rentals.$[elem].lastUpdate": new Date(),
            lastUpdate: new Date()
        }
    },
    {
        // Filtro que identifica cuál arriendo modificar dentro de la lista
        arrayFilters: [{ "elem.rentalId": 16051 }]
    }
);
printjson(resU3);


// -----------------------------------------------------------------------------
// U4: Actualización masiva con $inc (Incremento de valores numéricos)
// -----------------------------------------------------------------------------
// [QUÉ ES]: Sube en 50 centavos ($0.50) el costo de reemplazo de todas las películas infantiles ('G').
// [OPERADOR]: $inc suma o resta valores numéricos directamente en la base de datos sin tener que leerlos antes.
print("\n[U4] Incremento masivo ($inc) de costo de reemplazo para películas 'G'...");
const resU4 = db.film.updateMany(
    { rating: "G" },
    {
        $inc: { replacementCost: 0.50 }, // Suma 0.50 al valor actual
        $set: { lastUpdate: new Date() }
    }
);
printjson(resU4);


// =============================================================================
// 4. OPERACIONES DELETE (ELIMINACIONES)
// =============================================================================
print("\n=====================================================================");
print("4. OPERACIONES DELETE (ELIMINACIONES)");


// -----------------------------------------------------------------------------
// D1: Eliminación individual de un documento entero (deleteOne)
// -----------------------------------------------------------------------------
// [QUÉ ES]: Borra físicamente la película con ID 1002 de la colección 'film'.
print("\n[D1] Eliminación de película individual (filmId: 1002)...");
const resD1 = db.film.deleteOne({ filmId: 1002 });
printjson(resD1);


// -----------------------------------------------------------------------------
// D2: Eliminación de un subdocumento con $pull (Anulación de arriendo)
// -----------------------------------------------------------------------------
// [QUÉ ES]: Quita el arriendo 16050 de la lista 'rentals' del cliente 600.
// [POR QUÉ ES CLAVE]: $pull remueve solo ese elemento de la lista sin borrar al cliente.
print("\n[D2] Remoción de arriendo anulado con $pull en el cliente 600...");
const resD2 = db.customer.updateOne(
    { customerId: 600 },
    {
        // $pull jala (elimina) los elementos del arreglo que coincidan con la condición
        $pull: {
            rentals: { rentalId: 16050 }
        },
        $set: { lastUpdate: new Date() }
    }
);
printjson(resD2);


// -----------------------------------------------------------------------------
// D3: Eliminación masiva condicional con deleteMany
// -----------------------------------------------------------------------------
// [QUÉ ES]: Borra todos los clientes de prueba que tengan un correo temporal terminado en '@test.sakilacustomer.org'.
// [PATRÓN REGEX]: /.*@test\.sakilacustomer\.org$/i es una expresión regular para detectar correos de prueba.
print("\n[D3] Eliminación masiva condicional de clientes temporales...");
const resD3 = db.customer.deleteMany({
    email: /.*@test\.sakilacustomer\.org$/i
});
printjson(resD3);


// =============================================================================
// 5. RESUMEN Y COMPROBACIÓN FINAL
// =============================================================================
// [QUÉ ES]: Muestra el conteo final de documentos en las 4 colecciones.
// [PARA QUÉ SIRVE]: Comprueba que todas las operaciones terminaron con éxito y que la base de datos está consistente.
print("\n=====================================================================");
print("5. RESUMEN Y COMPROBACIÓN FINAL");

print("Conteo final de documentos:");
print("customer: " + db.customer.countDocuments());
print("film:     " + db.film.countDocuments());
print("location: " + db.location.countDocuments());
print("store:    " + db.store.countDocuments());
print("\n>>> SCRIPT CRUD Y REESTRUCTURACIÓN EJECUTADO EXITOSAMENTE <<<\n");
