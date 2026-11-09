import time, os
import s3fs

fs = s3fs.S3FileSystem(anon=True, config_kwargs={"read_timeout": 120, "connect_timeout": 30})
BASE = "aws-public-blockchain/v1.0/btc/transactions"

particion = fs.ls(BASE)[-1]
archivos = fs.ls(particion)[:5]
os.makedirs("data/prueba", exist_ok=True)

total_mb, t0 = 0, time.time()
for ruta in archivos:
    destino = "data/prueba/" + ruta.split("/")[-1]
    t1 = time.time()
    fs.get(ruta, destino)
    mb = os.path.getsize(destino) / 1e6
    total_mb += mb
    print(f"{mb:.1f} MB en {time.time()-t1:.1f} s")

seg = time.time() - t0
print(f"\nVelocidad media: {total_mb/seg:.2f} MB/s")