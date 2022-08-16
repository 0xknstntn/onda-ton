toncli build
sed -i -e 's/PROCINLINE/PROC/g' ./build/contract.fif
rm ./build/contract.fif-e
toncli fift run ./fift/new-pool.fif
