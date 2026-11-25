# 🎬 Sakila Video Store — Modelo No Relacional en MongoDB
> **Asignatura:** Taller de Base de Datos (BDY1103)  
> **Sección:** 006D · Grupo 07 · Duoc UC  
> **Integrantes:** Maximiliano Dinamarca · Patricio Muñoz · Matías Carrasco  
> **Docente:** Igor Andrés Venegas Morales  

---

## 📌 ¿Qué hay en este repositorio?
Este repositorio contiene el script oficial de MongoDB para la **Evaluación Parcial 3**, con cada consulta explicada línea por línea, los datos oficiales del videoclub Sakila y el guion de defensa para la presentación oral.

1. **`006D-SAKILA-EP3-G07-SCRIPT.js`**: Script oficial comentado línea por línea.
2. **`ejecutar_pruebas.py`**: Validador automático en Python que ejecuta todas las consultas sobre los datos reales sin necesidad de instalar MongoDB.
3. **`GUION_DEFENSA.md`**: El guion para la presentación oral dividido para Maxi, Patricio y Matías.
4. **`GUIA_ESTUDIO_CODIGO.md`**: Guía rápida con números de línea y respuestas a preguntas de defensa.
5. **`Sakila DB - Mongo/`**: Los 4 datasets oficiales en JSON (`customer`, `film`, `location`, `store`).

---

## 🚀 ¿Cómo ejecutar el código?

### Opción 1: En tu computador ahora mismo (Sin instalar MongoDB)
Si solo tienes Python instalado, puedes ver correr todas las consultas y resultados en 2 segundos:
```bash
python ejecutar_pruebas.py
```

### Opción 2: En la consola de MongoDB (mongosh / Duoc UC Lab)
Si estás en los laboratorios de Duoc o tienes MongoDB instalado:
```bash
mongosh "006D-SAKILA-EP3-G07-SCRIPT.js"
```

### Opción 3: En VS Code
1. Abre este repositorio en VS Code.
2. Abre el archivo `006D-SAKILA-EP3-G07-SCRIPT.mongodb.js`.
3. Haz clic en el botón verde de **Play (▷)** arriba a la derecha (o presiona `Ctrl + Alt + E`).

---

## 🗺️ Mapa Rápido de Consultas en el Script

| Sección | Operación | Qué hace |
| :--- | :--- | :--- |
| **Línea 8** | `countDocuments` | Verifica los registros iniciales (599 clientes, 1.000 películas, 603 direcciones, 2 tiendas). |
| **Línea 37** | `$lookup` en `location` | Encuentra las 4 direcciones sin clientes (Tiendas 1-2 y Empleados Mike y Jon). |
| **Línea 145** | `$arrayElemAt` | Limpia la categoría para que quede como objeto directo en `film`. |
| **Línea 168** | `$map` | Limpia la lista de actores en `film`. |
| **Línea 183** | Anidación de pagos | Guarda cada pago dentro de su respectivo arriendo en `customer`. |
| **Línea 230** | `insertOne` | Inserta la película nueva *Inception Chronicles* con su elenco. |
| **Línea 340** | `'actors.firstName'` | Busca películas de *Penelope Guiness* dentro del arreglo de actores. |
| **Línea 368** | Pipeline Agregación | Calcula el Top 5 de mejores clientes (1° Karl Seal $221.55, 2° Eleanor Hunt $216.54). |
| **Línea 464** | `arrayFilters` | Modifica solo la fecha de devolución del arriendo 16051 sin tocar los otros 30. |
| **Línea 505** | `$pull` | Remueve un arriendo cancelado sin borrar la ficha del cliente. |
