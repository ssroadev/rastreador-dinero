import time, os
from concurrent.futures import ThreadPoolExecutor
import s3fs

fs = s3fs.S3FileSystem(anon=True, config_kwargs={"read_timeout": 120, "connect_timeout": 30})
BASE = "aws-public-blockchain/v1.0/btc/transactions"
os.makedirs("data/prueba", exist_ok=True)

# Mira las últimas 6 particiones y cuántos archivos tienen
particiones = fs.ls(BASE)[-6:]
candidatos = []
for p in particiones:
    lista = fs.ls(p, detail=True)
    print(f"{p.split('/')[-1]}: {len(lista)} archivos, "
          f"mayor = {max(x['size'] for x in lista)/1e6:.0f} MB")
    candidatos += [x["name"] for x in lista if x["size"] < 20e6]

archivos = candidatos[:16]
print(f"\nArchivos pequeños para la prueba: {len(archivos)}")
if len(archivos) < 4:
    raise SystemExit("No hay suficientes archivos pequeños; pégame lo impreso arriba.")

def bajar(ruta):
    destino = "data/prueba/p_" + ruta.split("/")[-1]
    fs.get(ruta, destino)
    return os.path.getsize(destino)

for hilos in (1, 4, 8, 16):
    lote = archivos[:hilos]
    if len(lote) < hilos:
        break
    t0 = time.time()
    with ThreadPoolExecutor(hilos) as ex:
        total = sum(ex.map(bajar, lote))
    seg = time.time() - t0
    print(f"{hilos} hilos: {total/1e6:.0f} MB en {seg:.0f} s = {total/1e6/seg:.2f} MB/s")
    for r in lote:
        os.remove("data/prueba/p_" + r.split("/")[-1])