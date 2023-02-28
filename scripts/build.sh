rm -r output
mkdir output
mkdir -p output/pool
ton-compiler --input ./source/NativePool/main.func --output ./output/pool/onda-nativePool.cell --output-fift ./output/pool/onda-nativePool.fif
echo "✓ Create onda-nativePool.cell"
echo "✓ Create onda-nativePool.fif"