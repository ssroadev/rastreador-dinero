import sys, time
import pyarrow.parquet as pq
from pymongo import MongoClient

URI = "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true"
dia = sys.argv[1] if len(sys.argv) > 1 else "2026-11-08"
archivo = f"data/parquet/{dia}.parquet"

db = MongoClient(URI)["rastro"]
if db.etl_progreso.find_one({"_id": dia}):
    raise SystemExit(f"{dia} ya está cargado")

# Si una carga anterior quedó a medias, limpia ese día antes de reintentar
desde = None
COLUMNAS = [
    "txid", "block_number", "block_timestamp", "virtual_size", "is_coinbase",
    "input_count", "output_count", "fee", "input_value", "output_value",
    "inputs", "outputs",
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
        "inputs": [{"dir": i["address"], "valor": i["value"],
                    "tx_prev": i["spent_transaction_hash"],
                    "idx_prev": i["spent_output_index"]}
                   for i in (t["inputs"] or [])],
        "outputs": [{"dir": o["address"], "valor": o["value"],
                     "tipo": o["type"], "idx": o["index"]}
                    for o in (t["outputs"] or [])],
    }

# Borra restos de un intento fallido del mismo día (por rango de fecha)
from datetime import datetime, timedelta
ini = datetime.strptime(dia, "%Y-%m-%d")
db.transacciones.delete_many({"fecha": {"$gte": ini, "$lt": ini + timedelta(days=1)}})

pf = pq.ParquetFile(archivo)
total = pf.metadata.num_rows
hechas, t0 = 0, time.time()

for lote in pf.iter_batches(batch_size=5000, columns=COLUMNAS):
    docs = [reducir(t) for t in lote.to_pylist()]
    db.transacciones.insert_many(docs, ordered=False)
    hechas += len(docs)
    print(f"\r{hechas:,}/{total:,} ({hechas/total:.0%}) "
          f"{hechas/(time.time()-t0):,.0f} doc/s", end="", flush=True)

db.etl_progreso.insert_one({"_id": dia, "filas": hechas, "segundos": time.time() - t0})

GB = 1024 ** 3
s = db.command("dbStats", scale=GB)
print(f"\n\nDía {dia} cargado: {hechas:,} documentos")
print(f"dataSize:    {s['dataSize']:.3f} GB")
print(f"storageSize: {s['storageSize']:.3f} GB")
print(f"indexSize:   {s['indexSize']:.3f} GB")
print(f"Bytes promedio por documento: {s['dataSize']*GB/hechas:.0f}")