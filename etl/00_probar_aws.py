import s3fs
import pyarrow.parquet as pq

fs = s3fs.S3FileSystem(anon=True)
BASE = "aws-public-blockchain/v1.0/btc"   # VERIFICAR: es la ruta que espero, ajústala si difiere

print("Contenido de", BASE)
for p in fs.ls(BASE):
    print("  ", p)

# Explora la carpeta de transacciones y toma un archivo
tx_dir = f"{BASE}/transactions"
particiones = fs.ls(tx_dir)
print("\nPrimeras particiones:", particiones[:3])

archivos = fs.ls(particiones[-1])
print("Archivos de la última partición:", archivos[:3])

with fs.open(archivos[0], "rb") as f:
    pf = pq.ParquetFile(f)
    print("\nFilas en el archivo:", pf.metadata.num_rows)
    print("Tamaño en disco (MB):", fs.size(archivos[0]) / 1e6)
    print("\nESQUEMA:\n", pf.schema_arrow)
    primera = next(pf.iter_batches(batch_size=1)).to_pylist()[0]
    print("\nEJEMPLO:\n", primera)