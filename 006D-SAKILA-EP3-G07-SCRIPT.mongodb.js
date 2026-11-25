// =============================================================================
// SELECCIÓN DE BASE DE DATOS
// =============================================================================
// [EN SIMPLE]: Le decimos a MongoDB que trabaje sobre la base de datos 'sakila'.
// [POR QUÉ]: Si no ponemos esto, Mongo guardaría las cosas en una base temporal llamada 'test'.
use('sakila');

// -----------------------------------------------------------------------------
// VERIFICACIÓN INICIAL DE ESTADO DE COLECCIONES
// -----------------------------------------------------------------------------
// [EN SIMPLE]: Contamos cuántas cosas hay guardadas antes de empezar a hacer nada.
// [RESULTADO ESPERADO]: 599 clientes, 1.000 películas, 603 direcciones y 2 tiendas físicas.
print("\n>>> Comprobación de estado inicial de colecciones...");
print("Documentos en 'customer' (Clientes):    " + db.customer.countDocuments()); // Da 599
print("Documentos en 'film' (Películas):       " + db.film.countDocuments());     // Da 1.000
print("Documentos en 'location' (Direcciones): " + db.location.countDocuments()); // Da 603
print("Documentos en 'store' (Tiendas):        " + db.store.countDocuments());    // Da 2


// =============================================================================
// SECCIÓN ESPECIAL I: TAREA DE LOCATIONS (REVISIÓN DE DIRECCIONES)
// =============================================================================
// [OBJETIVO]: Encontrar si hay direcciones guardadas donde NO viva ningún cliente.
print("\n=====================================================================");
print("TAREA DE LOCATIONS: CHEQUEO DE DIRECCIONES NO USADAS");
print("=====================================================================");

// -----------------------------------------------------------------------------
// 1. DIRECCIONES DONDE NO VIVE NINGÚN CLIENTE
// -----------------------------------------------------------------------------
// [LA PREGUNTA]: De las 603 direcciones, ¿hay alguna donde no viva ningún cliente?
// [LA RESPUESTA]: Sí, hay exactamente 4 direcciones: IDs 1, 2, 3 y 4.
// [POR QUÉ EXISTEN]: La 1 y 2 son las TIENDAS. La 3 y 4 son los EMPLEADOS (Mike y Jon).
print("\n[LOC-1] Direcciones NO usadas por Clientes (primeras 5):");
const locNoClientes = db.location.aggregate([
  {
    // $lookup: Va a la lista de clientes y busca quién vive en esta dirección.
    $lookup: {
      from: "customer",          // Revisa en la colección 'customer'
      localField: "addressId",   // Toma el número de dirección de la casa
      foreignField: "addressId", // Busca qué cliente tiene ese mismo número de dirección
      as: "clientes"             // Guarda los clientes encontrados adentro de una lista llamada 'clientes'
    }
  },
  {
    // $match: Filtra y se queda solo con las casas donde la lista 'clientes' está vacía (nadie vive ahí).
    // "clientes.0": { $exists: false } significa literalmente: "la lista no tiene ni un primer cliente".
    $match: {
      "clientes.0": { $exists: false }
    }
  },
  {
    // $project: Selecciona qué datos mostrar en pantalla limpia.
    $project: {
      _id: 0,                                 // Oculta el ID raro de Mongo (_id)
      addressId: 1,                           // Muestra el número de dirección (1, 2, 3, 4)
      address: 1,                             // Muestra el nombre de la calle
      cantidadClientes: { $size: "$clientes" } // Muestra cuántos clientes viven ahí (dará 0)
    }
  },
  { 
    // $sort: Ordena de menor a mayor por número de dirección (1 = ascendente).
    $sort: { addressId: 1 } 
  }
]).toArray();
printjson(locNoClientes); // Imprime el resultado en formato legible


// =============================================================================
// SECCIÓN ESPECIAL II: CORRECCIÓN Y REESTRUCTURACIÓN DEL MODELO DE DATOS
// =============================================================================
// [OBJETIVO]: Limpiar la basura que quedó de SQL y dejar un modelo moderno en MongoDB.
print("\n=====================================================================");
print("CORRECCIÓN DE MODELO: DESNORMALIZACIÓN DOCUMENTAL");
print("=====================================================================");

// -----------------------------------------------------------------------------
// T-1: En 'film', transformar 'filmCategories' en objeto directo 'category'
// -----------------------------------------------------------------------------
// [EL PROBLEMA]: La categoría de la película venía metida en una lista innecesaria: filmCategories: [{ categoryId: 14, name: 'Sci-Fi' }].
// [LA SOLUCIÓN]: Una película tiene UNA sola categoría. Debe ser un objeto directo: category: { categoryId: 14, name: 'Sci-Fi' }.
print("\n[T-1] Transformando 'filmCategories' en objeto directo 'category' en film...");
db.film.updateMany(
  { filmCategories: { $exists: true } }, // Se aplica a todas las películas que tengan el campo viejo
  [
    {
      $set: {
        // $arrayElemAt: Toma la primera categoría de la lista vieja (posición 0) y la guarda como objeto limpio
        category: { $arrayElemAt: ["$filmCategories.category", 0] }
      }
    },
    {
      // $unset: Borra para siempre la lista vieja 'filmCategories' para no duplicar datos
      $unset: "filmCategories"
    }
  ]
);
print("Ficha de película actualizada (muestra de categoría limpia):");
printjson(db.film.findOne({ filmId: 307 }, { _id: 0, filmId: 1, title: 1, category: 1 }));


// -----------------------------------------------------------------------------
// T-2: En 'film', transformar 'filmActors' en lista limpia de actores 'actors'
// -----------------------------------------------------------------------------
// [EL PROBLEMA]: La lista de actores traía columnas intermedias viejas de la tabla puente de SQL.
// [LA SOLUCIÓN]: Usar $map para dejar una lista limpia que solo tenga: { actorId, firstName, lastName }.
print("\n[T-2] Transformando 'filmActors' en lista directa de actores 'actors'...");
db.film.updateMany(
  { filmActors: { $exists: true } }, // Aplica a todas las películas con la lista vieja
  [
    {
      $set: {
        actors: {
          // $map: Recorre cada actor 'fa' de la lista vieja y extrae solo sus datos limpios
          $map: {
            input: "$filmActors",
            as: "fa",
            in: "$$fa.actor"
          }
        }
      }
    },
    {
      // Borra la lista vieja que tenía los campos intermedios
      $unset: "filmActors"
    }
  ]
);
print("Ficha de película actualizada (muestra de primeros 2 actores en lista limpia):");
printjson(db.film.findOne({ filmId: 307 }, { _id: 0, filmId: 1, title: 1, actors: { $slice: 2 } }));


// -----------------------------------------------------------------------------
// T-3: En 'customer', guardar cada 'payment' adentro de su arriendo en 'rentals'
// -----------------------------------------------------------------------------
// [EL PROBLEMA]: En SQL, los pagos de plata estaban en una tabla separada 'payment'.
// [LA SOLUCIÓN]: En la vida real, un pago es la boleta de un arriendo. Lo guardamos adentro del arriendo al que pertenece.
print("\n[T-3] Guardando comprobante de pago adentro de cada arriendo en 'rentals'...");
db.customer.find({ payments: { $exists: true } }).forEach(function(cust) {
  if (!cust.rentals) return;

  // 1. Arma una lista rápida con los pagos del cliente usando su rentalId
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

  // 2. Recorre cada arriendo del cliente y le mete su comprobante de pago adentro
  var updatedRentals = cust.rentals.map(function(r) {
    var rObj = Object.assign({}, r);
    rObj.payment = paymentMap[r.rentalId] || null; // Si tiene pago lo guarda, si no deja null
    return rObj;
  });

  // 3. Guarda los arriendos con sus pagos embebidos y borra la lista vieja suelta
  db.customer.updateOne(
    { _id: cust._id },
    {
      $set: { rentals: updatedRentals }, // Guarda la lista nueva con pagos integrados
      $unset: { payments: "" }           // Borra la lista vieja de pagos sueltos
    }
  );
});
print("Ficha de cliente actualizada (muestra de arriendo con pago integrado adentro):");
printjson(db.customer.findOne({ customerId: 347 }, { _id: 0, customerId: 1, firstName: 1, "rentals": { $slice: 1 } }));


// =============================================================================
// 1. OPERACIONES CREATE (INSERTAR DATOS NUEVOS)
// =============================================================================
// [OBJETIVO]: Demostrar que podemos guardar registros nuevos completos de una sola vez.
print("\n=====================================================================");
print("1. OPERACIONES CREATE (INSERCIONES)");
print("=====================================================================");

// -----------------------------------------------------------------------------
// C1: Insertar una película nueva con actores y categoría adentro (insertOne)
// -----------------------------------------------------------------------------
// [QUÉ ES]: Guarda la película 'INCEPTION CHRONICLES' con ID 1001.
// [POR QUÉ ES MEJOR]: En SQL tendríamos que hacer 3 INSERTs en tablas distintas. En Mongo es 1 sola línea.
print("\n[C1] Inserción de nueva película completa (filmId: 1001)...");
db.film.deleteOne({ filmId: 1001 }); // Borrado preventivo para poder re-ejecutar sin error de ID repetido

const resC1 = db.film.insertOne({
    filmId: 1001,
    title: "INCEPTION CHRONICLES",
    description: "Un thriller psicologico que explora el subconsciente mediante arquitectura de suenos compartidos.",
    releaseYear: "2026",
    languageId: 1,
    originalLanguageId: null,
    rentalDuration: 5,        // Días de arriendo permitidos
    rentalRate: 4.99,          // Precio del arriendo en dólares
    length: 148,               // Duración en minutos
    replacementCost: 24.99,    // Costo si el cliente pierde el DVD
    rating: "PG-13",           // Calificación de edad
    specialFeatures: "Trailers,Deleted Scenes,Behind the Scenes",
    lastUpdate: new Date(),    // Fecha y hora actual
    // Lista de actores embebida adentro de la película:
    actors: [
        { actorId: 201, firstName: "LEONARDO", lastName: "DICAPRIO", lastUpdate: new Date() },
        { actorId: 202, firstName: "MARION", lastName: "COTILLARD", lastUpdate: new Date() }
    ],
    // Categoría embebida como objeto directo:
    category: { categoryId: 14, name: "Sci-Fi", lastUpdate: new Date() },
    // Idioma embebido como objeto directo:
    language: { languageId: 1, name: "English", lastUpdate: new Date() }
});
printjson(resC1); // Muestra { acknowledged: true, insertedId: ... }


// -----------------------------------------------------------------------------
// C2: Insertar un cliente nuevo con su primer arriendo y su pago adentro (insertOne)
// -----------------------------------------------------------------------------
// [QUÉ ES]: Guarda al cliente 'CARLOS MENDOZA' (ID 600) junto con la película que arrendó y su boleta.
print("\n[C2] Inserción de nuevo cliente con arriendo y pago integrado (customerId: 600)...");
db.customer.deleteOne({ customerId: 600 }); // Borrado preventivo

const resC2 = db.customer.insertOne({
    customerId: 600,
    storeId: 1,
    firstName: "CARLOS",
    lastName: "MENDOZA",
    email: "CARLOS.MENDOZA@sakilacustomer.org",
    addressId: 10,
    active: "1",               // 1 = Cliente activo
    createDate: new Date(),
    lastUpdate: new Date(),
    // Lista de arriendos con la boleta de pago adentro:
    rentals: [
        {
            rentalId: 16050,
            rentalDate: new Date(),
            inventoryId: 10,
            customerId: 600,
            returnDate: null,  // null = Aún no devuelve la película
            staffId: 1,
            lastUpdate: new Date(),
            // Boleta de pago guardada adentro del arriendo:
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
// C3: Inserción masiva de dos películas juntas (insertMany)
// -----------------------------------------------------------------------------
// [QUÉ ES]: Guarda dos películas (IDs 1002 y 1003) en un solo viaje al disco.
// [POR QUÉ SE USA]: Es mucho más rápido guardar 100 películas juntas con insertMany que hacer 100 llamadas individuales.
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
// 2. OPERACIONES READ (HACER CONSULTAS Y REPORTES)
// =============================================================================
// [OBJETIVO]: Demostrar distintas formas de buscar datos sin usar JOINs.
print("\n=====================================================================");
print("2. OPERACIONES READ (CONSULTAS)");
print("=====================================================================");

// -----------------------------------------------------------------------------
// R1: Consulta con filtros combinados, orden y límite
// -----------------------------------------------------------------------------
// [QUÉ BUSCA]: Películas PG-13, que cuesten 4.99 y duren más de 120 minutos ($gt = greater than).
// [ORDEN]: sort({ length: -1 }) las ordena de la más larga a la más corta (-1 = descendente).
// [LÍMITE]: limit(3) trae solo las 3 primeras de la lista.
print("\n[R1] Películas PG-13 con duración > 120 min y tarifa 4.99 (Top 3 más largas):");
const resR1 = db.film.find(
    { rating: "PG-13", rentalRate: 4.99, length: { $gt: 120 } },
    { _id: 0, filmId: 1, title: 1, rating: 1, rentalRate: 1, length: 1 } // 0 oculta, 1 muestra
).sort({ length: -1 }).limit(3).toArray();
printjson(resR1);


// -----------------------------------------------------------------------------
// R2: Búsqueda adentro de una lista con notación de punto
// -----------------------------------------------------------------------------
// [QUÉ BUSCA]: Películas donde actúe PENELOPE GUINESS.
// [CÓMO FUNCIONA]: "actors.firstName": "PENELOPE" le dice a Mongo que entre a la lista 'actors' y busque ese nombre sin cruzar ninguna tabla.
print("\n[R2] Películas donde actúa PENELOPE GUINESS (primeras 3):");
const resR2 = db.film.find(
    { "actors.firstName": "PENELOPE", "actors.lastName": "GUINESS" },
    { _id: 0, filmId: 1, title: 1, releaseYear: 1, rating: 1, rentalRate: 1 }
).limit(3).toArray();
printjson(resR2);


// -----------------------------------------------------------------------------
// R3: Consulta anidada de dos niveles (ciudad -> país)
// -----------------------------------------------------------------------------
// [QUÉ BUSCA]: Direcciones de 'United Kingdom'.
// [NOTACIÓN DE PUNTO]: 'city.country.country' entra al objeto ciudad y luego al objeto país.
print("\n[R3] Direcciones ubicadas en 'United Kingdom' (primeras 3):");
const resR3 = db.location.find(
    { "city.country.country": "United Kingdom" },
    { _id: 0, addressId: 1, address: 1, district: 1, "city.city": 1, "city.country.country": 1 }
).limit(3).toArray();
printjson(resR3);


// -----------------------------------------------------------------------------
// R4: Buscar películas pendientes de devolución
// -----------------------------------------------------------------------------
// [QUÉ BUSCA]: Clientes que tienen returnDate: null (es decir, aún tienen la película en la casa y no la han devuelto).
print("\n[R4] Clientes con arriendos pendientes de retorno (primeros 2):");
const resR4 = db.customer.find(
    { "rentals.returnDate": null },
    { _id: 0, customerId: 1, firstName: 1, lastName: 1, email: 1 }
).limit(2).toArray();
printjson(resR4);


// -----------------------------------------------------------------------------
// R5: Pipeline de agregación: ¿Quiénes son los clientes que más plata han pagado?
// -----------------------------------------------------------------------------
// [EL REPORTE]: Suma todo el dinero de los arriendos de cada cliente.
// [RESULTADO REAL]: 1° Karl Seal ($221.55), 2° Eleanor Hunt ($216.54), 3° Clara Shaw ($195.58).
print("\n[R5] PIPELINE AGREGACIÓN: Top 5 clientes por monto total pagado:");
const resR5 = db.customer.aggregate([
    // Paso 1: $unwind abre la lista de arriendos en filas individuales
    { $unwind: "$rentals" },
    // Paso 2: $match descarta arriendos que no tengan boleta de pago
    { $match: { "rentals.payment": { $ne: null } } },
    // Paso 3: $group agrupa por cliente y suma los montos con $sum
    {
        $group: {
            _id: {
                customerId: "$customerId",
                cliente: { $concat: ["$firstName", " ", "$lastName"] } // Une nombre y apellido
            },
            totalPagado: { $sum: "$rentals.payment.amount" },           // Suma el dinero pagado
            transacciones: { $sum: 1 }                                  // Cuenta cuántos arriendos hizo
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
    // Paso 5: $sort ordena de mayor a menor gasto
    { $sort: { totalPagado: -1 } },
    // Paso 6: $limit deja solo a los 5 primeros
    { $limit: 5 }
]).toArray();
printjson(resR5);


// -----------------------------------------------------------------------------
// R6: Pipeline de agregación: Cantidad de películas y precio promedio por género
// -----------------------------------------------------------------------------
// [EL REPORTE]: Cuenta cuántas películas hay por categoría y saca el precio promedio.
// [RESULTADO REAL]: Sports tiene 74 películas a $3.13 dólares promedio.
print("\n[R6] PIPELINE AGREGACIÓN: Total películas y tarifa promedio por categoría (Top 5):");
const resR6 = db.film.aggregate([
    // Paso 1: Agrupa por el nombre de la categoría ($category.name)
    {
        $group: {
            _id: "$category.name",
            totalPeliculas: { $sum: 1 },             // Suma 1 por cada película encontrada
            tarifaPromedio: { $avg: "$rentalRate" }   // $avg calcula el promedio de precio
        }
    },
    // Paso 2: Limpia la salida y redondea el promedio a 2 decimales
    {
        $project: {
            _id: 0,
            categoria: "$_id",
            totalPeliculas: 1,
            tarifaPromedio: { $round: ["$tarifaPromedio", 2] }
        }
    },
    // Paso 3: Ordena por cantidad de películas de mayor a menor
    { $sort: { totalPeliculas: -1 } },
    { $limit: 5 }
]).toArray();
printjson(resR6);


// =============================================================================
// 3. OPERACIONES UPDATE (MODIFICAR DATOS)
// =============================================================================
// [OBJETIVO]: Demostrar cómo cambiar valores, agregar a listas o modificar un solo arriendo.
print("\n=====================================================================");
print("3. OPERACIONES UPDATE (ACTUALIZACIONES)");
print("=====================================================================");

// -----------------------------------------------------------------------------
// U1: Modificar valores simples con $set
// -----------------------------------------------------------------------------
// [QUÉ HACE]: Sube la tarifa a 5.99 y la duración a 7 días en la película 1001.
// [OPERADOR $set]: Solo cambia los campos mencionados; no borra nada del resto de la película.
print("\n[U1] Actualización simple de tarifa y duración (filmId: 1001)...");
const resU1 = db.film.updateOne(
    { filmId: 1001 },
    { $set: { rentalRate: 5.99, rentalDuration: 7, lastUpdate: new Date() } }
);
printjson(resU1);


// -----------------------------------------------------------------------------
// U2: Agregar un arriendo nuevo a la lista con $push
// -----------------------------------------------------------------------------
// [QUÉ HACE]: El cliente 347 vino a arrendar una película nueva. Con $push se la agregamos a su lista sin tocar los otros 30 arriendos que ya tenía.
// [OPERADOR $push]: Inserta un elemento al final de una lista.
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
        $set: { lastUpdate: new Date() }
    }
);
printjson(resU2);


// -----------------------------------------------------------------------------
// U3: Modificar solo un arriendo puntual con arrayFilters (Registrar devolución)
// -----------------------------------------------------------------------------
// [QUÉ HACE]: El cliente 347 vino a devolver ÚNICAMENTE la película del arriendo 16051.
// [POR QUÉ ES CLAVE]: arrayFilters le dice a Mongo: "Modifícale la fecha de devolución SOLAMENTE al arriendo 16051; deja intactos los otros 29 arriendos".
print("\n[U3] Registrar fecha de devolución en un solo arriendo con arrayFilters...");
const resU3 = db.customer.updateOne(
    { customerId: 347 },
    {
        $set: {
            // $[elem] apunta al arriendo exacto que coincide con el filtro de abajo
            "rentals.$[elem].returnDate": new Date(),
            "rentals.$[elem].lastUpdate": new Date(),
            lastUpdate: new Date()
        }
    },
    {
        // Filtro: busca únicamente el arriendo cuyo rentalId sea 16051
        arrayFilters: [{ "elem.rentalId": 16051 }]
    }
);
printjson(resU3);


// -----------------------------------------------------------------------------
// U4: Modificación numérica masiva con $inc
// -----------------------------------------------------------------------------
// [QUÉ HACE]: Sube en 50 centavos ($0.50) el costo de reemplazo de todas las películas infantiles ('G').
// [OPERADOR $inc]: Suma o resta números directamente en el disco sin tener que leerlos antes.
print("\n[U4] Incremento masivo ($inc) de costo de reemplazo para películas 'G'...");
const resU4 = db.film.updateMany(
    { rating: "G" },
    {
        $inc: { replacementCost: 0.50 }, // Suma 0.50 al valor que ya tenía
        $set: { lastUpdate: new Date() }
    }
);
printjson(resU4);


// =============================================================================
// 4. OPERACIONES DELETE (BORRAR DATOS)
// =============================================================================
// [OBJETIVO]: Demostrar cómo borrar documentos enteros o sacar un solo arriendo de la lista.
print("\n=====================================================================");
print("4. OPERACIONES DELETE (ELIMINACIONES)");
print("=====================================================================");

// -----------------------------------------------------------------------------
// D1: Borrar una película completa con deleteOne
// -----------------------------------------------------------------------------
// [QUÉ HACE]: Elimina físicamente la película 1002 de la colección 'film'.
print("\n[D1] Eliminación de película individual (filmId: 1002)...");
const resD1 = db.film.deleteOne({ filmId: 1002 });
printjson(resD1);


// -----------------------------------------------------------------------------
// D2: Sacar un arriendo cancelado de la lista con $pull
// -----------------------------------------------------------------------------
// [QUÉ HACE]: Un cliente canceló un arriendo por error (ID 16050).
// [POR QUÉ SE USA $pull]: Porque $pull saca el arriendo de la lista SIN borrar la cuenta del cliente.
print("\n[D2] Remoción de arriendo anulado con $pull en el cliente 600...");
const resD2 = db.customer.updateOne(
    { customerId: 600 },
    {
        // $pull jala (extrae y elimina) solo el arriendo que cumpla la condición
        $pull: {
            rentals: { rentalId: 16050 }
        },
        $set: { lastUpdate: new Date() }
    }
);
printjson(resD2);


// -----------------------------------------------------------------------------
// D3: Borrado masivo condicional con deleteMany
// -----------------------------------------------------------------------------
// [QUÉ HACE]: Borra todos los clientes de prueba temporales que terminen en '@test.sakilacustomer.org'.
print("\n[D3] Eliminación masiva condicional de clientes temporales...");
const resD3 = db.customer.deleteMany({
    email: /.*@test\.sakilacustomer\.org$/i // Expresión regular que busca correos de prueba
});
printjson(resD3);


// =============================================================================
// 5. RESUMEN Y COMPROBACIÓN FINAL
// =============================================================================
// [QUÉ ES]: Cuenta los documentos finales para comprobar que todo terminó con éxito.
print("\n=====================================================================");
print("5. RESUMEN Y COMPROBACIÓN FINAL");
print("=====================================================================");
print("Conteo final de documentos en la base de datos:");
print("customer (Clientes):    " + db.customer.countDocuments());
print("film (Películas):       " + db.film.countDocuments());
print("location (Direcciones): " + db.location.countDocuments());
print("store (Tiendas):        " + db.store.countDocuments());
print("\n>>> SCRIPT CRUD Y REESTRUCTURACIÓN EJECUTADO EXITOSAMENTE <<<\n");
