import s3fs
import pyarrow.parquet as pq
import bson
import time

fs = s3fs.S3FileSystem(anon=True)
BASE = "aws-public-blockchain/v1.0/btc/transactions"
DIA = "date=2026-06-15"

ruta = fs.ls(f"{BASE}/{DIA}")[0]
print(f"Tamaño Parquet del día: {fs.size(ruta)/1e6:.1f} MB")

COLUMNAS = [
    "txid", "block_number", "block_timestamp", "virtual_size", "is_coinbase",
    "input_count", "output_count", "fee", "input_value", "output_value",
    "inputs.list.element.address", "inputs.list.element.value",
    "outputs.list.element.address", "outputs.list.element.value",
]

def reducir(t):
    return {
        "txid": t["txid"],
        "bloque": t["block_number"],
        "fecha": t["block_timestamp"],
        "tam_virtual": t["virtual_size"],
        "es_coinbase": t["is_coinbase"],
        "n_inputs": t["input_count"],
        "n_outputs": t["output_count"],
        "comision": t["fee"],
        "total_entrada": t["input_value"],
        "total_salida": t["output_value"],
        "inputs": [{"dir": i["address"], "valor": i["value"]}
                   for i in (t["inputs"] or [])],
        "outputs": [{"dir": o["address"], "valor": o["value"]}
                    for o in (t["outputs"] or [])],
    }

t0 = time.time()
with fs.open(ruta, "rb") as f:
    pf = pq.ParquetFile(f)
    total_filas = pf.metadata.num_rows
    print(f"Filas del día: {total_filas}, row groups: {pf.num_row_groups}")
    print("Leyendo 1 row group con solo las columnas necesarias...")
    tabla = pf.read_row_group(2, columns=COLUMNAS)
    print(f"Leído en {time.time()-t0:.0f} s, filas: {tabla.num_rows}")

muestra = tabla.slice(0, 3000).to_pylist()
bytes_bson, ejemplo = 0, None
for t in muestra:
    d = reducir(t)
    bytes_bson += len(bson.encode(d))
    if ejemplo is None and not d["es_coinbase"] and d["inputs"]:
        ejemplo = d

prom = bytes_bson / len(muestra)
print(f"\nBytes promedio por documento: {prom:.0f}")
print(f"Estimado GB por día: {total_filas * prom / 1e9:.2f}")
print(f"Estimado GB por 30 días: {30 * total_filas * prom / 1e9:.1f}")
print(f"\nEJEMPLO NO COINBASE:\n{ejemplo}")