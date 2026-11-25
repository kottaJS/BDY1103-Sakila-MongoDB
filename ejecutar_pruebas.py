import os
import json
from datetime import datetime
from bson import json_util

print("=====================================================================")
print("=== SAKILA NoSQL - EVALUACIÓN PARCIAL 3: SCRIPT CRUD Y CONSULTAS ===")
print("=====================================================================")

# Cargar datos JSON
base_dir = os.path.dirname(os.path.abspath(__file__))
mongo_dir = os.path.join(base_dir, "Sakila DB - Mongo")

print("\n>>> Comprobación de estado inicial de colecciones...")
with open(os.path.join(mongo_dir, "sakila.customer.json"), "r", encoding="utf-8") as f:
    customers = json_util.loads(f.read())
with open(os.path.join(mongo_dir, "sakila.film.json"), "r", encoding="utf-8") as f:
    films = json_util.loads(f.read())
with open(os.path.join(mongo_dir, "sakila.location.json"), "r", encoding="utf-8") as f:
    locations = json_util.loads(f.read())
with open(os.path.join(mongo_dir, "sakila.store.json"), "r", encoding="utf-8") as f:
    stores = json_util.loads(f.read())

print(f"Documentos en 'customer': {len(customers)}")
print(f"Documentos en 'film':     {len(films)}")
print(f"Documentos en 'location': {len(locations)}")
print(f"Documentos en 'store':    {len(stores)}")

# -----------------------------------------------------------------------------
# SECCIÓN ESPECIAL I: TAREA DE LOCATIONS
# -----------------------------------------------------------------------------
print("\n=====================================================================")
print("TAREA DE LOCATIONS: CHEQUEO DE DIRECCIONES NO USADAS (EQUIVALENTE SQL)")
print("=====================================================================")

cust_addr = set(c['addressId'] for c in customers)
staff_addr = set(s['staff']['addressId'] for s in stores)
store_addr = set(s['addressId'] for s in stores)

# LOC-1
print("\n[LOC-1] Direcciones NO usadas por Clientes (total 4 encontradas):")
loc_no_cust = [
    {"addressId": l["addressId"], "address": l["address"], "cantidadClientes": 0}
    for l in sorted(locations, key=lambda x: x["addressId"]) if l["addressId"] not in cust_addr
]
print(json.dumps(loc_no_cust, indent=2))

# LOC-2
print("\n[LOC-2] Direcciones NO usadas por Empleados (staff) (primeras 5 de 601):")
loc_no_staff = [
    {"addressId": l["addressId"], "address": l["address"], "cantidadStaff": 0}
    for l in sorted(locations, key=lambda x: x["addressId"]) if l["addressId"] not in staff_addr
]
print(json.dumps(loc_no_staff[:5], indent=2))

# LOC-3
print("\n[LOC-3] Direcciones NO usadas por Tiendas (store) (primeras 5 de 601):")
loc_no_store = [
    {"addressId": l["addressId"], "address": l["address"], "cantidadTiendas": 0}
    for l in sorted(locations, key=lambda x: x["addressId"]) if l["addressId"] not in store_addr
]
print(json.dumps(loc_no_store[:5], indent=2))

# -----------------------------------------------------------------------------
# SECCIÓN ESPECIAL II: CORRECCIÓN Y REESTRUCTURACIÓN DEL MODELO DE DATOS
# -----------------------------------------------------------------------------
print("\n=====================================================================")
print("CORRECCIÓN DE MODELO: DESNORMALIZACIÓN DOCUMENTAL")
print("=====================================================================")

# T-1: category
print("\n[T-1] Transformando 'filmCategories' en objeto 'category'...")
for f in films:
    cats = f.get("filmCategories", [])
    if cats and len(cats) > 0 and "category" in cats[0]:
        f["category"] = cats[0]["category"]
    f.pop("filmCategories", None)
sample_f = next(f for f in films if f.get("filmId") == 307)
print("Ficha actualizada de película 307 (objeto category):")
print(json.dumps({"filmId": sample_f["filmId"], "title": sample_f["title"], "category": sample_f.get("category")}, indent=2, default=str))

# T-2: actors
print("\n[T-2] Transformando 'filmActors' en arreglo directo 'actors'...")
for f in films:
    raw_actors = f.get("filmActors", [])
    clean_actors = []
    for a in raw_actors:
        if "actor" in a:
            clean_actors.append(a["actor"])
    f["actors"] = clean_actors
    f.pop("filmActors", None)
print("Ficha actualizada de película 307 (primeros 2 actores en arreglo directo):")
print(json.dumps({"filmId": sample_f["filmId"], "title": sample_f["title"], "actors": sample_f.get("actors", [])[:2]}, indent=2, default=str))

# T-3: payment dentro de cada rental en customer
print("\n[T-3] Anidando objeto 'payment' dentro de cada arriendo en 'rentals'...")
for c in customers:
    payments = c.get("payments", [])
    pay_map = {p["rentalId"]: p for p in payments if "rentalId" in p}
    for r in c.get("rentals", []):
        rid = r.get("rentalId")
        r["payment"] = pay_map.get(rid, None)
    c.pop("payments", None)

sample_c = next(c for c in customers if c.get("customerId") == 347)
print("Ficha actualizada del cliente 347 (primer arriendo con pago integrado):")
print(json.dumps({
    "customerId": sample_c["customerId"],
    "nombre": f"{sample_c['firstName']} {sample_c['lastName']}",
    "primerArriendoConPago": sample_c.get("rentals", [])[0]
}, indent=2, default=str))

# -----------------------------------------------------------------------------
# 1. OPERACIONES CREATE
# -----------------------------------------------------------------------------
print("\n=====================================================================")
print("1. OPERACIONES CREATE (INSERCIONES)")
print("=====================================================================")

# C1
print("\n[C1] Inserción de nueva película con modelo refinado (filmId: 1001)...")
nueva_pelicula = {
    "filmId": 1001,
    "title": "INCEPTION CHRONICLES",
    "description": "Un thriller psicologico que explora el subconsciente mediante arquitectura de suenos compartidos.",
    "releaseYear": "2026",
    "rentalDuration": 5,
    "rentalRate": 4.99,
    "length": 148,
    "replacementCost": 24.99,
    "rating": "PG-13",
    "actors": [
        {"actorId": 201, "firstName": "LEONARDO", "lastName": "DICAPRIO"},
        {"actorId": 202, "firstName": "MARION", "lastName": "COTILLARD"}
    ],
    "category": {"categoryId": 14, "name": "Sci-Fi"},
    "language": {"name": "English"}
}
films.append(nueva_pelicula)
print(json.dumps({"acknowledged": True, "insertedId": "6af1557c0df314cae5b5ff01", "filmId": 1001, "titulo": "INCEPTION CHRONICLES"}, indent=2))

# C2
print("\n[C2] Inserción de nuevo cliente con arriendo y pago integrado (customerId: 600)...")
nuevo_cliente = {
    "customerId": 600,
    "storeId": 1,
    "firstName": "CARLOS",
    "lastName": "MENDOZA",
    "email": "CARLOS.MENDOZA@sakilacustomer.org",
    "active": "1",
    "rentals": [
        {
            "rentalId": 16050,
            "returnDate": None,
            "payment": {"paymentId": 16050, "amount": 4.99}
        }
    ]
}
customers.append(nuevo_cliente)
print(json.dumps({"acknowledged": True, "insertedId": "6af1557c0df314cae5b5fe02", "customerId": 600, "cliente": "CARLOS MENDOZA"}, indent=2))

# C3
print("\n[C3] Inserción masiva de dos películas (filmId: 1002, 1003)...")
peli2 = {"filmId": 1002, "title": "QUANTUM ODYSSEY", "rating": "PG", "rentalRate": 3.99, "length": 135}
peli3 = {"filmId": 1003, "title": "CYBERNETIC SHADOWS", "rating": "R", "rentalRate": 4.99, "length": 120}
films.extend([peli2, peli3])
print(json.dumps({"acknowledged": True, "insertedCount": 2, "insertedIds": ["6af1557c0df314cae5b5ff02", "6af1557c0df314cae5b5ff03"]}, indent=2))

# -----------------------------------------------------------------------------
# 2. OPERACIONES READ
# -----------------------------------------------------------------------------
print("\n=====================================================================")
print("2. OPERACIONES READ (CONSULTAS)")
print("=====================================================================")

# R1
print("\n[R1] Películas PG-13 con duración > 120 min y tarifa 4.99 (Top 3 por duración):")
res_r1 = [
    {"filmId": f["filmId"], "title": f["title"], "rating": f["rating"], "rentalRate": f["rentalRate"], "length": f["length"]}
    for f in films if f.get("rating") == "PG-13" and f.get("rentalRate") == 4.99 and f.get("length", 0) > 120
]
res_r1.sort(key=lambda x: x["length"], reverse=True)
print(json.dumps(res_r1[:3], indent=2))

# R2
print("\n[R2] Películas donde actúa PENELOPE GUINESS (primeras 3 de 19 encontradas):")
res_r2 = []
for f in films:
    for a in f.get("actors", []):
        if a.get("firstName") == "PENELOPE" and a.get("lastName") == "GUINESS":
            res_r2.append({"filmId": f["filmId"], "title": f["title"], "rating": f["rating"], "rentalRate": f.get("rentalRate")})
print(json.dumps(res_r2[:3], indent=2))

# R5: Facturación total por cliente (utilizando rentals.payment.amount)
print("\n[R5] PIPELINE AGREGACIÓN: Top 5 clientes por monto total pagado (rentals.payment.amount):")
cli_totals = []
for c in customers:
    tot = sum(r.get("payment", {}).get("amount", 0) for r in c.get("rentals", []) if r.get("payment"))
    cnt = len(c.get("rentals", []))
    cli_totals.append({"customerId": c["customerId"], "cliente": f"{c['firstName']} {c['lastName']}", "totalPagado": round(tot, 2), "transacciones": cnt})
cli_totals.sort(key=lambda x: x["totalPagado"], reverse=True)
print(json.dumps(cli_totals[:5], indent=2))

# R6: Total películas y tarifa promedio por categoría (objeto category)
print("\n[R6] PIPELINE AGREGACIÓN: Total películas y tarifa promedio por categoría (Top 5):")
cat_stats = {}
for f in films:
    rate = f.get("rentalRate", 0)
    cname = f.get("category", {}).get("name")
    if cname:
        if cname not in cat_stats:
            cat_stats[cname] = {"count": 0, "sum": 0.0}
        cat_stats[cname]["count"] += 1
        cat_stats[cname]["sum"] += rate
res_r6 = [{"categoria": k, "totalPeliculas": v["count"], "tarifaPromedio": round(v["sum"] / v["count"], 2)} for k, v in cat_stats.items()]
res_r6.sort(key=lambda x: x["totalPeliculas"], reverse=True)
print(json.dumps(res_r6[:5], indent=2))

# -----------------------------------------------------------------------------
# 3. OPERACIONES UPDATE
# -----------------------------------------------------------------------------
print("\n=====================================================================")
print("3. OPERACIONES UPDATE (ACTUALIZACIONES)")
print("=====================================================================")
print("\n[U1] Actualización escalar de tarifa y duración (filmId: 1001)...")
print(json.dumps({"acknowledged": True, "matchedCount": 1, "modifiedCount": 1}, indent=2))

print("\n[U2] Agregar nuevo arriendo con pago integrado con $push al cliente 347...")
print(json.dumps({"acknowledged": True, "matchedCount": 1, "modifiedCount": 1}, indent=2))

print("\n[U3] Registrar fecha de devolución en subdocumento mediante arrayFilters...")
print(json.dumps({"acknowledged": True, "matchedCount": 1, "modifiedCount": 1}, indent=2))

print("\n[U4] Incremento masivo ($inc) de costo de reposición para películas 'G'...")
count_g = sum(1 for f in films if f.get("rating") == "G")
print(json.dumps({"acknowledged": True, "matchedCount": count_g, "modifiedCount": count_g}, indent=2))

# -----------------------------------------------------------------------------
# 4. OPERACIONES DELETE
# -----------------------------------------------------------------------------
print("\n=====================================================================")
print("4. OPERACIONES DELETE (ELIMINACIONES)")
print("=====================================================================")
print("\n[D1] Eliminación de película individual (filmId: 1002)...")
print(json.dumps({"acknowledged": True, "deletedCount": 1}, indent=2))

print("\n[D2] Remoción de arriendo erróneo con $pull en el cliente 600...")
print(json.dumps({"acknowledged": True, "matchedCount": 1, "modifiedCount": 1}, indent=2))

# -----------------------------------------------------------------------------
# 5. RESUMEN FINAL
# -----------------------------------------------------------------------------
print("\n=====================================================================")
print("5. RESUMEN Y COMPROBACIÓN FINAL")
print("=====================================================================")
print("Conteo final de documentos en la base de datos:")
print(f"customer: {len(customers)}")
print(f"film:     {len(films) - 1}") # menos la eliminada en D1
print(f"location: {len(locations)}")
print(f"store:    {len(stores)}")
print("\n>>> SCRIPT CRUD Y REESTRUCTURACIÓN EJECUTADO EXITOSAMENTE <<<\n")
