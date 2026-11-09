import os, sys, time
import s3fs
import requests

fs = s3fs.S3FileSystem(anon=True)
BASE = "aws-public-blockchain/v1.0/btc/transactions"
dia = sys.argv[1] if len(sys.argv) > 1 else "2026-11-08"

ruta = fs.ls(f"{BASE}/date={dia}")[0]
tam = fs.size(ruta)
# s3fs usa "bucket/clave"; la misma ruta sirve para la URL pública HTTPS
bucket, clave = ruta.split("/", 1)
url = f"https://{bucket}.s3.amazonaws.com/{requests.utils.quote(clave, safe='/=')}"

os.makedirs("data/parquet", exist_ok=True)
destino = f"data/parquet/{dia}.parquet"
parcial = destino + ".part"

if os.path.exists(destino) and os.path.getsize(destino) == tam:
    raise SystemExit(f"{dia} ya descargado")

intentos = 0
while True:
    pos = os.path.getsize(parcial) if os.path.exists(parcial) else 0
    if pos >= tam:
        break
    try:
        t0 = time.time()
        with requests.get(url, headers={"Range": f"bytes={pos}-"},
                          stream=True, timeout=(15, 60)) as r:
            r.raise_for_status()
            with open(parcial, "ab") as f:
                for trozo in r.iter_content(chunk_size=1 << 20):
                    f.write(trozo)
                    hecho = os.path.getsize(parcial)
                    print(f"\r{hecho/1e6:.0f}/{tam/1e6:.0f} MB "
                          f"({hecho/tam:.0%})", end="", flush=True)
    except (requests.RequestException, OSError) as e:
        intentos += 1
        print(f"\nCorte ({type(e).__name__}), reintento {intentos} en 5 s...")
        if intentos > 50:
            raise
        time.sleep(5)

os.replace(parcial, destino)
print(f"\nListo: {destino}")