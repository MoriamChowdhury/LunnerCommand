import sys
import numpy as np
import rasterio

for path in sys.argv[1:]:
    print("=" * 70)
    print(path)

    # Is it really a TIFF? (HTML pages saved as .tiff start with "<")
    with open(path, "rb") as f:
        head = f.read(4)
    print("first bytes:", head)

    with rasterio.open(path) as src:
        print("size (cols x rows):", src.width, "x", src.height)
        print("bands:", src.count, "| dtype:", src.dtypes[0])
        print("crs:", src.crs)
        print("pixel size:", src.res)
        print("bounds:", src.bounds)
        print("nodata:", src.nodata)
        print("scales:", src.scales, "| offsets:", src.offsets)
        print("tags:", src.tags())

        # read a small, downsampled copy so it uses little memory
        step = max(1, src.width // 800)
        a = src.read(1, out_shape=(src.height // step, src.width // step))
        print("sample min / max / mean:", a.min(), a.max(), round(float(a.mean()), 2))
        print("unique values (first 10):", np.unique(a)[:10])