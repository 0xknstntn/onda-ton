rm -r output
mkdir output
mkdir -p output/pool
ton-compiler --input ./source/NativePool/main.func --output ./output/pool/onda-NativePool.cell --output-fift ./output/pool/onda-NativePool.fif
echo "✓ Create onda-NativePool.cell"
echo "✓ Create onda-NativePool.fif"
ton-compiler --input ./source/TokenPool/main.func --output ./output/pool/onda-TokenPool.cell --output-fift ./output/pool/onda-TokenPool.fif
echo "✓ Create onda-TokenPool.cell"
echo "✓ Create onda-TokenPool.fif"