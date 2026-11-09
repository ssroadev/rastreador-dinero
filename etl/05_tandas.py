import os, sys, time
from datetime import datetime, timedelta
import requests
import s3fs
import pyarrow.parquet as pq
from pymongo import MongoClient

URI = "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true"
BASE = "aws-public-blockchain/v1.0/btc/transactions"
OBJETIVO_GB = float(sys.argv[1]) if len(sys.argv) > 1 else 23.0
GB = 1024 ** 3
BORRAR_PARQUET = False   # cámbialo a True si quieres liberar disco

db = MongoClient(URI)["rastro"]
fs = s3fs.S3FileSystem(anon=True)
os.makedirs("data/parquet", exist_ok=True)

COLUMNAS = ["txid", "block_number", "block_timestamp", "virtual_size",
            "is_coinbase", "input_count", "output_count", "fee",
            "input_value", "output_value", "inputs", "outputs"]

def reducir(t):
    return {
        "txid": t["txid"], "bloque": t["block_number"],
        "fecha": t["block_timestamp"], "tam_virtual": t["virtual_size"],
        "es_coinbase": t["is_coinbase"], "n_inputs": t["input_count"],
        "n_outputs": t["output_count"], "comision": t["fee"],
        "total_entrada": t["input_value"], "total_salida": t["output_value"],
        "inputs": [{"dir": i["address"], "valor": i["value"],
                    "tx_prev": i["spent_transaction_hash"],
                    "idx_prev": i["spent_output_index"]}
                   for i in (t["inputs"] or [])],
        "outputs": [{"dir": o["address"], "valor": o["value"],
                     "tipo": o["type"], "idx": o["index"]}
                    for o in (t["outputs"] or [])],
    }

def descargar(dia):
    ruta = fs.ls(f"{BASE}/date={dia}")[0]
    tam = fs.size(ruta)
    bucket, clave = ruta.split("/", 1)
    url = f"https://{bucket}.s3.amazonaws.com/{requests.utils.quote(clave, safe='/=')}"
    destino = f"data/parquet/{dia}.parquet"
    parcial = destino + ".part"
    if os.path.exists(destino) and os.path.getsize(destino) == tam:
        return destino
    intentos = 0
    while True:
        pos = os.path.getsize(parcial) if os.path.exists(parcial) else 0
        if pos >= tam:
            break
        try:
            with requests.get(url, headers={"Range": f"bytes={pos}-"},
                              stream=True, timeout=(15, 60)) as r:
                r.raise_for_status()
                with open(parcial, "ab") as f:
                    for trozo in r.iter_content(chunk_size=1 << 20):
                        f.write(trozo)
                        h = os.path.getsize(parcial)
                        print(f"\r  descarga {h/1e6:.0f}/{tam/1e6:.0f} MB",
                              end="", flush=True)
        except (requests.RequestException, OSError) as e:
            intentos += 1
            print(f"\n  corte ({type(e).__name__}), reintento {intentos}")
            if intentos > 50:
                raise
            time.sleep(5)
    os.replace(parcial, destino)
    print()
    return destino

def cargar(dia, archivo):
    ini = datetime.strptime(dia, "%Y-%m-%d")
    db.transacciones.delete_many({"fecha": {"$gte": ini, "$lt": ini + timedelta(days=1)}})
    pf = pq.ParquetFile(archivo)
    total, hechas, t0 = pf.metadata.num_rows, 0, time.time()
    for lote in pf.iter_batches(batch_size=5000, columns=COLUMNAS):
        docs = [reducir(t) for t in lote.to_pylist()]
        db.transacciones.insert_many(docs, ordered=False)
        hechas += len(docs)
        print(f"\r  carga {hechas:,}/{total:,}", end="", flush=True)
    db.etl_progreso.insert_one({"_id": dia, "filas": hechas,
                                "segundos": time.time() - t0})
    print()

def data_gb():
    return db.command("dbStats", scale=GB)["dataSize"]

# Recorre días hacia atrás desde el 7-nov (el 8 ya está cargado)
dia = datetime(2026, 11, 7)
while data_gb() < OBJETIVO_GB:
    s = dia.strftime("%Y-%m-%d")
    if db.etl_progreso.find_one({"_id": s}):
        dia -= timedelta(days=1)
        continue
    print(f"[{s}] dataSize actual: {data_gb():.2f} GB / objetivo {OBJETIVO_GB}")
    try:
        arch = descargar(s)
        cargar(s, arch)
        if BORRAR_PARQUET:
            os.remove(arch)
    except Exception as e:
        print(f"  ERROR en {s}: {e}. Vuelve a ejecutar el script para reanudar.")
        raise SystemExit(1)
    dia -= timedelta(days=1)

print(f"\nObjetivo alcanzado: dataSize = {data_gb():.2f} GB")